import type { Item, Message } from '$db/schema';
import { toItem, toMessage } from './mapping';

/**
 * What a `postgres_changes` event allows us to do without re-reading the whole household.
 *
 * The full re-read stays the reference: it is the only thing that can fix a divergence, and everything
 * that does not fall exactly into the cases below goes back to it. Applying a payload is only a shortcut
 * for the two tables that talk constantly — the items we tick and the messages we write. A silent
 * divergence would cost far more than the slowness avoided here.
 *
 * The other published tables (lists, prices, recipes, polls) keep the re-read. A list cannot be rebuilt
 * from its own row — `toList` needs `list_members`, which the payload does not carry — and the others
 * change too rarely to be worth the risk.
 */

type Row = Record<string, unknown>;

export type AppliedTable = 'items' | 'messages';

const APPLIED_TABLES = new Set<string>(['items', 'messages']);

export interface RealtimeEvent {
	table: string;
	eventType: string;
	/** Timestamp of the Postgres commit, the only reliable ordering the client has. */
	commitTimestamp: string;
	new?: Row;
	old?: Row;
}

export interface RealtimeContext {
	/**
	 * The lists present in the cache. An item or a message pointing elsewhere comes from a list we have not
	 * read yet: applying it would leave an orphan row, invisible on screen and never cleaned up.
	 */
	knownListIds: ReadonlySet<string>;
	/**
	 * The direct conversations present in the cache. Same reason as for lists: a message pointing at a
	 * conversation we have not read yet would leave an orphan row. The conversation itself is not on the
	 * fast path — it is rarely born, and its birth falls back on the full re-read, which will lay it down
	 * with its participants.
	 */
	knownConversationIds: ReadonlySet<string>;
	/** Timestamp of the last event applied, per row. Acts as a tombstone after a DELETE. */
	applied: ReadonlyMap<string, string>;
	/** True while a local write has not reached the server, or a re-read is in flight. */
	busy: boolean;
}

export type RealtimePlan =
	| { kind: 'put'; table: 'items'; row: Item }
	| { kind: 'put'; table: 'messages'; row: Message }
	| { kind: 'delete'; table: AppliedTable; id: string }
	| { kind: 'pull' }
	| { kind: 'skip' };

export const rowKey = (table: string, id: string) => `${table}:${id}`;

const identifier = (row: Row | undefined) => {
	const id = row?.id;
	return typeof id === 'string' && id !== '' ? id : null;
};

/**
 * Translates an event into a local write, or hands back to the full re-read.
 *
 * A pure function: the caller gives it what it knows of the cache and then decides what to do with the
 * result. Anything out of the ordinary — unknown table, missing id, unreadable timestamp, unexpected
 * event type — returns `pull` rather than guessing.
 */
export const planRealtime = (event: RealtimeEvent, context: RealtimeContext): RealtimePlan => {
	if (context.busy) return { kind: 'pull' };
	if (!APPLIED_TABLES.has(event.table)) return { kind: 'pull' };

	const removing = event.eventType === 'DELETE';

	// Under `replica identity default`, a DELETE only carries the primary key: it is `old` that has to be
	// read, and nothing else will be there.
	const id = identifier(removing ? event.old : event.new);
	if (!id) return { kind: 'pull' };

	const commit = Date.parse(event.commitTimestamp);
	if (!Number.isFinite(commit)) return { kind: 'pull' };

	// An event older than what we have already applied to this row is a duplicate or a straggler. Applying
	// it would resurrect a deleted row or restore a stale value. On equal timestamps we apply: two writes
	// from the same commit describe the same state.
	const seen = context.applied.get(rowKey(event.table, id));
	if (seen !== undefined && commit < Date.parse(seen)) return { kind: 'skip' };

	// The table is already restricted to `items` and `messages`, but TypeScript does not know that from a
	// `Set<string>`: we sort it again here, where it carries the type.
	const table: AppliedTable = event.table === 'items' ? 'items' : 'messages';

	if (removing) return { kind: 'delete', table, id };

	if (event.eventType !== 'INSERT' && event.eventType !== 'UPDATE') return { kind: 'pull' };

	const row = event.new;
	if (!row) return { kind: 'pull' };

	// A message carries one scope out of two: a list, or a direct conversation. An item has only one. Each
	// is checked against what the cache already knows, and everything else — missing scope, unknown scope —
	// falls back on the full re-read.
	const conversationId = row.conversation_id;
	if (table === 'messages' && typeof conversationId === 'string') {
		return context.knownConversationIds.has(conversationId)
			? { kind: 'put', table, row: toMessage(row) }
			: { kind: 'pull' };
	}

	const listId = row.list_id;
	if (typeof listId !== 'string' || !context.knownListIds.has(listId)) return { kind: 'pull' };

	return table === 'items'
		? { kind: 'put', table, row: toItem(row) }
		: { kind: 'put', table, row: toMessage(row) };
};
