import { browser } from '$app/environment';
import { supabase } from '$db/supabase';
import { db, type OutboxEntry } from '$db/schema';
import { describeError } from './errors';
import { defaultCircle } from '$domain/circle';
import { reportCrash } from '$lib/crash/reporter';
import {
	toAisle,
	toCard,
	toItem,
	toItemOrder,
	toLayout,
	toList,
	toMember,
	toConversation,
	toMessage,
	toPoll,
	toPollOption,
	toPollVote,
	toPrice,
	toRecipe,
	toRecipeIngredient,
	toRecipeStep,
	toShop
} from './mapping';
import { planRealtime, rowKey, type RealtimeEvent } from './realtime';

const HOUSEHOLD_KEY = 'familist:household';

/**
 * Postgres codes a retry will never fix: malformed data, missing reference, empty required field,
 * permission denied. Everything else (network down, server unavailable) deserves to wait its turn.
 */
const PERMANENT_CODES = new Set(['22P02', '23502', '23503', '23505', '23514', '42501', '42703']);

const isPermanent = (code: string | undefined) => code !== undefined && PERMANENT_CODES.has(code);

const noop = () => undefined;

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

/** A circle the account belongs to, as the selector names it. */
export interface Circle {
	id: string;
	name: string;
}

/**
 * The server is the authority, Dexie is the cache that lets the application open in a shop with no
 * network. Writes leave through a queue: the screen is answered at once, the push comes after. A
 * household's volume is small, so we re-read everything on each sync rather than keep a delta log —
 * one mechanism fewer to maintain and debug.
 */
class SyncStore {
	/**
	 * The active circle: the one the screen shows, and the one new things land in.
	 *
	 * The cache, on the other hand, holds every circle at once — see `circles`. Telling the two apart is
	 * what makes switching circle instant and usable offline: it re-reads nothing, it changes what you
	 * are looking at.
	 */
	householdId = $state<string | null>(null);

	/** Every circle of the account, oldest first. All are read, all are cached. */
	circles = $state<Circle[]>([]);

	state = $state<SyncState>('idle');
	lastError = $state<string | null>(null);

	/**
	 * True as soon as the first sync attempt has settled, whether it succeeded, failed or found no
	 * network.
	 *
	 * What is decided from the full cache waits on this flag — a shop's three-letter code is picked among
	 * those already taken, and the cache is empty during the second that follows opening. Without it, a
	 * shop created in that window takes a code already in use.
	 *
	 * It falls on the failure paths too, not only on success: offline, the answer will never come, and
	 * blocking the screen indefinitely would be worse than the duplicate.
	 */
	settled = $state(false);

	private channel: ReturnType<typeof supabase.channel> | null = null;
	private pulling: Promise<void> | null = null;
	private onPulled: (() => void) | null = null;
	private pullTimer: ReturnType<typeof setTimeout> | null = null;
	private watchingNetwork = false;

	/**
	 * The queue writes still in flight.
	 *
	 * `enqueue` is called from synchronous methods: when the click returns, the entry is not in the queue
	 * yet. A drain started in that window — the one on sign-out — read an empty queue and left the write
	 * behind. `flush` therefore waits on them before reading what it has to send.
	 */
	private writing: Promise<unknown> = Promise.resolve();

	/**
	 * Timestamp of the last realtime event applied, per row. It is the only ordering memory we have: the
	 * channel does not number its messages.
	 */
	private appliedAt = new Map<string, string>();

	/** True after the first subscription: the ones after are recoveries from an outage. */
	private subscribed = false;

	/**
	 * Number of the current cache, incremented by `stop()`.
	 *
	 * A read that left before an account change must not write into the next account's cache. We used to
	 * compare the displayed circle before and after; that test became wrong the day switching circle
	 * stopped emptying the cache — it then discarded a perfectly valid re-read or realtime event, simply
	 * because we had switched in the meantime. This counter only moves when the cache really changes
	 * owner.
	 */
	private generation = 0;

	/**
	 * The remembered circle is restored at construction, without waiting for the network.
	 *
	 * The screen is split by circle: without this restore, the first hydration from the cache would have
	 * no active circle and would show an empty screen until the server answers — so indefinitely in a
	 * shop with no network, which everything else in this engine works to avoid. `provision()` checks
	 * membership afterwards and corrects if needed.
	 */
	constructor() {
		if (browser) this.householdId = localStorage.getItem(HOUSEHOLD_KEY);
	}

