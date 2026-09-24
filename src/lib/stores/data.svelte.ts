import { browser } from '$app/environment';
import {
	db,
	itemOrderKey,
	pollVoteKey,
	type Aisle,
	type Conversation,
	type Item,
	type List,
	type LoyaltyCard,
	type LoyaltyCardShare,
	type Member,
	type Message,
	type Poll,
	type PollKind,
	type PollOption,
	type PollVote,
	type Price,
	type Recipe,
	type RecipeIngredient,
	type RecipeShare,
	type RecipeStep,
	recipeShareKey,
	type MealPlan,
	type MealPlanRecipe,
	type HouseholdPerson,
	type Shop,
	type ShopItemOrder,
	type ShopLayout
} from '$db/schema';
import { supabase } from '$db/supabase';
import { initialsFor } from '$domain/avatar';
import { accountDecision } from '$domain/account-switch';
import { guessAisleKind, FALLBACK_AISLE_KIND } from '$domain/guess-aisle';
import { PendingWrites } from '$domain/pending-writes';
import { groupByAisle, learnedItemOrder } from '$domain/aisle-order';
import { defaultCircle, ofCircle, resolveAisle, visibleLists, visibleRecipes } from '$domain/circle';
import { shareStatusOf, visibleCards } from '$domain/card-share';
import { session } from '$stores/session.svelte';
import { sync } from '$sync/index.svelte';
import {
	fromAisle,
	fromCard,
	fromItem,
	fromItemOrder,
	fromLayout,
	fromList,
	fromMessage,
	fromPoll,
	fromPollOption,
	fromPrice,
	fromRecipe,
	fromRecipeIngredient,
	fromRecipeShare,
	fromRecipeStep,
	fromMealPlan,
	fromMealPlanRecipe,
	fromHouseholdPerson,
	fromShop
} from '$sync/mapping';
import { copiedItem, copyName } from '$domain/duplicate';
import { directSummaries, otherParticipant } from '$domain/direct-conversation';
import { slugify } from '$domain/slug';
import {
	compareShops,
	currencyForLocale,
	latestAt,
	parseAmount,
	pricedProducts,
	sameDay
} from '$domain/price';
import {
	DEFAULT_SERVINGS,
	MAX_SERVINGS,
	generatedItems,
	scalingFactor,
	type RecipeLine
} from '$domain/recipe';
import { generatedItemsForPlan } from '$domain/meal-plan';
import { trigram } from '$domain/trigram';
import { trigramSource } from '$domain/place';
import { DEFAULT_UNIT } from '$domain/units';
import { TINTS } from '$domain/tint';
import { i18n, t } from '$i18n/index.svelte';

/**
 * The active shop is remembered per circle: shops belong to a circle, and a single key for all of
 * them would fall back to whatever shop came first on every switch.
 */
const activeShopKey = (circle: string) => `familist:active-shop:${circle}`;

/** The key from before multiple circles, read one last time so the current choice is not lost. */
const LEGACY_ACTIVE_SHOP_KEY = 'familist:active-shop';

/**
 * The last twelve digits of the default shop's id; the first twenty-four characters come from the
 * household's id. The whole stays a valid UUID, and above all it is the same on every device of the
 * household — two simultaneous openings do not create two shops.
 */
const DEFAULT_SHOP_NODE = 'd0defa017000';

/**
 * The screen never reads Dexie directly: it reads this state, written by methods that persist in
 * the background. No interaction waits on disk or network — you tick an item while walking, the
 * sync follows.
 */
class DataStore {
	/**
	 * The full cache: every circle of the account. The screen does not read it directly — it reads the
	 * derived views just below, which show only the active circle.
	 */
	private cachedShops = $state<Shop[]>([]);
	private cachedAisles = $state<Aisle[]>([]);
	private cachedLists = $state<List[]>([]);
	private cachedCards = $state<LoyaltyCard[]>([]);
	private cachedMembers = $state<Member[]>([]);
	private cachedPrices = $state<Price[]>([]);
	private cachedRecipes = $state<Recipe[]>([]);
	private cachedMealPlans = $state<MealPlan[]>([]);
	private cachedHouseholdPersons = $state<HouseholdPerson[]>([]);

	// What is read per list, per shop or per recipe is not filtered here: the foreign key already does
	// it, and those tables have no circle of their own.
	items = $state<Item[]>([]);
	layouts = $state<ShopLayout[]>([]);
	itemOrders = $state<ShopItemOrder[]>([]);
	messages = $state<Message[]>([]);
	conversations = $state<Conversation[]>([]);
	polls = $state<Poll[]>([]);
	pollOptions = $state<PollOption[]>([]);
	pollVotes = $state<PollVote[]>([]);
	recipeIngredients = $state<RecipeIngredient[]>([]);
	recipeSteps = $state<RecipeStep[]>([]);
	recipeShares = $state<RecipeShare[]>([]);
	cardShares = $state<LoyaltyCardShare[]>([]);
	mealPlanRecipes = $state<MealPlanRecipe[]>([]);

	activeShopId = $state<string>('');
	ready = $state(false);

	/** The active circle — the one being looked at, and the one new things land in. */
	circle = $derived(sync.householdId ?? '');

	/** The circles to switch between. With a single circle, the selector has nothing to offer. */
	circles = $derived(sync.circles);

	shops = $derived(ofCircle(this.cachedShops, this.circle));
	aisles = $derived(ofCircle(this.cachedAisles, this.circle));
	cards = $derived(visibleCards(this.cachedCards, this.cardShares, this.circle));
	members = $derived(ofCircle(this.cachedMembers, this.circle));
	prices = $derived(ofCircle(this.cachedPrices, this.circle));
	recipes = $derived(visibleRecipes(this.cachedRecipes, this.recipeShares, this.circle));
	mealPlans = $derived(ofCircle(this.cachedMealPlans, this.circle));
	householdPersons = $derived(ofCircle(this.cachedHouseholdPersons, this.circle));
	lists = $derived(visibleLists(this.cachedLists, this.circle));

	activeShop = $derived(this.shops.find((s) => s.id === this.activeShopId) ?? this.shops[0]);
	activeLayout = $derived(this.layouts.find((l) => l.shopId === this.activeShopId));

	/** The active circle's aisles, to decide whether an item's aisle makes sense there. */
	private knownAisleIds = $derived(new Set(this.aisles.map((aisle) => aisle.id)));

	// The id is read asynchronously, after the first render: without reactive state, everything derived
	// from `me` — the name field, the avatar picker — would stay computed on the empty string and would
	// never find its own member.
	private userId = $state('');
	private userIdKnown = false;

	/**
	 * Tracks Dexie writes still in flight — see `$domain/pending-writes`. A mutator updates the in-memory
	 * cache synchronously and writes to Dexie without awaiting it; `hydrate()` re-reads the whole table on
	 * every sync round-trip and would otherwise wholesale-clobber a write that has not landed yet. Only
	 * `addCard` reports through it for now — see `hydrate()`'s `cachedCards` guard for why wiring the other
	 * mutators is cheap here but not on the `hydrate()` side.
	 */
	#pendingWrites = new PendingWrites();

	async load() {
		if (!browser) return;

		const { data, error } = await supabase.auth.getUser();
		const answer = { id: data.user?.id ?? '', failed: !!error };

		// Switching account on the same device must start everything over. Without this comparison, the
		// previous account's cache would stay on screen: one person's lists shown to another. An error
		// response, on the other hand, says nothing about identity and decides nothing.
		if (this.ready) {
			const decision = accountDecision({ id: this.userId, known: this.userIdKnown }, answer);
			if (decision === 'ignore') return;

			this.userId = answer.id;
			this.userIdKnown = true;
			if (decision === 'reload') await this.reload();
			return;
		}

		if (!answer.failed) {
			this.userId = answer.id;
			this.userIdKnown = true;
		}

		// The cache is shown first, the sync replaces it afterwards. Offline, or while the server answers,
		// the application stays usable.
		await this.hydrate();
		this.ready = true;

		// The default shop is created after the sync, never before: on a new device the cache is empty, and
		// creating it right away would make a second one beside the one the household already owns.
		await sync.start(() => {
			void this.hydrate().then(() => this.ensureDefaultShop());
		});
	}

