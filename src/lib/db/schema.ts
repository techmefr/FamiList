import Dexie, { type EntityTable } from 'dexie';
import type { CodeType } from '$domain/code-format';
import type { PriceEntry } from '$domain/price';
import type { CardShareStatus } from '$domain/card-share';
import type { DeviceVault, StoredSecret } from '$domain/offline-secret';

export interface Shop {
	id: string;
	/** The circle the shop belongs to. The cache holds several, the screen shows only one. */
	householdId: string;
	name: string;
	short: string;
	tint: string;
	dist?: string;
	/**
	 * The brand, when there is one. A hairdresser or a local butcher has none, and everything must work
	 * without it: the brand is what carries the loyalty card valid across the whole chain, and what opens
	 * the three-letter code.
	 */
	brand: string;
	/** As written, with no normalisation. Only the town is taken from it, for the three-letter code. */
	address: string;
	/**
	 * The point on the map, recorded on site from the device GPS. Absent until somebody does it: "not
	 * taken yet" and "off the coast of Africa" are not the same thing, hence the absence rather than
	 * zero.
	 */
	lat?: number;
	lng?: number;
	/**
	 * The shop the household did not create itself.
	 *
	 * A route always belongs to a shop — it is the key of `shop_layouts`. Without a shop, reordering its
	 * aisles therefore had nowhere to be written, and the arrows did nothing. Every household receives
	 * one, empty, from its first opening: you can sort your list before describing a single shop.
	 *
	 * The first real shop replaces it instead of being added beside it — the arrangement already done
	 * simply changes name. This flag says which one is replaceable.
	 */
	isDefault: boolean;
}

export interface Aisle {
	id: string;
	householdId: string;
	name: string;
	emoji: string;
	/**
	 * Reference order of the aisles, that of a shop not yet known. Without it, Dexie returns the aisles
	 * sorted by id, so in an alphabetical order matching no real shop.
	 */
	position: number;
	/**
	 * Reference category (fruit, bakery, …), target of automatic detection. Absent on a user-created
	 * aisle, which does not take part in detection.
	 */
	kind?: string;
}

export interface List {
	id: string;
	name: string;
	emoji: string;
	color: string;
	memberIds: string[];
	eventDate?: string;
	/**
	 * The circle the list is shared with, absent while it stays personal. Sharing a list means naming one
	 * — the `household_id` column is nullable on the server side for that reason.
	 */
	householdId?: string;
}

export interface Item {
	id: string;
	listId: string;
	aisleId: string;
	name: string;
	qty: string;
	unit: string;
	checked: boolean;
	priority: boolean;
	note?: string;
	assignedTo?: string;
	createdAt: number;
}

export interface LoyaltyCard {
	id: string;
	householdId: string;
	/** Attachment to a specific shop. Empty when the card is valid for a whole brand. */
	shopId: string;
	/** Attachment to a brand: a Carrefour card works in every Carrefour. */
	brand: string;
	name: string;
	num: string;
	code: string;
	codeType: CodeType;
	/** A second, shorter code some cards print — a PIN, a code asked for at the till — never the account. */
	secretCode?: string;
	websiteUrl?: string;
	points: number;
	tint: string;
	grad: string;
	notes?: string;
}

export interface Member {
	/**
	 * The (circle, person) pair. An account belonging to two circles has two memberships, with a role and
	 * a colour of its own in each: `id` alone therefore cannot be the key.
	 */
	key: string;
	/** The account. The same in every circle the person appears in. */
	id: string;
	householdId: string;
	/**
	 * The display name, the one the household sees. Free text: "Granny" and "Lulu" are valid answers, and
	 * that is why it is not enough to carry the identity on its own.
	 */
	name: string;
	/**
	 * First and last name, when the person filled them in from their profile. Empty otherwise — sign-up
	 * does not ask for them, and no account created before has them. They only serve to derive correct
	 * initials even when the display name is a nickname.
	 */
	firstName: string;
	lastName: string;
	role: string;
	initial: string;
	tint: string;
	/**
	 * The avatar, as a `data:` URL — a square 128px thumbnail, not the original photo.
	 *
	 * It travels in the profile row rather than in file storage: at that size it weighs a few kilobytes,
	 * it syncs with everything else with no second data path, and it stays readable offline like the rest
	 * of the household. Absent until somebody sets one — the initials then make the portrait.
	 */
	avatar?: string;
}