	/**
	 * Starts a job that cannot be awaited — the queue pushed in the background, the network waking up,
	 * the deferred re-read from realtime — without letting it end as a silent rejection.
	 *
	 * Without this, a failure on those paths is written to a console nobody opens: the screen goes on
	 * showing a household that looks up to date while nothing leaves any more. We bring it back where the
	 * interface already reads the sync state.
	 */
	private detach(work: Promise<unknown>) {
		void work.catch((cause) => {
			this.state = 'error';
			this.lastError = describeError(cause);
			this.report(cause);
		});
	}

	/**
	 * The same failure, reported this time to the administration.
	 *
	 * This engine already catches everything that fails to feed its banner: adding a global listener on
	 * top would count each failure twice, and the global listener would see nothing anyway, since nothing
	 * is rejected any more once caught here. So we hook into the two places that already knew, rather
	 * than inventing a third.
	 *
	 * The banner remains what speaks to the person — this call is for us alone, and changes nothing on
	 * screen.
	 */
	private report(cause: unknown) {
		reportCrash(cause, 'sync', browser ? location.pathname : '');
	}

	/** Called once the account is approved. Returns true if the local cache was filled. */
	async start(onPulled: () => void) {
		try {
			return await this.attempt(onPulled);
		} finally {
			this.settled = true;
		}
	}

	private async attempt(onPulled: () => void) {
		if (!browser) return false;

		this.onPulled = onPulled;

		// The state is wired to the browser, not only to our own calls: otherwise the banner would only
		// appear on the first write, long after the network was lost.
		//
		// Only once: `start()` is called again on every household or account change, and without this guard
		// each pass added a pair of listeners. After three changes, a single network recovery started three
		// full re-reads at once.
		if (!this.watchingNetwork) {
			this.watchingNetwork = true;
			addEventListener('online', () => this.detach(this.resume()));
			addEventListener('offline', () => (this.state = 'offline'));
		}

		if (!navigator.onLine) {
			this.state = 'offline';
			this.householdId = localStorage.getItem(HOUSEHOLD_KEY);
			return false;
		}

		if (!(await this.provision())) return false;

		await this.flush();
		await this.pull();
		this.listen();
		return true;
	}

	stop() {
		// `removeChannel` and not `unsubscribe`: the client keeps its channels indexed by topic, and a plain
		// unsubscribe would leave this one in place. Joining a household then coming back to the previous one
		// would reuse an already-subscribed channel, which the library refuses to reconfigure — realtime
		// would stop without a word.
		if (this.channel) supabase.removeChannel(this.channel);
		this.channel = null;
		this.householdId = null;
		this.circles = [];
		this.generation += 1;
		this.state = 'idle';
		// Changing household or account starts again from a cache that says nothing about the new one: what
		// waits for the first sync must wait for it again.
		this.settled = false;

		// A re-read in flight belongs to the household being left. Keeping it would hand that old promise to
		// the next `pull()`, which would believe it had re-read the new household: you would join a family and
		// the screen would stay on the old one, with nothing left to wait for.
		this.pulling = null;

		// A re-read scheduled by realtime also belongs to the household being left. Left in place, it fires
		// eight tenths of a second later, in the middle of loading the new household.
		if (this.pullTimer) clearTimeout(this.pullTimer);
		this.pullTimer = null;

		// The applied timestamps describe the rows of the household being left. Kept, they would make the
		// first event of a row in the new household carrying the same id be discarded as late.
		this.appliedAt.clear();
		this.subscribed = false;
	}

	private async resume() {
		if (!navigator.onLine) return;
		if (!this.householdId && !(await this.provision())) return;

		await this.flush();
		await this.pull();
		this.listen();
	}