	private async hydrate() {
		const [
			shops,
			aisles,
			lists,
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
			recipeShares,
			cardShares,
			mealPlans,
			mealPlanRecipes,
			householdPersons,
			conversations
		] = await Promise.all([
			db.shops.toArray(),
			db.aisles.orderBy('position').toArray(),
			db.lists.toArray(),
			db.items.toArray(),
			db.cards.toArray(),
			db.members.toArray(),
			db.shopLayouts.toArray(),
			db.shopItemOrders.toArray(),
			db.messages.toArray(),
			db.polls.toArray(),
			db.pollOptions.toArray(),
			db.pollVotes.toArray(),
			db.prices.toArray(),
			db.recipes.toArray(),
			db.recipeIngredients.toArray(),
			db.recipeSteps.toArray(),
			db.recipeShares.toArray(),
			db.cardShares.toArray(),
			db.mealPlans.toArray(),
			db.mealPlanRecipes.toArray(),
			db.householdPersons.toArray(),
			db.conversations.toArray()
		]);

		this.cachedShops = shops;
		this.cachedAisles = aisles;
		this.cachedLists = lists;
		this.items = items;

		// `addCard` writes to Dexie without awaiting it, so a card can be in-memory-visible while its write is
		// still on its way. If a write is still in flight, this read of `db.cards` may have missed it — replacing
		// `cachedCards` now would clobber the optimistic card until some later cycle picks it up. Skipping this
		// cycle costs nothing: `hydrate()` runs again on the next sync round-trip, by which point the write has
		// settled and the read will see it.
		if (this.#pendingWrites.count === 0) {
			this.cachedCards = cards;
			void db.cardSecrets
				.where('cardId')
				.noneOf(cards.map((card) => card.id))
				.delete();
		}

		this.cachedMembers = members;
		this.layouts = layouts;
		this.itemOrders = itemOrders;
		this.messages = messages;
		this.polls = polls;
		this.pollOptions = pollOptions;
		this.pollVotes = pollVotes;
		this.cachedPrices = prices;
		this.cachedRecipes = recipes;
		this.recipeIngredients = recipeIngredients;
		this.recipeSteps = recipeSteps;
		this.recipeShares = recipeShares;
		this.cardShares = cardShares;
		this.cachedMealPlans = mealPlans;
		this.mealPlanRecipes = mealPlanRecipes;
		this.cachedHouseholdPersons = householdPersons;
		this.conversations = conversations;

		this.restoreActiveShop();
	}

	/**
	 * The active shop of the circle being looked at.
	 *
	 * Re-read on hydration and on every switch: a shop belongs to a circle, and keeping the neighbour's
	 * would let the screen sort the list along a route that does not exist here.
	 */
	private restoreActiveShop() {
		const mine = this.shops;
		const saved =
			localStorage.getItem(activeShopKey(this.circle)) ??
			localStorage.getItem(LEGACY_ACTIVE_SHOP_KEY);
		const known = saved && mine.some((s) => s.id === saved) ? saved : (mine[0]?.id ?? '');
		if (known !== this.activeShopId) this.activeShopId = known;
	}

	/**
	 * Circle switch.
	 *
	 * Nothing is re-read and nothing is emptied: the cache already holds every circle, only the slice
	 * the screen shows changes. That is what makes the switch instant, offline included. The active shop
	 * follows, and the circle gets its default shop if it has none yet.
	 */
	switchCircle(circleId: string) {
		if (!circleId || circleId === this.circle) return;
		if (!this.circles.some((circle) => circle.id === circleId)) return;

		sync.adopt(circleId);
		this.restoreActiveShop();
		this.ensureDefaultShop();
	}

	aisle(id: string) {
		return this.aisles.find((a) => a.id === id);
	}

	/**
	 * Detection reasons in categories; aisles carry an id of their own, per household. We translate
	 * here. A household whose starting aisles were deleted has no category left to offer: the item then
	 * goes into the first aisle, never into nothing.
	 */
	suggestAisleId(name: string) {
		const kind = guessAisleKind(name);
		const byKind = this.aisles.find((a) => a.kind === kind);
		const fallback = this.aisles.find((a) => a.kind === FALLBACK_AISLE_KIND);

		return byKind?.id ?? fallback?.id ?? this.aisles[0]?.id ?? '';
	}

	/**
	 * A list by id, taken from the whole cache and not from the displayed slice alone: a received link
	 * or a notification may point at a list in another circle, and the detail screen must open it rather
	 * than conclude it does not exist.
	 */
	list(id: string) {
		return this.cachedLists.find((l) => l.id === id);
	}

	itemsOf(listId: string) {
		return this.items.filter((i) => i.listId === listId);
	}

	/** The list grouped and ordered along the active shop's learned route. */
	groupedItems(listId: string) {
		const order = this.activeLayout?.aisleOrder ?? this.aisles.map((a) => a.id);
		const byAisle: Record<string, string[]> = {};

		for (const entry of this.itemOrders) {
			if (entry.shopId === this.activeShopId) byAisle[entry.aisleId] = entry.productSlugs;
		}

		// A personal list follows its author from one circle to another, but its items' aisle belongs to the
		// circle they were typed in: elsewhere, it sits where detection would put it. Nothing is rewritten —
		// coming back finds the original arrangement.
		const range = this.itemsOf(listId).map((item) => ({
			...item,
			aisleId: resolveAisle(item.aisleId, this.knownAisleIds, this.suggestAisleId(item.name))
		}));

		return groupByAisle(range, order, byAisle);
	}

	setActiveShop(shopId: string) {
		this.activeShopId = shopId;
		if (browser) localStorage.setItem(activeShopKey(this.circle), shopId);
	}

	toggleItem(id: string) {
		const item = this.items.find((i) => i.id === id);
		if (!item) return;

		item.checked = !item.checked;
		db.items.update(id, { checked: item.checked });
		this.push('items', $state.snapshot(item), fromItem);
	}

	addItem(
		listId: string,
		input: { name: string; qty: string; unit: string; aisleId?: string; note?: string }
	) {
		const item: Item = {
			id: crypto.randomUUID(),
			listId,
			aisleId: input.aisleId || this.suggestAisleId(input.name),
			name: input.name.trim(),
			qty: input.qty || '1',
			unit: input.unit || DEFAULT_UNIT,
			checked: false,
			priority: false,
			note: input.note?.trim() || undefined,
			createdAt: Date.now()
		};

		this.items = [...this.items, item];
		db.items.add(item);
		this.push('items', item, fromItem);
		return item;
	}

	/**
	 * Editing an item afterwards: the typo, the quantity you reconsider in front of the aisle, the detail
	 * you add — "the big bottle", "sugar free".
	 *
	 * A cleared note becomes absent again rather than an empty string: the display tests the note's
	 * presence to decide on the dash before it.
	 */
	updateItem(
		id: string,
		patch: { name?: string; qty?: string; unit?: string; aisleId?: string; note?: string }
	) {
		const item = this.items.find((candidate) => candidate.id === id);
		if (!item) return;

		if (patch.name !== undefined) item.name = patch.name.trim();
		if (patch.qty !== undefined) item.qty = patch.qty || '1';
		if (patch.unit !== undefined) item.unit = patch.unit || DEFAULT_UNIT;
		if (patch.aisleId !== undefined) item.aisleId = patch.aisleId;
		if (patch.note !== undefined) item.note = patch.note.trim() || undefined;

		const snapshot = $state.snapshot(item) as Item;
		db.items.put(snapshot);
		this.push('items', snapshot, fromItem);
	}

	removeItem(id: string) {
		this.items = this.items.filter((i) => i.id !== id);
		db.items.delete(id);
		sync.enqueue({ table: 'items', op: 'delete', match: { id } });
	}

	togglePriority(id: string) {
		const item = this.items.find((i) => i.id === id);
		if (!item) return;

		item.priority = !item.priority;
		db.items.update(id, { priority: item.priority });
		this.push('items', $state.snapshot(item), fromItem);
	}

	clearChecked(listId: string) {
		const removed = this.items.filter((i) => i.listId === listId && i.checked).map((i) => i.id);
		this.items = this.items.filter((i) => !removed.includes(i.id));
		db.items.bulkDelete(removed);
		removed.forEach((id) => sync.enqueue({ table: 'items', op: 'delete', match: { id } }));
		return removed.length;
	}

	addList(input: { name: string; emoji: string; color: string; eventDate?: string }) {
		const list: List = {
			id: crypto.randomUUID(),
			name: input.name.trim(),
			emoji: input.emoji,
			color: input.color,
			eventDate: input.eventDate || undefined,
			// A list is born personal: it has no circle, and its author is its only member. The
			// `lists_share_with_household` trigger does the same on the database side; we write it here too so
			// the display is right before the first sync.
			memberIds: this.userId ? [this.userId] : []
		};

		this.cachedLists = [...this.cachedLists, list];
		db.lists.add(list);
		this.push('lists', list, fromList);

		if (this.userId) {
			sync.enqueue({
				table: 'list_members',
				op: 'upsert',
				match: { list_id: list.id, user_id: this.userId },
				payload: { list_id: list.id, user_id: this.userId }
			});
		}

		return list;
	}