/** Route learned in a shop: the order of the aisles. Per user. */
export interface ShopLayout {
	shopId: string;
	aisleOrder: string[];
	learned: boolean;
}

/** Learned order of products within a shop's aisle, indexed by product slug. */
export interface ShopItemOrder {
	key: string;
	shopId: string;
	aisleId: string;
	productSlugs: string[];
}

/**
 * A recorded price, as it is kept on the device. The shape comes from the domain, which carries the
 * comparison between shops; only the person who recorded it is added here, and that only serves to fill
 * the matching column in the database.
 */
export interface Price extends PriceEntry {
	householdId: string;
	recordedBy: string;
}

/**
 * A message belongs to a list or to a direct conversation, never to both. The database enforces the same
 * constraint; here both fields are optional because TypeScript cannot say "exactly one", and reading them
 * case by case stays simpler than a union to unwrap everywhere.
 */
export interface Message {
	id: string;
	listId?: string;
	conversationId?: string;
	userId: string;
	body: string;
	isSystem: boolean;
	createdAt: number;
}

/**
 * A direct conversation, between two people and outside any circle.
 *
 * `participantIds` holds exactly two — the database guarantees it, and nobody can add themselves since no
 * write grant is given on these tables to the client.
 */
export interface Conversation {
	id: string;
	scope: 'direct';
	participantIds: string[];
	createdAt: number;
}

export type PollKind = 'date' | 'apport';

export interface Poll {
	id: string;
	messageId: string;
	kind: PollKind;
	question: string;
	closed: boolean;
}

export interface PollOption {
	id: string;
	pollId: string;
	label: string;
	emoji?: string;
	claimedBy?: string;
	/** What the person brings: these lines become items of the list. */
	ingredients: string[];
	position: number;
}

export interface PollVote {
	key: string;
	optionId: string;
	userId: string;
}

export const pollVoteKey = (optionId: string, userId: string) => `${optionId}::${userId}`;

/**
 * A household recipe: what we cook, and what a shopping list is drawn from.
 *
 * `servings` carries the number of servings the quantities are written for: it is what makes scaling
 * possible at generation time.
 */
export interface Recipe {
	id: string;
	householdId: string;
	name: string;
	emoji: string;
	servings: number;
	notes?: string;
	/** Path of the generated photo in the `recipe-photos` bucket, or none: the image is decorative only. */
	photoPath?: string;
	/** English description of the finished dish, sent to the image model instead of the bare name (#306). */
	imagePrompt?: string;
	createdBy?: string;
	createdAt: number;
}

/**
 * An ingredient line. Not to be confused with `PollOption.ingredients`, which says what somebody brings
 * to a shared meal: the two are unrelated, and nothing travels from one to the other.
 */
export interface RecipeIngredient {
	id: string;
	recipeId: string;
	name: string;
	/** Typed on a keyboard, so a string, like `Item.qty`. Empty when the recipe gives none. */
	qty: string;
	unit: string;
	position: number;
}

export interface RecipeStep {
	id: string;
	recipeId: string;
	body: string;
	position: number;
	/** The ingredient lines this step uses (#308). Empty for a step nobody linked: cook-along then shows them all. */
	ingredientIds: string[];
	/** How long the step takes, in seconds (#310). Absent for a step with no wait. */
	durationSeconds?: number;
}

/**
 * A recipe opened to another circle, without leaving its owning household.
 *
 * Unlike a list, a recipe is never reassigned: it keeps its own `householdId`, and each share is a row of
 * its own, so several circles can see it at once. Keyed like `PollVote` and `Member` — the pair
 * (recipe, household) has no single id of its own on this side.
 */
export interface RecipeShare {
	key: string;
	recipeId: string;
	householdId: string;
	sharedBy?: string;
	createdAt: number;
}

export const recipeShareKey = (recipeId: string, householdId: string) => `${recipeId}::${householdId}`;

/**
 * A card offered to another circle, visible there once a member of it accepts. Never carries the account
 * credentials: those are read on demand from `/cards/[id]/account` and never cached.
 */
