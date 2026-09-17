import type { Item, Message } from '$db/schema';
import { toItem, toMessage } from './mapping';

/**
 * Ce qu'un évènement `postgres_changes` permet de faire sans relire le foyer entier.
 *
 * La relecture complète reste la référence : elle est la seule à pouvoir corriger une divergence,
 * et tout ce qui n'entre pas exactement dans les cas ci-dessous y retombe. Appliquer un payload
 * n'est qu'un raccourci pour les deux tables qui parlent sans arrêt — les articles qu'on coche et
 * les messages qu'on écrit. Une divergence silencieuse coûterait bien plus cher que la lenteur
 * qu'on évite ici.
 *
 * Les autres tables publiées (listes, prix, recettes, sondages) gardent la relecture. Une liste ne
 * se reconstruit pas depuis sa seule ligne — `toList` a besoin de `list_members`, que le payload ne
 * porte pas — et les autres changent trop rarement pour valoir le risque.
 */

type Row = Record<string, unknown>;

export type AppliedTable = 'items' | 'messages';

const APPLIED_TABLES = new Set<string>(['items', 'messages']);

export interface RealtimeEvent {
	table: string;
	eventType: string;
	/** Horodatage du commit Postgres, seul ordre fiable dont dispose le client. */
	commitTimestamp: string;
	new?: Row;
	old?: Row;
}

export interface RealtimeContext {
	/**
	 * Les listes présentes dans le cache. Un article ou un message qui pointe ailleurs vient d'une
	 * liste qu'on n'a pas encore lue : le poser laisserait une ligne orpheline, invisible à
	 * l'écran et jamais nettoyée.
	 */
	knownListIds: ReadonlySet<string>;
	/**
	 * Les conversations directes présentes dans le cache. Même raison que pour les listes : un
	 * message qui pointe vers une conversation qu'on n'a pas encore lue laisserait une ligne
	 * orpheline. La conversation elle-même n'est pas dans le chemin rapide — elle naît rarement, et
	 * sa naissance retombe sur la relecture complète, qui la posera avec ses participants.
	 */
	knownConversationIds: ReadonlySet<string>;
	/** Horodatage du dernier évènement appliqué, par ligne. Sert de pierre tombale après un DELETE. */
	applied: ReadonlyMap<string, string>;
	/** Vrai tant qu'une écriture locale n'a pas atteint le serveur, ou qu'une relecture est en vol. */
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
 * Traduit un évènement en une écriture locale, ou renvoie à la relecture complète.
 *
 * Fonction pure : l'appelant lui donne ce qu'il sait du cache et décide ensuite quoi en faire. Tout
 * ce qui sort de l'ordinaire — table inconnue, identifiant absent, horodatage illisible, type
 * d'évènement inattendu — rend `pull` plutôt que de deviner.
 */
export const planRealtime = (event: RealtimeEvent, context: RealtimeContext): RealtimePlan => {
	if (context.busy) return { kind: 'pull' };
	if (!APPLIED_TABLES.has(event.table)) return { kind: 'pull' };

	const removing = event.eventType === 'DELETE';

	// Sous `replica identity default`, un DELETE ne porte que la clé primaire : c'est `old` qu'il
	// faut lire, et rien d'autre n'y sera.
	const id = identifier(removing ? event.old : event.new);
	if (!id) return { kind: 'pull' };

	const commit = Date.parse(event.commitTimestamp);
	if (!Number.isFinite(commit)) return { kind: 'pull' };

	// Un évènement plus ancien que ce qu'on a déjà posé sur cette ligne est un doublon ou un
	// retardataire. L'appliquer ressusciterait une ligne supprimée ou rétablirait une valeur
	// périmée. À horodatage égal on applique : deux écritures du même commit décrivent le même état.
	const seen = context.applied.get(rowKey(event.table, id));
	if (seen !== undefined && commit < Date.parse(seen)) return { kind: 'skip' };

	// La table est déjà restreinte à `items` et `messages`, mais TypeScript ne le sait pas d'un
	// `Set<string>` : on refait le tri ici, où il porte le type.
	const table: AppliedTable = event.table === 'items' ? 'items' : 'messages';

	if (removing) return { kind: 'delete', table, id };

	if (event.eventType !== 'INSERT' && event.eventType !== 'UPDATE') return { kind: 'pull' };

	const row = event.new;
	if (!row) return { kind: 'pull' };

	// Un message porte une portée parmi deux : une liste, ou une conversation directe. Un article
	// n'en a qu'une. Chacune se vérifie contre ce que le cache connaît déjà, et tout le reste —
	// portée absente, portée inconnue — retombe sur la relecture complète.
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