	/**
	 * Renaming a list, changing its emoji, setting or clearing its date.
	 *
	 * The three go together because they are corrected together: "Grocries" is read again a week later,
	 * the emoji picked in a hurry at creation says nothing once the list is full, and the meal planned for
	 * Saturday moves to Sunday.
	 */
	updateList(id: string, patch: { name?: string; emoji?: string; eventDate?: string }) {
		const list = this.cachedLists.find((candidate) => candidate.id === id);
		if (!list) return;

		if (patch.name !== undefined) list.name = patch.name.trim();
		if (patch.emoji !== undefined) list.emoji = patch.emoji;
		// A cleared field removes the date: it is the only gesture available to cancel a reminder.
		if (patch.eventDate !== undefined) list.eventDate = patch.eventDate || undefined;

		const snapshot = $state.snapshot(list) as List;
		db.lists.put(snapshot);
		this.push('lists', snapshot, fromList);
	}

	/**
	 * Opens or closes a list to someone.
	 *
	 * The row in `list_members` is the key: `can_access_list` leans on it, and everything belonging to the
	 * list — items, conversation, polls — follows. Removing someone really puts them out, and they cannot
	 * put themselves back.
	 *
	 * Opening a personal list to someone is sharing it, and sharing requires naming a circle. Without one
	 * the database would refuse the row — `list_belongs_to_household_of` accepts, on a list with no circle,
	 * only its own author.
	 *
	 * The circle is now said by the caller: since an account has several on screen at once, taking the one
	 * being looked at would share with colleagues a list you were opening to family. With nothing given,
	 * the active circle stays the default — which is the case of an account that only has one.
	 */
	setListMember(listId: string, userId: string, member: boolean, circleId?: string) {
		const list = this.cachedLists.find((l) => l.id === listId);
		if (!list) return;

		const memberIds = member
			? [...new Set([...list.memberIds, userId])]
			: list.memberIds.filter((id) => id !== userId);

		const shared = member && !list.householdId && userId !== this.userId;
		const cercle = shared ? (circleId ?? this.circle) : list.householdId;

		// Sharing into a circle you are not a member of is refused by RLS: we do not even queue it, rather
		// than let the queue discard it silently.
		if (shared && !this.circles.some((candidate) => candidate.id === cercle)) return;

		const next = { ...list, memberIds, householdId: cercle || undefined };
		this.cachedLists = this.cachedLists.map((l) => (l.id === listId ? next : l));
		db.lists.put(next);

		if (shared && cercle) this.push('lists', next, fromList);

		sync.enqueue(
			member
				? {
						table: 'list_members',
						op: 'upsert',
						match: { list_id: listId, user_id: userId },
						payload: { list_id: listId, user_id: userId }
					}
				: { table: 'list_members', op: 'delete', match: { list_id: listId, user_id: userId } }
		);
	}

	/**
	 * Redoing a list that comes back: the weekly shop, Sunday's meal.
	 *
	 * The copy takes the original's appearance — emoji, colour — and its sharing: a private list stays
	 * private, a list open to the household stays open. Copying `memberIds` rather than starting from the
	 * whole household as `addList` does is what stops a birthday list from showing up for the person
	 * concerned.
	 *
	 * The event date does not follow: it dated an occasion now past, and carrying it over would show a meal
	 * already had on a list still to come.
	 *
	 * The aisle order is not copied because it does not belong to the list: it lives in the active shop's
	 * route, so the copy sorts itself.
	 *
	 * Nothing special for the network: every row leaves through the same queue as if it had been typed,
	 * which makes duplication usable offline like the rest.
	 */
	duplicateList(id: string) {
		const source = this.cachedLists.find((candidate) => candidate.id === id);
		if (!source) return;

		const copied: List = {
			id: crypto.randomUUID(),
			name: copyName(
				source.name,
				this.cachedLists.map((l) => l.name)
			),
			emoji: source.emoji,
			color: source.color,
			memberIds: [...source.memberIds],
			householdId: source.householdId
		};

		const articles: Item[] = this.itemsOf(id).map((item, rank) => ({
			...copiedItem(item),
			id: crypto.randomUUID(),
			listId: copied.id,
			// The rank preserves the original's entry order: two items created in the same millisecond were
			// otherwise separated at random on re-read.
			createdAt: Date.now() + rank
		}));

		this.cachedLists = [...this.cachedLists, copied];
		this.items = [...this.items, ...articles];
		db.lists.add(copied);
		db.items.bulkAdd(articles);

		this.push('lists', copied, fromList);
		for (const article of articles) this.push('items', article, fromItem);

		// The original's sharing is replayed row by row. A list is now born open to its author alone: there is
		// nothing left to close behind the insert, only to reopen to the people the source knew.
		for (const member of copied.memberIds) {
			if (member === this.userId) continue;
			sync.enqueue({
				table: 'list_members',
				op: 'upsert',
				match: { list_id: copied.id, user_id: member },
				payload: { list_id: copied.id, user_id: member }
			});
		}

		return copied;
	}

	removeList(id: string) {
		const items = this.itemsOf(id).map((i) => i.id);
		this.cachedLists = this.cachedLists.filter((l) => l.id !== id);
		this.items = this.items.filter((i) => i.listId !== id);
		db.lists.delete(id);
		db.items.bulkDelete(items);

		// Items go with the list on the server side (on delete cascade): a single deletion to push.
		sync.enqueue({ table: 'lists', op: 'delete', match: { id } });
	}

	addAisle(input: { name: string; emoji: string }) {
		const aisle: Aisle = {
			id: crypto.randomUUID(),
			householdId: this.circle,
			name: input.name.trim(),
			emoji: input.emoji || '🛒',
			position: Math.max(-1, ...this.aisles.map((a) => a.position)) + 1
		};

		this.cachedAisles = [...this.cachedAisles, aisle];
		db.aisles.add(aisle);
		this.push('aisles', aisle, fromAisle);

		// An aisle created afterwards is appended to every route: it appears, even if it is not in the right
		// place until the user moves it.
		this.layouts = this.layouts.map((layout) => ({
			...layout,
			aisleOrder: [...layout.aisleOrder, aisle.id]
		}));

		for (const layout of this.layouts) {
			const snapshot = $state.snapshot(layout) as ShopLayout;
			db.shopLayouts.put(snapshot);
			this.pushLayout(snapshot);
		}

		return aisle;
	}

	/**
	 * The household's default shop, the one nobody created.
	 *
	 * It exists for a technical reason that became a reason of use: a route always belongs to a shop, so
	 * with no shop there was nothing to reorder. It makes it possible to sort your list from the first
	 * opening, before describing a single shop.
	 */
	get defaultShop() {
		return this.shops.find((shop) => shop.isDefault);
	}

	/**
	 * Creates it if missing, once the household is known.
	 *
	 * Its id is derived from the household's rather than drawn at random: two phones opening the
	 * application at the same time on a fresh household then aim at the same row, and the household ends
	 * up with one default shop, not two. A unique index in the database plays the same role, for what the
	 * client cannot guarantee.
	 */
	ensureDefaultShop() {
		const household = this.circle;
		if (!household || this.shops.length > 0) return;

		this.addShop({
			id: `${household.slice(0, 24)}${DEFAULT_SHOP_NODE}`,
			name: t('shops.defaultName'),
			short: '',
			tint: TINTS[0],
			isDefault: true
		});
	}