export interface LoyaltyCardShare {
	key: string;
	cardId: string;
	householdId: string;
	status: CardShareStatus;
	sharedBy?: string;
	createdAt: number;
}

export const cardShareKey = (cardId: string, householdId: string) => `${cardId}::${householdId}`;

/**
 * A meal plan: several recipes picked together, so that one consolidated shopping list can be generated
 * from all of them at once instead of one per recipe. Like a recipe, generation from it copies into the
 * list rather than linking to it — see `generateMealPlanList`.
 */
export interface MealPlan {
	id: string;
	householdId: string;
	name: string;
	createdBy?: string;
	createdAt: number;
	updatedAt: number;
}

/**
 * A recipe's place inside a meal plan: how many people it is scaled for here (independently of the
 * recipe's own `servings` and of every other recipe in the plan), and where it sits in the week.
 */
export interface MealPlanRecipe {
	id: string;
	mealPlanId: string;
	recipeId: string;
	people: number;
	/** 0 (Monday) to 6 (Sunday), absent when the recipe has not been assigned a day yet. */
	dayIndex?: number;
	position: number;
}

/**
 * Someone the household plans meals around, whether or not they hold an account: a child, a guest, or an
 * adult already in `members` (via `linkedUserId`, so their allergy is not a second disconnected entity).
 */
export interface HouseholdPerson {
	id: string;
	householdId: string;
	name: string;
	createdBy?: string;
	linkedUserId?: string;
	dietaryNotes?: string;
	createdAt: number;
}

/**
 * A local write not yet confirmed by the server. This is what makes it possible to tick an item in a shop
 * with no network: the change leaves the queue as soon as the connection comes back.
 */
export interface OutboxEntry {
	seq?: number;
	table: string;
	op: 'upsert' | 'delete';
	/** Server-side primary key, an object because some tables have a composite key. */
	match: Record<string, string>;
	payload?: Record<string, unknown>;
}

/**
 * A write the server refused for good, kept until the person retries or lets it go.
 *
 * Dropped silently, the next re-read would replace the local row with the server's and the entry would vanish.
 */
export interface Rejection {
	key: string;
	table: string;
	op: OutboxEntry['op'];
	match: Record<string, string>;
	payload?: Record<string, unknown>;
	code: string;
	message: string;
	at: string;
}

export const itemOrderKey = (shopId: string, aisleId: string) => `${shopId}::${aisleId}`;

export const memberKey = (householdId: string, userId: string) => `${householdId}::${userId}`;

/** Aisles shipped with the application, in the order of a typical supermarket. */
export const REFERENCE_AISLE_ORDER = [
	'fruits',
	'boulangerie',
	'laitier',
	'viande',
	'epicerie',
	'maison'
];

class FamiListDatabase extends Dexie {
	shops!: EntityTable<Shop, 'id'>;
	aisles!: EntityTable<Aisle, 'id'>;
	lists!: EntityTable<List, 'id'>;
	items!: EntityTable<Item, 'id'>;
	cards!: EntityTable<LoyaltyCard, 'id'>;
	members!: EntityTable<Member, 'key'>;
	shopLayouts!: EntityTable<ShopLayout, 'shopId'>;
	shopItemOrders!: EntityTable<ShopItemOrder, 'key'>;
	outbox!: EntityTable<OutboxEntry, 'seq'>;
	messages!: EntityTable<Message, 'id'>;
	conversations!: EntityTable<Conversation, 'id'>;
	polls!: EntityTable<Poll, 'id'>;
	pollOptions!: EntityTable<PollOption, 'id'>;
	pollVotes!: EntityTable<PollVote, 'key'>;
	prices!: EntityTable<Price, 'id'>;
	recipes!: EntityTable<Recipe, 'id'>;
	recipeIngredients!: EntityTable<RecipeIngredient, 'id'>;
	recipeSteps!: EntityTable<RecipeStep, 'id'>;
	mealPlans!: EntityTable<MealPlan, 'id'>;
	mealPlanRecipes!: EntityTable<MealPlanRecipe, 'id'>;
	householdPersons!: EntityTable<HouseholdPerson, 'id'>;
	recipeShares!: EntityTable<RecipeShare, 'key'>;
	cardShares!: EntityTable<LoyaltyCardShare, 'key'>;
	cardSecrets!: EntityTable<StoredSecret, 'cardId'>;
	deviceVault!: EntityTable<DeviceVault, 'id'>;
	rejections!: EntityTable<Rejection, 'key'>;