	/**
	 * The household, waiting for it to be known if it is not yet.
	 *
	 * A write leaving before the household was provisioned used to carry an empty string in place of the
	 * id. Postgres refuses it — "invalid input syntax for type uuid" — and that refusal is final: the
	 * queue discarded the write, with nothing to catch it. The shop just created stayed on screen for one
	 * re-read, then disappeared for good.
	 *
	 * Better to wait for the id than to write beside it. Returning an empty string stays possible —
	 * offline, server in error — and the caller must then give up rather than queue something invalid.
	 */
	async whenHousehold(delayMs = 5000): Promise<string> {
		if (this.householdId) return this.householdId;
		if (!browser) return '';

		/**
		 * We wait for the one `start()` is setting — we do not provision a second.
		 *
		 * `ensure_household` returns the existing household when there is one, but two calls made at the same
		 * time see neither the other's membership: both create one, and the account ends up in two households
		 * of which only one will be read. Provisioning here, in parallel with startup, produced exactly that —
		 * and the household's lists disappeared.
		 */
		const end = Date.now() + delayMs;
		while (!this.householdId && Date.now() < end) {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		return this.householdId ?? '';
	}

	/**
	 * The displayed circle, chosen explicitly.
	 *
	 * Joining a family no longer means leaving your own: `ensure_household` would return the oldest, so the
	 * one from sign-up, and the invitation would look as if it had done nothing.
	 *
	 * Switching from one circle to another re-reads nothing and empties nothing: the cache already holds
	 * them all, only what the screen shows changes.
	 */
	adopt(householdId: string) {
		this.householdId = householdId;
		localStorage.setItem(HOUSEHOLD_KEY, householdId);
	}

	/** The ids of the known circles, in arrival order. */
	get householdIds(): string[] {
		return this.circles.map((circle) => circle.id);
	}

	/**
	 * The circles the account belongs to, oldest first, re-read from the server.
	 *
	 * The name comes from `households`, which RLS only opens to its own members: the join therefore never
	 * brings back a circle you do not belong to, and a circle with no readable name is dropped rather than
	 * shown blank in the selector.
	 */
	async households(): Promise<Circle[]> {
		const { data: session } = await supabase.auth.getUser();
		const me = session.user?.id;
		if (!me) return [];

		const { data, error } = await supabase
			.from('household_members')
			.select('household_id, joined_at, households(name)')
			.eq('user_id', me)
			.order('joined_at');

		if (error) return [];

		this.circles = (data ?? [])
			.map((row) => ({
				id: row.household_id as string,
				name: ((row.households as { name?: string } | null)?.name ?? '').trim()
			}))
			.filter((circle) => circle.id !== '');

		return this.circles;
	}

	private async provision() {
		const known = await this.households();

		// The circle remembered last time comes first: without that, an account belonging to several circles
		// would go back to the oldest on every opening, whichever one it was looking at. Membership is
		// checked — we may have been removed from another device.
		const selected = defaultCircle(known, localStorage.getItem(HOUSEHOLD_KEY));
		if (selected) {
			this.adopt(selected);
			return true;
		}

		const { data, error } = await supabase.rpc('ensure_household');

		if (error) {
			this.state = 'error';
			this.lastError = error.message;
			return false;
		}

		this.adopt(data as unknown as string);
		await this.households();
		return true;
	}

	/**
	 * Re-reads every circle of the account and replaces the cache. The tables are emptied and rewritten in
	 * a single transaction: an aisle deleted on another device really disappears here, which a plain
	 * bulkPut would not do.
	 */
	async pull() {
		if (this.pulling) return this.pulling;

		this.pulling = this.pullOnce().finally(() => {
			this.pulling = null;
		});

		return this.pulling;
	}

	private async pullOnce() {
		if (!this.householdId) return;

		// Memberships are re-read first: a circle joined from another device must enter this re-read, not the
		// next one.
		const cercles = (await this.households()).map((circle) => circle.id);
		if (cercles.length === 0) return;

		const generation = this.generation;

		// What waits in the queue leaves first. The re-read empties the tables and rewrites them from the
		// server: started while a write has not left yet, it erases from the screen a shop just created, or
		// brings back one just deleted. If the queue does not drain — offline, server in error — we do not
		// re-read at all, rather than overwrite work that has not reached the server yet.
		await this.flush(true);
		if ((await db.outbox.count()) > 0) return;

		this.state = 'syncing';

		const [
			shops,
			aisles,
			lists,
			listMembers,
			items,
			cards,
			members,
			layouts,
			itemOrders,
			messages,
			polls,
			pollOptions,
			pollVotes,
			prices,
			recipes,
			recipeIngredients,
			recipeSteps,
			conversations,
			conversationParticipants
		] = await Promise.all([
			supabase.from('shops').select('*').in('household_id', cercles),
			supabase.from('aisles').select('*').in('household_id', cercles),
			// A personal list has no circle: filtering on circles would make it disappear from its own author's
			// screen. RLS only lets their own through, the `or` merely refrains from excluding them.
			supabase
				.from('lists')
				.select('*')
				.or(`household_id.is.null,household_id.in.(${cercles.join(',')})`),
			supabase.from('list_members').select('*'),
			supabase.from('items').select('*'),
			supabase.from('loyalty_cards').select('*').in('household_id', cercles),
			supabase.from('household_members').select('*').in('household_id', cercles),
			supabase.from('shop_layouts').select('*'),
			supabase.from('shop_item_orders').select('*'),
			supabase.from('messages').select('*'),
			supabase.from('polls').select('*'),
			supabase.from('poll_options').select('*'),
			supabase.from('poll_votes').select('*'),
			supabase.from('item_prices').select('*').in('household_id', cercles),
			supabase.from('recipes').select('*').in('household_id', cercles),
			// A recipe's lines carry no household: the policy already filters them by the recipe they depend on,
			// as for a list's items.
			supabase.from('recipe_ingredients').select('*'),
			supabase.from('recipe_steps').select('*'),
			// A direct conversation attaches to no circle: filtering on the displayed household would make it
			// disappear. RLS only lets through the ones you take part in.
			supabase.from('conversations').select('*'),
			supabase.from('conversation_participants').select('*')
		]);

		const failed = [
			shops,
			aisles,
			lists,
			listMembers,
			items,
			cards,
			members,
			layouts,
			itemOrders,
			messages,
			polls,
			pollOptions,
			pollVotes,
			prices,
			recipes,
			recipeIngredients,
			recipeSteps,
			conversations,
			conversationParticipants
		]
			.map((result) => result.error)
			.find(Boolean);

		if (failed) {
			this.state = 'error';
			this.lastError = failed.message;
			return;
		}

		const { data: session } = await supabase.auth.getUser();
		const currentUserId = session.user?.id ?? '';

		// Profiles go through a function: the table's policy limits reading to your own, and a household where
		// nobody has a name cannot be read.
		const profiles = await supabase.rpc('household_profiles');

		const profileById = new Map(
			(profiles.data ?? []).map((row) => [row.id as string, row as Record<string, unknown>])
		);

		const membersByList = new Map<string, string[]>();
		for (const row of listMembers.data ?? []) {
			const listId = row.list_id as string;
			membersByList.set(listId, [...(membersByList.get(listId) ?? []), row.user_id as string]);
		}

		const participantsByConversation = new Map<string, string[]>();
		for (const row of conversationParticipants.data ?? []) {
			const conversationId = row.conversation_id as string;
			participantsByConversation.set(conversationId, [
				...(participantsByConversation.get(conversationId) ?? []),
				row.user_id as string
			]);
		}

		// The account may have changed during these reads. Writing now would fill the new one's cache with the
		// previous one's circles. Switching circle, on the other hand, changes nothing: what we hold describes
		// every circle, the active one included.
		if (this.generation !== generation) return;

		await db.transaction(
			'rw',
			[
				db.outbox,
				db.shops,
				db.aisles,
				db.lists,
				db.items,
				db.cards,
				db.members,
				db.shopLayouts,
				db.shopItemOrders,
				db.messages,
				db.polls,
				db.pollOptions,
				db.pollVotes,
				db.prices,
				db.recipes,
				db.recipeIngredients,
				db.recipeSteps,
				db.conversations
			],
			async () => {
				/**
				 * One last look at the queue, under the protection of the transaction.
				 *
				 * The queue was empty at the start, but thirteen reads take time, and somebody may have created a
				 * shop meanwhile. What we hold in our hands does not know about that write: writing it would erase
				 * from the screen something the person has just done, and which would only come back at the next
				 * re-read — when there is one. We have seen the shop disappear for good.
				 *
				 * So we abandon this re-read, touching nothing. Sending the pending write schedules another one
				 * behind it, with a server that knows about it.
				 *
				 * The check is here, inside the transaction, and not just before: Dexie serialises transactions on
				 * these tables, which closes the window instead of narrowing it.
				 */
				if ((await db.outbox.count()) > 0) return;

				await Promise.all([
					db.shops.clear(),
					db.aisles.clear(),
					db.lists.clear(),
					db.items.clear(),
					db.cards.clear(),
					db.members.clear(),
					db.shopLayouts.clear(),
					db.shopItemOrders.clear(),
					db.messages.clear(),
					db.polls.clear(),
					db.pollOptions.clear(),
					db.pollVotes.clear(),
					db.prices.clear(),
					db.recipes.clear(),
					db.recipeIngredients.clear(),
					db.recipeSteps.clear(),
					db.conversations.clear()
				]);

				await Promise.all([
					db.shops.bulkAdd((shops.data ?? []).map(toShop)),
					db.aisles.bulkAdd((aisles.data ?? []).map(toAisle)),
					db.lists.bulkAdd(
						(lists.data ?? []).map((row) => toList(row, membersByList.get(row.id as string) ?? []))
					),
					db.items.bulkAdd((items.data ?? []).map(toItem)),
					db.cards.bulkAdd((cards.data ?? []).map(toCard)),
					db.members.bulkAdd(
						(members.data ?? []).map((row) =>
							toMember(row, profileById.get(row.user_id as string), currentUserId)
						)
					),
					db.shopLayouts.bulkAdd((layouts.data ?? []).map(toLayout)),
					db.shopItemOrders.bulkAdd((itemOrders.data ?? []).map(toItemOrder)),
					db.messages.bulkAdd((messages.data ?? []).map(toMessage)),
					db.polls.bulkAdd((polls.data ?? []).map(toPoll)),
					db.pollOptions.bulkAdd((pollOptions.data ?? []).map(toPollOption)),
					db.pollVotes.bulkAdd((pollVotes.data ?? []).map(toPollVote)),
					db.prices.bulkAdd((prices.data ?? []).map(toPrice)),
					db.recipes.bulkAdd((recipes.data ?? []).map(toRecipe)),
					db.recipeIngredients.bulkAdd(
						(recipeIngredients.data ?? []).map(toRecipeIngredient)
					),
					db.recipeSteps.bulkAdd((recipeSteps.data ?? []).map(toRecipeStep)),
					db.conversations.bulkAdd(
						(conversations.data ?? []).map((row) =>
							toConversation(row, participantsByConversation.get(row.id as string) ?? [])
						)
					)
				]);
			}
		);

		// The re-read has just laid down the server's state: any earlier event is absorbed, and the kept
		// timestamps would only make the map grow.
		this.appliedAt.clear();

		this.state = 'idle';
		this.lastError = null;
		this.onPulled?.();
	}

	/** Records a write and tries to push it straight away. */
	async enqueue(entry: OutboxEntry) {
		// Callers do not await this promise — the data store calls it from synchronous methods. A full local
		// storage must therefore show on the banner rather than disappear: without this, the write is neither
		// sent nor reported.
		try {
			const added = db.outbox.add(entry);
			this.writing = this.writing.then(() => added.then(noop, noop));
			await added;
		} catch (cause) {
			this.state = 'error';
			this.lastError = describeError(cause);
			this.report(cause);
			return;
		}

		this.detach(this.flush());
	}

	/**
	 * Drains the queue in arrival order. Order matters: a list must exist before its items. A network
	 * failure stops the loop and leaves everything pending. A final refusal from the server, on the other
	 * hand, discards the write: keeping it would block the queue forever and the user would see nothing
	 * leave any more.
	 *
	 * `depuisRelecture` says the call comes from the re-read itself, which drains the queue before reading: it
	 * does not need a second one scheduled behind it.
	 */
	async flush(sinceReview = false) {
		if (!browser || !navigator.onLine) {
			this.state = 'offline';
			return;
		}

		await this.writing;

		const pending = await db.outbox.orderBy('seq').toArray();

		// The error that counts is this cycle's. By re-reading `this.state`, a final refusal from yesterday
		// left the banner in error forever, with a message describing a write already abandoned, while
		// everything else left normally.
		let rejected = false;
		let sent = 0;

		for (const entry of pending) {
			const query = supabase.from(entry.table as 'items');

			const { error } =
				entry.op === 'delete'
					? await query.delete().match(entry.match)
					: await query.upsert(entry.payload as never);

			if (error && !isPermanent(error.code)) {
				this.state = 'error';
				this.lastError = error.message;
				return;
			}

			if (error) {
				rejected = true;
				this.state = 'error';
				this.lastError = error.message;
			}

			sent += 1;
			await db.outbox.delete(entry.seq as number);
		}

		// Re-reading after a final refusal would be logical — the screen should show what the server really
		// has. Tried, and removed: every re-read empties the twelve tables and rewrites them, so it rebuilds
		// the whole DOM, and routine refusals were enough to make the list cards unclickable. To revisit when
		// the re-read reconciles by id instead of replacing everything (#95).
		if (rejected) return;

		this.state = 'idle';
		this.lastError = null;

		// A re-read that left before this send read a server that did not know these writes yet, and it
		// replaces the cache with what it read: the shop just created disappears from the screen although it
		// is properly saved. So we re-read once that one is done, with a server that knows everything.
		if (sent > 0 && !sinceReview) {
			this.detach(Promise.resolve(this.pulling).then(() => this.pull()));
		}
	}

	/**
	 * A change from another device lands straight in the cache when it comes from a table we know how to
	 * rebuild from its payload alone — see `realtime.ts`. Everything else still triggers the full re-read,
	 * deferred: our own writes come back through this channel too, and without the delay ticking an item
	 * would re-read the whole household on every checkbox.
	 */
	private listen() {
		if (this.channel || !this.householdId) return;

		// One channel for every circle, and not one per circle: the subscription filters nothing, RLS decides
		// what arrives. Naming it after the displayed circle would mean redoing it on every switch, to listen
		// to exactly the same thing.
		this.channel = supabase
			.channel('familist:changes')
			.on('postgres_changes', { event: '*', schema: 'public' }, (payload) =>
				this.detach(this.receive(payload))
			)
			.subscribe((status) => {
				if (status !== 'SUBSCRIBED') return;

				// A recovery after an outage leaves a hole: changes that happened during the absence are never
				// replayed, and no payload will come to describe them. Only a full re-read catches them up. The very
				// first subscription already follows a re-read.
				if (this.subscribed) this.schedulePull();
				this.subscribed = true;
			});
	}

	/**
	 * Applies a payload, or hands back to the full re-read.
	 *
	 * The decision is made by a pure function, tested separately. What is left here is what it cannot
	 * know: the state of the queue, the state of the cache, and the displayed household.
	 */
	private async receive(payload: Record<string, unknown>) {
		if (!this.householdId) return;

		const generation = this.generation;

		const event: RealtimeEvent = {
			table: String(payload.table ?? ''),
			eventType: String(payload.eventType ?? ''),
			commitTimestamp: String(payload.commit_timestamp ?? ''),
			new: payload.new as Record<string, unknown> | undefined,
			old: payload.old as Record<string, unknown> | undefined
		};

		// A local write still queued, or a re-read in flight, outranks the payload: applying it would erase
		// work the server does not know yet, or race a read whose age we do not know. In both cases the
		// re-read decides.
		const busy = this.pulling !== null || (await db.outbox.count()) > 0;

		/**
		 * The cache holds the lists of every circle, not only those of the displayed one: that is what makes
		 * this shortcut usable here. An item ticked in a circle nobody is looking at therefore lands directly,
		 * instead of falling back on the full re-read because its list would look unknown — and it is already
		 * right when you switch.
		 */
		const plan = planRealtime(event, {
			knownListIds: new Set((await db.lists.toCollection().primaryKeys()) as string[]),
			knownConversationIds: new Set(
				(await db.conversations.toCollection().primaryKeys()) as string[]
			),
			applied: this.appliedAt,
			busy
		});

		if (plan.kind === 'skip') return;

		if (plan.kind === 'pull') {
			this.schedulePull();
			return;
		}

		// The account may have changed during these reads, as in the re-read: writing now would put a row of
		// the old account into the new one's cache.
		if (this.generation !== generation) return;

		if (plan.kind === 'delete') {
			// Deleting an id absent from the cache does nothing: that is exactly what we want from a DELETE on a
			// row we never had.
			if (plan.table === 'items') await db.items.delete(plan.id);
			else await db.messages.delete(plan.id);
		} else if (plan.table === 'items') {
			await db.items.put(plan.row);
		} else {
			await db.messages.put(plan.row);
		}

		const id = plan.kind === 'delete' ? plan.id : plan.row.id;
		this.appliedAt.set(rowKey(event.table, id), event.commitTimestamp);

		this.onPulled?.();
	}

	private schedulePull() {
		if (this.pullTimer) clearTimeout(this.pullTimer);
		this.pullTimer = setTimeout(() => this.detach(this.pull()), 800);
	}
}

export const sync = new SyncStore();