	/**
	 * Adding a shop — except the very first real one, which replaces the default shop instead of being
	 * added beside it.
	 *
	 * Replacing and not deleting then recreating: the learned route points at the shop's id, and the
	 * arrangement already done under "My shop" is exactly what we want to keep. It changes name, nothing
	 * more.
	 */
	addShop(input: {
		name: string;
		short: string;
		tint: string;
		brand?: string;
		address?: string;
		lat?: number;
		lng?: number;
		id?: string;
		isDefault?: boolean;
	}) {
		const brand = (input.brand ?? '').trim();
		const address = (input.address ?? '').trim();
		const replacement = !input.isDefault ? this.defaultShop : undefined;

		// An absent position stays absent: writing `lat: undefined` would erase the one a replaced shop
		// already had, and would give the key to a shop that has none.
		const position =
			input.lat !== undefined && input.lng !== undefined
				? { lat: input.lat, lng: input.lng }
				: {};

		if (replacement) {
			this.updateShop(replacement.id, {
				name: input.name.trim(),
				short: this.proposedShort(
					{ brand, name: input.name, address },
					replacement.id,
					input.short
				),
				tint: input.tint,
				brand,
				address,
				isDefault: false,
				...position
			});

			this.setActiveShop(replacement.id);
			return this.shops.find((shop) => shop.id === replacement.id)!;
		}

		const shop: Shop = {
			id: input.id ?? crypto.randomUUID(),
			householdId: this.circle,
			name: input.name.trim(),
			// One shop, one three-letter code: anything already carried by another shop of the household is set
			// aside, typed by hand as much as computed. The computation starts from the brand and the town rather
			// than from the name — see $domain/place.
			short: trigram(
				input.short.trim() || trigramSource({ brand, name: input.name, address }),
				this.shops.map((existing) => existing.short)
			),
			tint: input.tint,
			brand,
			address,
			isDefault: input.isDefault ?? false,
			...position
		};

		const layout: ShopLayout = {
			shopId: shop.id,
			aisleOrder: this.aisles.map((a) => a.id),
			learned: false
		};

		this.cachedShops = [...this.cachedShops, shop];
		this.layouts = [...this.layouts, layout];
		db.shops.add(shop);
		db.shopLayouts.add(layout);
		this.push('shops', shop, fromShop);
		this.pushLayout(layout);
		this.setActiveShop(shop.id);

		return shop;
	}

	/**
	 * Editing a shop: the address completed afterwards, the position taken on site, the three-letter code
	 * recomputed.
	 *
	 * The code is never recomputed on its own here. Changing a shop's address must not change, under your
	 * eyes, the badge you have learned to recognise: it is an explicit gesture, asked for from the screen.
	 */
	updateShop(id: string, patch: Partial<Omit<Shop, 'id'>>) {
		const shop = this.shops.find((candidate) => candidate.id === id);
		if (!shop) return;

		Object.assign(shop, patch);

		const snapshot = $state.snapshot(shop) as Shop;
		db.shops.put(snapshot);
		this.push('shops', snapshot, fromShop);
	}

	/**
	 * Deleting a shop, and with it the route learned there.
	 *
	 * The server cascades the layout and the item order away, and detaches loyalty cards without losing
	 * them (`on delete set null`): a card outlives the shop, it is the attachment that disappears. The
	 * local cache does the same on its side, straight away, so the screen does not show a half-gone shop
	 * while waiting for the sync.
	 *
	 * The default shop is recreated on its own if that was the last one: a route always belongs to a shop,
	 * and ending up with none would leave the lists unsorted.
	 */
	removeShop(id: string) {
		const shop = this.shops.find((candidate) => candidate.id === id);
		if (!shop) return;

		const orders = this.itemOrders.filter((entry) => entry.shopId === id).map((entry) => entry.key);

		this.cachedShops = this.cachedShops.filter((candidate) => candidate.id !== id);
		this.layouts = this.layouts.filter((layout) => layout.shopId !== id);
		this.itemOrders = this.itemOrders.filter((entry) => entry.shopId !== id);
		this.cachedCards = this.cachedCards.map((card) =>
			card.shopId === id ? { ...card, shopId: '' } : card
		);

		db.shops.delete(id);
		db.shopLayouts.delete(id);
		db.shopItemOrders.bulkDelete(orders);
		db.cards.bulkPut($state.snapshot(this.cachedCards) as LoyaltyCard[]);

		sync.enqueue({ table: 'shops', op: 'delete', match: { id } });

		if (this.activeShopId === id) this.setActiveShop(this.shops[0]?.id ?? '');
	}

	/**
	 * The three-letter code free for this shop, another household shop's code not counting as taken by
	 * itself — otherwise recomputing without changing anything would give a different code.
	 */
	proposedShort(
		place: { brand?: string; name: string; address?: string },
		exceptId?: string,
		typed = ''
	) {
		return trigram(
			typed.trim() || trigramSource(place),
			this.shops
				.filter((existing) => existing.id !== exceptId)
				.map((existing) => existing.short)
		);
	}

	addCard(input: Omit<LoyaltyCard, 'id' | 'householdId'>) {
		const card: LoyaltyCard = { ...input, id: crypto.randomUUID(), householdId: this.circle };
		this.cachedCards = [...this.cachedCards, card];
		void this.#pendingWrites.track(db.cards.add(card));
		this.push('loyalty_cards', card, fromCard);
		return card;
	}

	updateCard(id: string, patch: Partial<Omit<LoyaltyCard, 'id' | 'householdId'>>) {
		const card = this.cachedCards.find((c) => c.id === id);
		if (!card) return;

		Object.assign(card, patch);

		const snapshot = $state.snapshot(card) as LoyaltyCard;
		db.cards.put(snapshot);
		this.push('loyalty_cards', snapshot, fromCard);
	}

	/** A card shared into this circle is read here, never rewritten: only its own household edits it. */
	isOwnCard(card: LoyaltyCard) {
		return card.householdId === this.circle;
	}

	cardShareStatus(cardId: string, householdId: string) {
		return shareStatusOf(this.cardShares, cardId, householdId);
	}

	removeCard(id: string) {
		this.cachedCards = this.cachedCards.filter((c) => c.id !== id);
		db.cards.delete(id);
		db.cardSecrets.delete(id);
		sync.enqueue({ table: 'loyalty_cards', op: 'delete', match: { id } });
	}

	/**
	 * Dragging aisles: marks the shop as learned.
	 *
	 * Leaving with no active shop is a guard rather than a common case: every household has one since
	 * `ensureDefaultShop`. It long made the arrows and the dragging inert — rendered, clickable, with no
	 * effect and no message.
	 */
	reorderAisles(aisleOrder: string[]) {
		if (!this.activeShopId) return;

		const layout: ShopLayout = { shopId: this.activeShopId, aisleOrder, learned: true };
		this.layouts = [...this.layouts.filter((l) => l.shopId !== this.activeShopId), layout];
		db.shopLayouts.put(layout);
		this.pushLayout(layout);
	}

	/** Dragging products inside an aisle: remembered by slug, not by id. */
	reorderItems(aisleId: string, items: Item[]) {
		if (!this.activeShopId) return;

		const entry: ShopItemOrder = {
			key: itemOrderKey(this.activeShopId, aisleId),
			shopId: this.activeShopId,
			aisleId,
			productSlugs: learnedItemOrder(items)
		};

		this.itemOrders = [...this.itemOrders.filter((o) => o.key !== entry.key), entry];
		db.shopItemOrders.put(entry);

		if (!this.userId) return;
		sync.enqueue({
			table: 'shop_item_orders',
			op: 'upsert',
			match: { shop_id: entry.shopId, user_id: this.userId, aisle_id: entry.aisleId },
			payload: fromItemOrder(entry, this.userId)
		});
	}

	/**
	 * A product's price, recorded at the moment it goes into the trolley.
	 *
	 * That is the only minute when somebody knows the price: the label is in front of them, and the item
	 * has just been ticked. Asking at add time — often the day before, on the sofa — would be asking them
	 * to guess, and asking after the trip would mean reopening every row from memory. The field therefore
	 * only appears on a ticked item, and it stays optional: a whole shop can be done without filling a
	 * single one.
	 *
	 * The shop is the active one — the one whose route already sorts the list. A list belongs to no shop;
	 * it is the selector at the bottom of the screen that says where you are.
	 *
	 * A second record of the same product, in the same shop, on the same day, replaces the previous one
	 * instead of adding to it: it is a typo correction, not a price change. Clearing the field erases that
	 * day's record, for the same reason.
	 */
	setItemPrice(item: Item, raw: string) {
		const shopId = this.activeShopId;
		if (!shopId) return;

		const slug = slugify(item.name);
		if (!slug) return;

		const amount = parseAmount(raw);
		const existing = latestAt(this.prices, slug, shopId);
		const ofToday = existing && sameDay(existing.recordedAt, Date.now()) ? existing : null;

		if (amount === null) {
			if (ofToday) this.removePrice(ofToday.id);
			return;
		}

		const price: Price = {
			id: ofToday?.id ?? crypto.randomUUID(),
			householdId: this.circle,
			shopId,
			productSlug: slug,
			productName: item.name,
			amount,
			// The currency never changes on an existing record: yesterday's stays yesterday's, even if the
			// application has changed language since.
			currency: ofToday?.currency ?? currencyForLocale(i18n.locale),
			recordedAt: Date.now(),
			recordedBy: this.userId
		};

		this.cachedPrices = [...this.cachedPrices.filter((p) => p.id !== price.id), price];
		db.prices.put(price);
		this.push('item_prices', price, fromPrice);
	}