	constructor() {
		super('familist');
		this.version(1).stores({
			shops: 'id',
			aisles: 'id',
			lists: 'id',
			items: 'id, listId, aisleId, [listId+aisleId]',
			cards: 'id, shopId',
			members: 'id',
			shopLayouts: 'shopId',
			shopItemOrders: 'key, shopId'
		});

		this.version(2)
			.stores({ aisles: 'id, position' })
			.upgrade((tx) =>
				tx
					.table<Aisle>('aisles')
					.toCollection()
					.modify((aisle, ref) => {
						const known = REFERENCE_AISLE_ORDER.indexOf(aisle.id);
						ref.value.position = known === -1 ? REFERENCE_AISLE_ORDER.length : known;
					})
			);

		this.version(3).stores({ outbox: '++seq' });

		this.version(4).stores({
			messages: 'id, listId, createdAt',
			polls: 'id, messageId',
			pollOptions: 'id, pollId',
			pollVotes: 'key, optionId'
		});

		// Indexed by slug: the history is queried per product, never by id.
		this.version(5).stores({ prices: 'id, productSlug, shopId' });

		// The two child tables are always queried by recipe, never by their own id: it is a whole recipe that
		// is shown or generated, not an isolated line.
		this.version(6).stores({
			recipes: 'id',
			recipeIngredients: 'id, recipeId',
			recipeSteps: 'id, recipeId'
		});

		/**
		 * The cache now holds every circle of the account at once, rather than a single one: each circle
		 * table therefore carries its `householdId`, and members change key — the same account appears once
		 * per circle.
		 *
		 * `members`'s primary key itself changes shape (`id` becomes `key`), and IndexedDB has no in-place
		 * way to do that: a store's keyPath is fixed at creation. Dropping it here and recreating it fresh
		 * in the next version is the only way Dexie supports the change — folding both into one `.stores()`
		 * call throws `UpgradeError: Not yet support for changing primary key` on every device whose local
		 * cache predates this version, which is exactly what shipped the first time around.
		 *
		 * The other affected tables are emptied rather than migrated row by row: they are fully re-read from
		 * the server on the first sync, and guessing a circle for rows that carried none would produce a
		 * wrong cache until then.
		 */
		this.version(7)
			.stores({ members: null })
			.upgrade(async (tx) => {
				await Promise.all(
					['shops', 'aisles', 'cards', 'prices', 'recipes'].map((name) => tx.table(name).clear())
				);
			});

		this.version(8).stores({ members: 'key, id, householdId' });

		// Messages are now also queried by conversation. The old `listId` index stays: a list keeps its
		// messages, only the direct scope is added beside it.
		this.version(9).stores({
			conversations: 'id',
			messages: 'id, listId, conversationId, createdAt'
		});

		// Like the recipe child tables, meal_plan_recipes is always queried by its plan, never by its own id.
		this.version(10).stores({
			mealPlans: 'id',
			mealPlanRecipes: 'id, mealPlanId'
		});

		// Queried per household, like the other circle tables.
		this.version(11).stores({ householdPersons: 'id, householdId' });

		// New table, safe to add alongside an existing `.stores()` call: only changing an EXISTING table's
		// primary key in one call is the forbidden pattern (see version 7). Queried both by recipe (does this
		// one carry a share) and by household (what was shared into this circle).
		this.version(12).stores({ recipeShares: 'key, recipeId, householdId' });

		this.version(13).stores({
			cardShares: 'key, cardId, householdId',
			cardSecrets: 'cardId',
			deviceVault: 'id'
		});

		this.version(14).stores({ rejections: 'key, at' });

		// Steps cached before #308 carry no ingredient link: they get an empty one rather than `undefined`,
		// so every reader can rely on the array being there.
		this.version(15)
			.stores({})
			.upgrade(async (tx) => {
				await tx
					.table('recipeSteps')
					.toCollection()
					.modify((step: Partial<RecipeStep>) => {
						step.ingredientIds ??= [];
					});
			});
	}
}

export const db = new FamiListDatabase();