	removePrice(id: string) {
		this.cachedPrices = this.cachedPrices.filter((p) => p.id !== id);
		db.prices.delete(id);
		sync.enqueue({ table: 'item_prices', op: 'delete', match: { id } });
	}

	/** The latest known price of this product in the active shop, the one the field shows again. */
	priceOf(item: Item) {
		if (!this.activeShopId) return null;
		return latestAt(this.prices, slugify(item.name), this.activeShopId);
	}

	/** The shops where this product was recorded, cheapest first. */
	priceComparison(slug: string) {
		return compareShops(this.prices, slug);
	}

	get pricedProducts() {
		return pricedProducts(this.prices);
	}

	messagesOf(listId: string) {
		return this.messages
			.filter((m) => m.listId === listId)
			.sort((a, b) => a.createdAt - b.createdAt);
	}

	/** My direct conversations, the most recently active first. */
	get directs() {
		return directSummaries(this.conversations, this.messages, this.me);
	}

	direct(conversationId: string) {
		return this.conversations.find((c) => c.id === conversationId);
	}

	/**
	 * The people a direct conversation can be opened with: those in a shared circle, minus yourself and
	 * those already being written to. The circle only serves as a directory here — the conversation itself
	 * will not depend on it.
	 */
	get directCandidates() {
		const alreadySeen = new Set(this.directs.map((d) => d.otherId));

		// A person appears once per shared circle: without this pass, someone met in two circles would show up
		// twice. That is precisely the ambiguity a direct conversation sidesteps — it belongs to neither — and
		// the list of people to write to should say so: one account, one entry.
		const seen = new Set<string>();

		return this.cachedMembers.filter((m) => {
			if (m.id === this.me || alreadySeen.has(m.id) || seen.has(m.id)) return false;

			seen.add(m.id);
			return true;
		});
	}

	messagesOfConversation(conversationId: string) {
		return this.messages
			.filter((m) => m.conversationId === conversationId)
			.sort((a, b) => a.createdAt - b.createdAt);
	}

	otherOf(conversationId: string) {
		const conversation = this.direct(conversationId);
		if (!conversation) return undefined;

		const otherId = otherParticipant(conversation, this.me);

		return otherId ? this.member(otherId) : undefined;
	}

	pollOf(messageId: string) {
		return this.polls.find((p) => p.messageId === messageId);
	}

	optionsOf(pollId: string) {
		return this.pollOptions
			.filter((o) => o.pollId === pollId)
			.sort((a, b) => a.position - b.position);
	}

	votersOf(optionId: string) {
		return this.pollVotes.filter((v) => v.optionId === optionId).map((v) => v.userId);
	}

	/**
	 * Your own avatar.
	 *
	 * The write does not go through the outbox: that one does `upsert`s, and nobody is allowed to insert a
	 * row into `profiles` — a trigger creates it at sign-up. A direct update, as for the appearance
	 * settings.
	 *
	 * The screen is served first, the server afterwards: changing your photo must show at once, and the
	 * next sync will confirm.
	 */
	async setMyAvatar(avatar: string | undefined) {
		const id = this.me;
		if (!id) return;

		// The avatar belongs to the profile, not to the membership: it changes in every circle the person
		// appears in, and the cache holds one row per circle.
		const mine = this.cachedMembers.filter((m) => m.id === id);
		if (mine.length === 0) return;

		const updated = mine.map((member) => ({ ...member, avatar }));
		this.cachedMembers = this.cachedMembers.map(
			(m) => updated.find((next) => next.key === m.key) ?? m
		);
		db.members.bulkPut(updated);

		await supabase
			.from('profiles')
			.update({ avatar: avatar ?? '' })
			.eq('id', id);
	}

	/**
	 * Changes your identity: first name, last name, and display name.
	 *
	 * The three go together, in one write — they are typed in the same form, and saving only the display
	 * name would leave initials taken from a stale first name.
	 *
	 * The initials follow on their own: they are computed on every read, the `initial` column no longer
	 * being looked at. The display name is also written into the account metadata, where sign-up put it, so
	 * the two do not drift apart.
	 */
	async setMyName(identity: { name: string; firstName: string; lastName: string }) {
		const id = this.me;
		if (!id) return;

		const mine = this.cachedMembers.filter((m) => m.id === id);
		if (mine.length === 0) return;

		const { name, firstName, lastName } = identity;
		const updated: Member[] = mine.map((member) => ({
			...member,
			name,
			firstName,
			lastName,
			initial: initialsFor(firstName, lastName, name)
		}));
		const replacement = (rows: Member[]) =>
			this.cachedMembers.map((m) => rows.find((row) => row.key === m.key) ?? m);

		this.cachedMembers = replacement(updated);
		db.members.bulkPut(updated);

		const { error } = await supabase
			.from('profiles')
			.update({ display_name: name, first_name: firstName, last_name: lastName })
			.eq('id', id);
		if (error) {
			// The display name goes back to what the database knows: leaving it on screen would suggest a save that
			// did not happen, until the next sync.
			this.cachedMembers = replacement(mine);
			db.members.bulkPut(mine);
			return error.message;
		}

		await supabase.auth.updateUser({ data: { display_name: name } });
		return null;
	}

	member(id: string) {
		// The whole cache and not the active circle alone: a personal list shared elsewhere, or a conversation
		// opened from a link, shows faces that are not from here.
		return this.cachedMembers.find((m) => m.id === id);
	}

	/** The members of a given circle — the one you are about to share into, for instance. */
	membersOf(circleId: string) {
		return ofCircle(this.cachedMembers, circleId);
	}

	circleName(circleId: string) {
		return this.circles.find((circle) => circle.id === circleId)?.name ?? '';
	}

	/**
	 * The connected account, as the session knows it.
	 *
	 * `userId` is only a copy of it, set by `load()`. Between a sign-out followed by a sign-in on another
	 * account and the re-read that follows, that copy still describes the previous one — the screen then
	 * names the wrong person, and above all a direct message leaves signed by somebody else. The database
	 * refuses it, rightly: it requires the author to be the connected account. The message was lost with
	 * nothing to say so.
	 *
	 * The session, on the other hand, is updated by `onAuthStateChange`, at the instant of the change. We
	 * therefore read it first, and `userId` is now only a fallback for when the session has not answered
	 * yet — on the very first render, or offline.
	 */
	get me() {
		return session.user?.id ?? this.userId;
	}

	sendMessage(listId: string, body: string) {
		const message: Message = {
			id: crypto.randomUUID(),
			listId,
			userId: this.userId,
			body: body.trim(),
			isSystem: false,
			createdAt: Date.now()
		};

		this.messages = [...this.messages, message];
		db.messages.add(message);
		this.push('messages', message, fromMessage);
		return message;
	}

	/**
	 * Opens — or finds again — the direct conversation with someone.
	 *
	 * The client's only write on these tables, and it goes through a function: nobody is allowed to insert
	 * a conversation or a participant, which is what guarantees you cannot invite yourself into somebody
	 * else's. Nothing is therefore put into the cache ahead of time — the screen waits for the server, as
	 * for sending an avatar.
	 */
	async startDirect(otherId: string) {
		const me = this.me;
		if (!me || otherId === me) return null;

		const { data: conversationId, error } = await supabase.rpc('start_direct_conversation', {
			other: otherId
		});
		if (error || typeof conversationId !== 'string') return null;

		// The conversation may have just been born: without it in the cache, the thread being opened would be
		// empty and the full re-read would only arrive afterwards.
		const conversation: Conversation = {
			id: conversationId,
			scope: 'direct',
			participantIds: [me, otherId],
			createdAt: Date.now()
		};

		this.conversations = [
			...this.conversations.filter((c) => c.id !== conversationId),
			conversation
		];
		await db.conversations.put(conversation);

		return conversationId;
	}

	/**
	 * A direct message carries no list: it is the other scope column that attaches it, and the database
	 * refuses it carrying both.
	 */
	async sendDirectMessage(conversationId: string, body: string) {
		const message: Message = {
			id: crypto.randomUUID(),
			conversationId,
			userId: this.me,
			body: body.trim(),
			isSystem: false,
			createdAt: Date.now()
		};

		this.messages = [...this.messages, message];
		db.messages.add(message);

		// `push` stamps the write with the row's circle, and waits for a circle to exist before queueing
		// anything. A direct conversation has none by construction: the wait therefore ran to its end, five
		// seconds later, and a sign-out in that window took the message away.
		//
		// The await is on the queueing, not on the server: the screen already has the message, but a sign-out
		// just after the click must find the write in the queue rather than an empty one.
		await sync.enqueue({
			table: 'messages',
			op: 'upsert',
			match: { id: message.id },
			payload: fromMessage(message)
		});

		return message;
	}

	/**
	 * A poll is carried by a message: it appears in the thread in its place, and disappears with it.
	 * Message, poll and options leave in that order — the queue would replay them as such after an outage,
	 * and an option with no poll would be refused.
	 */
	createPoll(
		listId: string,
		kind: PollKind,
		question: string,
		labels: { label: string; emoji?: string }[]
	) {
		const message = this.sendMessage(listId, '');
		const poll: Poll = {
			id: crypto.randomUUID(),
			messageId: message.id,
			kind,
			question: question.trim(),
			closed: false
		};

		this.polls = [...this.polls, poll];
		db.polls.add(poll);
		this.push('polls', poll, fromPoll);

		const options: PollOption[] = labels
			.filter((entry) => entry.label.trim())
			.map((entry, position) => ({
				id: crypto.randomUUID(),
				pollId: poll.id,
				label: entry.label.trim(),
				emoji: entry.emoji,
				ingredients: [],
				position
			}));

		this.pollOptions = [...this.pollOptions, ...options];
		options.forEach((option) => {
			db.pollOptions.add(option);
			this.push('poll_options', option, fromPollOption);
		});

		return poll;
	}

	/** One vote per poll: voting elsewhere removes the previous vote. */
	toggleVote(pollId: string, optionId: string) {
		if (!this.userId) return;

		const mine = this.optionsOf(pollId)
			.map((option) => pollVoteKey(option.id, this.userId))
			.filter((key) => this.pollVotes.some((vote) => vote.key === key));

		const target = pollVoteKey(optionId, this.userId);
		const removing = mine.includes(target);

		for (const key of mine) {
			const vote = this.pollVotes.find((v) => v.key === key);
			if (!vote) continue;

			db.pollVotes.delete(key);
			sync.enqueue({
				table: 'poll_votes',
				op: 'delete',
				match: { option_id: vote.optionId, user_id: this.userId }
			});
		}

		this.pollVotes = this.pollVotes.filter((v) => !mine.includes(v.key));

		if (removing) return;

		const vote: PollVote = { key: target, optionId, userId: this.userId };
		this.pollVotes = [...this.pollVotes, vote];
		db.pollVotes.put(vote);
		sync.enqueue({
			table: 'poll_votes',
			op: 'upsert',
			match: { option_id: optionId, user_id: this.userId },
			payload: { option_id: optionId, user_id: this.userId }
		});
	}

	/** "Who brings what": you take a share, or release it if you had taken it. */
	toggleClaim(optionId: string) {
		const option = this.pollOptions.find((o) => o.id === optionId);
		if (!option || !this.userId) return;

		// A share already taken by somebody else cannot be stolen: they have to release it.
		if (option.claimedBy && option.claimedBy !== this.userId) return;

		option.claimedBy = option.claimedBy === this.userId ? undefined : this.userId;

		const snapshot = $state.snapshot(option) as PollOption;
		db.pollOptions.put(snapshot);
		this.push('poll_options', snapshot, fromPollOption);
	}

	setIngredients(optionId: string, ingredients: string[]) {
		const option = this.pollOptions.find((o) => o.id === optionId);
		if (!option) return;

		option.ingredients = ingredients.map((line) => line.trim()).filter(Boolean);

		const snapshot = $state.snapshot(option) as PollOption;
		db.pollOptions.put(snapshot);
		this.push('poll_options', snapshot, fromPollOption);
	}

	/**
	 * Pours into the list what a person committed to bring. Items already there are not added a second
	 * time: the same share is often pushed again after being completed.
	 */
	pushIngredients(listId: string, optionId: string) {
		const option = this.pollOptions.find((o) => o.id === optionId);
		if (!option) return 0;

		const existing = new Set(this.itemsOf(listId).map((item) => slugify(item.name)));
		const fresh = option.ingredients.filter((name) => !existing.has(slugify(name)));

		for (const name of fresh) {
			const item = this.addItem(listId, { name, qty: '1', unit: DEFAULT_UNIT });
			if (option.claimedBy) this.assignItem(item.id, option.claimedBy);
		}

		return fresh.length;
	}

	assignItem(id: string, userId: string) {
		const item = this.items.find((i) => i.id === id);
		if (!item) return;

		item.assignedTo = userId;
		this.push('items', $state.snapshot(item), fromItem);
		db.items.update(id, { assignedTo: userId });
	}

	setEventDate(listId: string, eventDate: string) {
		const list = this.cachedLists.find((l) => l.id === listId);
		if (!list) return;

		list.eventDate = eventDate;

		const snapshot = $state.snapshot(list) as List;
		db.lists.put(snapshot);
		this.push('lists', snapshot, fromList);
	}

	recipe(id: string) {
		return this.recipes.find((r) => r.id === id);
	}

	/** A recipe's lines, in the order they were typed. */
	ingredientsOf(recipeId: string) {
		return this.recipeIngredients
			.filter((line) => line.recipeId === recipeId)
			.toSorted((a, b) => a.position - b.position);
	}

	stepsOf(recipeId: string) {
		return this.recipeSteps
			.filter((step) => step.recipeId === recipeId)
			.toSorted((a, b) => a.position - b.position);
	}

	/**
	 * A recipe, with its ingredients and its steps, written in one gesture.
	 *
	 * The three tables go into the queue in this order: the recipe first, its lines after. The queue is
	 * drained in arrival order, and the server-side foreign keys would refuse a line whose recipe does not
	 * exist yet.
	 *
	 * Nameless lines are dropped here rather than on screen: a form always offers one empty row more than
	 * what has been filled, and saving it would produce ghost ingredients turning up in the shopping list.
	 */
	addRecipe(input: {
		name: string;
		emoji: string;
		servings: number;
		notes?: string;
		ingredients: RecipeLine[];
		steps: string[];
	}) {
		const recipe: Recipe = {
			id: crypto.randomUUID(),
			householdId: this.circle,
			name: input.name.trim(),
			emoji: input.emoji,
			servings:
				input.servings > 0 ? Math.min(MAX_SERVINGS, Math.round(input.servings)) : DEFAULT_SERVINGS,
			notes: input.notes?.trim() || undefined,
			createdBy: this.userId || undefined,
			createdAt: Date.now()
		};

		const rows: RecipeIngredient[] = input.ingredients
			.filter((line) => line.name.trim())
			.map((line, position) => ({
				id: crypto.randomUUID(),
				recipeId: recipe.id,
				name: line.name.trim(),
				qty: line.qty.trim(),
				unit: line.unit || DEFAULT_UNIT,
				position
			}));

		const steps: RecipeStep[] = input.steps
			.filter((body) => body.trim())
			.map((body, position) => ({
				id: crypto.randomUUID(),
				recipeId: recipe.id,
				body: body.trim(),
				position
			}));

		this.cachedRecipes = [...this.cachedRecipes, recipe];
		this.recipeIngredients = [...this.recipeIngredients, ...rows];
		this.recipeSteps = [...this.recipeSteps, ...steps];

		db.recipes.add(recipe);
		db.recipeIngredients.bulkAdd(rows);
		db.recipeSteps.bulkAdd(steps);

		this.push('recipes', recipe, fromRecipe);
		for (const row of rows) this.push('recipe_ingredients', row, fromRecipeIngredient);
		for (const step of steps) this.push('recipe_steps', step, fromRecipeStep);

		return recipe;
	}

	/**
	 * Rewrites a recipe in place: its own fields, plus a full replacement of its ingredients and steps.
	 *
	 * The lines and steps are not diffed against what was there before — they are deleted and rewritten
	 * whole, the same way `addRecipe` builds them from the form's state in the first place. The form already
	 * holds the complete list at save time, so there is no partial information to reconcile, and a diff
	 * would only add complexity for no benefit the person could see.
	 */
	updateRecipe(
		id: string,
		input: {
			name: string;
			emoji: string;
			servings: number;
			notes?: string;
			ingredients: RecipeLine[];
			steps: string[];
		}
	) {
		const recipe = this.cachedRecipes.find((r) => r.id === id);
		if (!recipe) return;

		recipe.name = input.name.trim();
		recipe.emoji = input.emoji;
		recipe.servings =
			input.servings > 0 ? Math.min(MAX_SERVINGS, Math.round(input.servings)) : DEFAULT_SERVINGS;
		recipe.notes = input.notes?.trim() || undefined;

		const oldRows = this.recipeIngredients.filter((line) => line.recipeId === id).map((l) => l.id);
		const oldSteps = this.recipeSteps.filter((step) => step.recipeId === id).map((s) => s.id);

		const rows: RecipeIngredient[] = input.ingredients
			.filter((line) => line.name.trim())
			.map((line, position) => ({
				id: crypto.randomUUID(),
				recipeId: id,
				name: line.name.trim(),
				qty: line.qty.trim(),
				unit: line.unit || DEFAULT_UNIT,
				position
			}));

		const steps: RecipeStep[] = input.steps
			.filter((body) => body.trim())
			.map((body, position) => ({
				id: crypto.randomUUID(),
				recipeId: id,
				body: body.trim(),
				position
			}));

		this.recipeIngredients = [
			...this.recipeIngredients.filter((line) => line.recipeId !== id),
			...rows
		];
		this.recipeSteps = [...this.recipeSteps.filter((step) => step.recipeId !== id), ...steps];

		const snapshot = $state.snapshot(recipe) as Recipe;
		db.recipes.put(snapshot);
		db.recipeIngredients.bulkDelete(oldRows);
		db.recipeSteps.bulkDelete(oldSteps);
		db.recipeIngredients.bulkAdd(rows);
		db.recipeSteps.bulkAdd(steps);

		this.push('recipes', snapshot, fromRecipe);
		for (const rowId of oldRows) sync.enqueue({ table: 'recipe_ingredients', op: 'delete', match: { id: rowId } });
		for (const stepId of oldSteps) sync.enqueue({ table: 'recipe_steps', op: 'delete', match: { id: stepId } });
		for (const row of rows) this.push('recipe_ingredients', row, fromRecipeIngredient);
		for (const step of steps) this.push('recipe_steps', step, fromRecipeStep);
	}

	/**
	 * Attaches a generated photo to a recipe, or clears it on failure.
	 *
	 * The image is decorative, never data: this call never blocks saving the recipe itself, and a missing or
	 * failed photo simply leaves `photoPath` unset — the card then shows exactly what it shows today.
	 */
	setRecipePhoto(id: string, photoPath: string | undefined) {
		const recipe = this.cachedRecipes.find((r) => r.id === id);
		if (!recipe) return;

		recipe.photoPath = photoPath;

		const snapshot = $state.snapshot(recipe) as Recipe;
		db.recipes.put(snapshot);
		this.push('recipes', snapshot, fromRecipe);
	}

	/**
	 * The server deletes the lines and the steps itself — `on delete cascade` on the recipe. We therefore
	 * only queue the recipe, and empty the local cache by hand so the screen is right before the next
	 * re-read.
	 */
	removeRecipe(id: string) {
		const rows = this.recipeIngredients.filter((line) => line.recipeId === id).map((l) => l.id);
		const steps = this.recipeSteps.filter((step) => step.recipeId === id).map((s) => s.id);

		this.cachedRecipes = this.cachedRecipes.filter((r) => r.id !== id);
		this.recipeIngredients = this.recipeIngredients.filter((line) => line.recipeId !== id);
		this.recipeSteps = this.recipeSteps.filter((step) => step.recipeId !== id);

		db.recipes.delete(id);
		db.recipeIngredients.bulkDelete(rows);
		db.recipeSteps.bulkDelete(steps);
		sync.enqueue({ table: 'recipes', op: 'delete', match: { id } });
	}

	/** The circles a recipe was shared into, besides its own. */
	sharesOf(recipeId: string) {
		return this.recipeShares.filter((share) => share.recipeId === recipeId);
	}

	/**
	 * Opens a recipe to another circle, without moving it there.
	 *
	 * Unlike `setListMember`, this never touches `householdId`: the recipe keeps its owner, and the row
	 * added to `recipe_shares` is the only thing that changes. RLS refuses the insert to anyone outside the
	 * owning household, so a caller in a shared-into circle simply has nothing to gain from calling this —
	 * the UI does not offer the entry point there in the first place.
	 */
	shareRecipe(recipeId: string, householdId: string) {
		const key = recipeShareKey(recipeId, householdId);
		if (this.recipeShares.some((share) => share.key === key)) return;

		const share: RecipeShare = {
			key,
			recipeId,
			householdId,
			sharedBy: this.me || undefined,
			createdAt: Date.now()
		};

		this.recipeShares = [...this.recipeShares, share];
		db.recipeShares.put(share);
		sync.enqueue({
			table: 'recipe_shares',
			op: 'upsert',
			match: { recipe_id: recipeId, household_id: householdId },
			payload: fromRecipeShare(share)
		});
	}

	/** Withdraws a share: the receiving circle loses the recipe, the owning one keeps it untouched. */
	unshareRecipe(recipeId: string, householdId: string) {
		const key = recipeShareKey(recipeId, householdId);
		this.recipeShares = this.recipeShares.filter((share) => share.key !== key);
		db.recipeShares.delete(key);
		sync.enqueue({
			table: 'recipe_shares',
			op: 'delete',
			match: { recipe_id: recipeId, household_id: householdId }
		});
	}

	/**
	 * A recipe's shopping list, for a given number of servings.
	 *
	 * It is a copy, not a link. Items born here then live their own life — you tick them, correct "big
	 * bottle" in front of the aisle, delete some — and the recipe goes on with its own. A live link would
	 * mean a correction to the recipe rewrites a shop in progress, and that deleting the recipe empties the
	 * list. `pushIngredients`, the only precedent in the codebase, copies for the same reasons.
	 *
	 * With no target list, one is created named after the recipe: that is the common case — you decide to
	 * cook this, you go and buy what it takes. With a target list, the ingredients join the weekly shop
	 * without overwriting what is already there.
	 *
	 * The aisle is not decided here: `addItem` guesses each item's aisle from its name, so the generated
	 * list arrives sorted along the active shop's route, as if it had been typed by hand.
	 */
	generateList(recipeId: string, people: number, targetListId?: string) {
		const recipe = this.recipe(recipeId);
		if (!recipe) return null;

		const target = targetListId ? this.list(targetListId) : null;
		const list =
			target ??
			this.addList({
				name: recipe.name,
				emoji: recipe.emoji,
				color: TINTS[this.cachedLists.length % TINTS.length]
			});

		const articles = generatedItems(
			this.ingredientsOf(recipeId),
			scalingFactor(recipe.servings, people),
			this.itemsOf(list.id).map((item) => item.name)
		);

		for (const article of articles) this.addItem(list.id, article);

		return { listId: list.id, added: articles.length };
	}

	mealPlan(id: string) {
		return this.mealPlans.find((p) => p.id === id);
	}

	/** A plan's recipes, in the order they were added or arranged. */
	recipesInPlan(mealPlanId: string) {
		return this.mealPlanRecipes
			.filter((entry) => entry.mealPlanId === mealPlanId)
			.toSorted((a, b) => a.position - b.position);
	}

	/**
	 * A new, empty meal plan. Recipes are picked into it afterwards, one gesture at a time — see
	 * `addRecipeToPlan` — rather than all at once here, so the same picking screen also serves an existing
	 * plan being edited.
	 */
	addMealPlan(name: string) {
		const plan: MealPlan = {
			id: crypto.randomUUID(),
			householdId: this.circle,
			name: name.trim() || 'Menu de la semaine',
			createdBy: this.userId || undefined,
			createdAt: Date.now(),
			updatedAt: Date.now()
		};

		this.cachedMealPlans = [...this.cachedMealPlans, plan];
		db.mealPlans.add(plan);
		this.push('meal_plans', plan, fromMealPlan);

		return plan;
	}

	renameMealPlan(id: string, name: string) {
		const plan = this.cachedMealPlans.find((p) => p.id === id);
		if (!plan) return;

		plan.name = name.trim() || plan.name;
		plan.updatedAt = Date.now();

		const snapshot = $state.snapshot(plan) as MealPlan;
		db.mealPlans.put(snapshot);
		this.push('meal_plans', snapshot, fromMealPlan);
	}

	/**
	 * The server deletes `meal_plan_recipes` itself — `on delete cascade` on the plan, exactly like a
	 * recipe's own children.
	 */
	removeMealPlan(id: string) {
		const entries = this.mealPlanRecipes.filter((entry) => entry.mealPlanId === id).map((e) => e.id);

		this.cachedMealPlans = this.cachedMealPlans.filter((p) => p.id !== id);
		this.mealPlanRecipes = this.mealPlanRecipes.filter((entry) => entry.mealPlanId !== id);

		db.mealPlans.delete(id);
		db.mealPlanRecipes.bulkDelete(entries);
		sync.enqueue({ table: 'meal_plans', op: 'delete', match: { id } });
	}

	/**
	 * Adds a recipe to a plan, scaled for the given number of people — independent from that recipe's own
	 * `servings` and from every other recipe already in the plan. A recipe already present is not
	 * duplicated: its servings and day are updated in place instead, since picking it again almost always
	 * means "no, actually cook this many" rather than "cook it twice".
	 */
	addRecipeToPlan(mealPlanId: string, recipeId: string, people: number, dayIndex?: number) {
		const already = this.mealPlanRecipes.find(
			(entry) => entry.mealPlanId === mealPlanId && entry.recipeId === recipeId
		);
		if (already) {
			this.updateMealPlanRecipe(already.id, { people, dayIndex });
			return already;
		}

		const entry: MealPlanRecipe = {
			id: crypto.randomUUID(),
			mealPlanId,
			recipeId,
			people: people > 0 ? Math.min(MAX_SERVINGS, Math.round(people)) : DEFAULT_SERVINGS,
			dayIndex,
			position: this.recipesInPlan(mealPlanId).length
		};

		this.mealPlanRecipes = [...this.mealPlanRecipes, entry];
		db.mealPlanRecipes.add(entry);
		this.push('meal_plan_recipes', entry, fromMealPlanRecipe);

		return entry;
	}

	updateMealPlanRecipe(id: string, changes: { people?: number; dayIndex?: number | null }) {
		const entry = this.mealPlanRecipes.find((e) => e.id === id);
		if (!entry) return;

		if (changes.people !== undefined && changes.people > 0)
			entry.people = Math.min(MAX_SERVINGS, Math.round(changes.people));
		if (changes.dayIndex !== undefined) entry.dayIndex = changes.dayIndex ?? undefined;

		const snapshot = $state.snapshot(entry) as MealPlanRecipe;
		db.mealPlanRecipes.put(snapshot);
		this.push('meal_plan_recipes', snapshot, fromMealPlanRecipe);
	}

	removeRecipeFromPlan(id: string) {
		this.mealPlanRecipes = this.mealPlanRecipes.filter((entry) => entry.id !== id);
		db.mealPlanRecipes.delete(id);
		sync.enqueue({ table: 'meal_plan_recipes', op: 'delete', match: { id } });
	}

	/**
	 * A person the household plans meals around, account or not. `linkedUserId` is set when this row
	 * stands for an existing member — see `HouseholdPerson` for why an adult's allergy is not a second,
	 * disconnected entity from their `household_members` row.
	 */
	addHouseholdPerson(input: { name: string; dietaryNotes?: string; linkedUserId?: string }) {
		const person: HouseholdPerson = {
			id: crypto.randomUUID(),
			householdId: this.circle,
			name: input.name.trim(),
			createdBy: this.userId || undefined,
			linkedUserId: input.linkedUserId,
			dietaryNotes: input.dietaryNotes?.trim() || undefined,
			createdAt: Date.now()
		};

		this.cachedHouseholdPersons = [...this.cachedHouseholdPersons, person];
		db.householdPersons.add(person);
		this.push('household_persons', person, fromHouseholdPerson);

		return person;
	}

	updateHouseholdPerson(id: string, changes: { name?: string; dietaryNotes?: string }) {
		const person = this.cachedHouseholdPersons.find((p) => p.id === id);
		if (!person) return;

		if (changes.name !== undefined && changes.name.trim()) person.name = changes.name.trim();
		if (changes.dietaryNotes !== undefined)
			person.dietaryNotes = changes.dietaryNotes.trim() || undefined;

		const snapshot = $state.snapshot(person) as HouseholdPerson;
		db.householdPersons.put(snapshot);
		this.push('household_persons', snapshot, fromHouseholdPerson);
	}

	removeHouseholdPerson(id: string) {
		this.cachedHouseholdPersons = this.cachedHouseholdPersons.filter((p) => p.id !== id);
		db.householdPersons.delete(id);
		sync.enqueue({ table: 'household_persons', op: 'delete', match: { id } });
	}

	/**
	 * The whole plan's shopping list, in one gesture: every recipe it holds, each already scaled by its own
	 * `people`, merged into a single set of items — see `generatedItemsForPlan` for the merge rule.
	 *
	 * Same copy-not-link philosophy as `generateList`: with no target list, a new one is created named
	 * after the plan.
	 */
	generateMealPlanList(mealPlanId: string, targetListId?: string) {
		const plan = this.mealPlan(mealPlanId);
		if (!plan) return null;

		const entries = this.recipesInPlan(mealPlanId);
		const sources = entries
			.map((entry) => {
				const recipe = this.recipe(entry.recipeId);
				if (!recipe) return null;

				return {
					lines: this.ingredientsOf(recipe.id),
					factor: scalingFactor(recipe.servings, entry.people)
				};
			})
			.filter((source) => source !== null);

		const target = targetListId ? this.list(targetListId) : null;
		const list =
			target ??
			this.addList({
				name: plan.name,
				emoji: '🗓️',
				color: TINTS[this.cachedLists.length % TINTS.length]
			});

		const articles = generatedItemsForPlan(
			sources,
			this.itemsOf(list.id).map((item) => item.name)
		);

		for (const article of articles) this.addItem(list.id, article);

		return { listId: list.id, added: articles.length };
	}

	/**
	 * The household tables all take the same path: we write the whole row, and the server-side upsert takes
	 * care of knowing whether it already existed.
	 */
	private push<T extends { id: string; householdId?: string }>(
		table: string,
		record: T,
		map: (record: T, householdId: string) => Record<string, unknown>
	) {
		const enqueue = (householdId: string) =>
			sync.enqueue({
				table,
				op: 'upsert',
				match: { id: record.id },
				payload: map(record, householdId)
			});

		// The row's own circle comes before the displayed circle: a card or a price being edited belongs to the
		// circle it was born in, and rewriting it with the one being looked at would move it at the first
		// correction.
		const known = record.householdId || this.circle;
		if (known) {
			enqueue(known);
			return;
		}

		/**
		 * The household is not provisioned yet — first opening, or an account change in progress. Stamping the
		 * row with an empty string, which is what we used to do, produced a final refusal from Postgres
		 * ("invalid input syntax for type uuid"): the queue discarded the write silently, and the shop just
		 * created disappeared from the screen at the next re-read, for good.
		 *
		 * So we wait for the id. If it cannot be obtained, nothing is queued: an empty queue and an error
		 * banner are better than a write leaving to be refused.
		 */
		void sync.whenHousehold().then((householdId) => {
			if (householdId) enqueue(householdId);
		});
	}

	private pushLayout(layout: ShopLayout) {
		if (!this.userId) return;
		sync.enqueue({
			table: 'shop_layouts',
			op: 'upsert',
			match: { shop_id: layout.shopId, user_id: this.userId },
			payload: fromLayout(layout, this.userId)
		});
	}

	/**
	 * The account or the household changed: the cache describes the previous one, nothing of it must
	 * remain. We start again from the server rather than sort through it — somebody else's lists shown here
	 * would be incomprehensible at best, indiscreet at worst.
	 */
	async reload() {
		sync.stop();
		await this.clearCache();
		await this.hydrate();
		await sync.start(() => void this.hydrate());
	}

	/**
	 * On sign-out there is no account any more: we empty without asking the server anything.
	 *
	 * The queue goes with the account that filled it. `signOut` drains it first; what is left here could not
	 * leave — offline, or server unreachable. Keeping it would not save it: the next attempt would use the
	 * next account's token, and the database refuses writes on somebody else's behalf.
	 */
	async forget() {
		sync.stop();
		await db.outbox.clear();
		this.ready = false;
		this.userId = '';
		this.userIdKnown = false;
		await this.clearCache();
		await this.hydrate();
	}

	private async clearCache() {
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
			db.recipeShares.clear(),
			db.cardShares.clear(),
			db.cardSecrets.clear(),
			db.deviceVault.clear(),
			db.mealPlans.clear(),
			db.mealPlanRecipes.clear(),
			db.conversations.clear()
		]);

		for (const circle of sync.householdIds) localStorage.removeItem(activeShopKey(circle));
		localStorage.removeItem(LEGACY_ACTIVE_SHOP_KEY);
	}

	async reset() {
		sync.stop();
		await db.delete();
		location.reload();
	}
}

export const data = new DataStore();
