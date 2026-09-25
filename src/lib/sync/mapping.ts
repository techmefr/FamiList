import type {
	Aisle,
	Conversation,
	Item,
	List,
	LoyaltyCard,
	LoyaltyCardShare,
	Member,
	Message,
	Poll,
	PollOption,
	PollVote,
	Price,
	Recipe,
	RecipeIngredient,
	RecipeShare,
	RecipeStep,
	MealPlan,
	MealPlanRecipe,
	HouseholdPerson,
	Shop,
	ShopItemOrder,
	ShopLayout
} from '$db/schema';
import { cardShareKey, itemOrderKey, memberKey, pollVoteKey, recipeShareKey } from '$db/schema';
import { toCardShareStatus } from '$domain/card-share';
import { CODE_TYPES, type CodeType } from '$domain/code-format';
import { DEFAULT_MEMBER_TINT, DEFAULT_TINT } from '$domain/tint';
import { DEFAULT_UNIT } from '$domain/units';
import { DEFAULT_CURRENCY } from '$domain/price';
import { DEFAULT_SERVINGS } from '$domain/recipe';
import { initialsFor } from '$domain/avatar';

/**
 * Translation between the local model, written for the screen, and the Postgres columns. Everything goes
 * through here: it is the only place to re-read when a column changes name or type.
 */

type Row = Record<string, unknown>;

const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const flag = (value: unknown) => value === true;

const number = (value: unknown) => (typeof value === 'number' ? value : undefined);

export const toShop = (row: Row): Shop => ({
	id: text(row.id),
	householdId: text(row.household_id),
	name: text(row.name),
	short: text(row.short),
	tint: text(row.tint, DEFAULT_TINT),
	brand: text(row.brand),
	address: text(row.address),
	lat: number(row.lat),
	lng: number(row.lng),
	isDefault: flag(row.is_default)
});

export const fromShop = (shop: Shop, householdId: string) => ({
	id: shop.id,
	household_id: householdId,
	name: shop.name,
	short: shop.short,
	tint: shop.tint,
	brand: shop.brand,
	address: shop.address,
	lat: shop.lat ?? null,
	lng: shop.lng ?? null,
	is_default: shop.isDefault
});

export const toAisle = (row: Row): Aisle => ({
	id: text(row.id),
	householdId: text(row.household_id),
	name: text(row.name),
	emoji: text(row.emoji, '🛒'),
	position: typeof row.position === 'number' ? row.position : 0,
	kind: typeof row.kind === 'string' ? row.kind : undefined
});

export const fromAisle = (aisle: Aisle, householdId: string) => ({
	id: aisle.id,
	household_id: householdId,
	name: aisle.name,
	emoji: aisle.emoji,
	position: aisle.position,
	kind: aisle.kind ?? null
});

export const toList = (row: Row, memberIds: string[]): List => ({
	id: text(row.id),
	name: text(row.name),
	emoji: text(row.emoji, '🛒'),
	color: text(row.color, DEFAULT_TINT),
	memberIds,
	eventDate: typeof row.event_date === 'string' ? row.event_date : undefined,
	householdId: typeof row.household_id === 'string' ? row.household_id : undefined
});

/**
 * The circle comes from the list itself, not from the displayed circle: a personal list has none, and a
 * shared list keeps its own even if you are looking elsewhere.
 */
export const fromList = (list: List) => ({
	id: list.id,
	household_id: list.householdId ?? null,
	name: list.name,
	emoji: list.emoji,
	color: list.color,
	event_date: list.eventDate ?? null
});

/**
 * The quantity is typed on a keyboard ("500", "1,5") and stored as numeric. An entry that is not a number
 * goes to null rather than making the insert fail: the item stays in the list.
 */
const toNumber = (value: string) => {
	// Number('') is 0, not NaN: without this start, clearing the quantity field in the interface saved a
	// quantity of zero instead of no quantity.
	const written = value.trim();
	if (written === '') return null;

	// Every comma, not only the first: "1,234,5" is not a number, and replacing a single comma let a
	// half-converted string through.
	const parsed = Number(written.replace(/,/g, '.'));
	return Number.isFinite(parsed) ? parsed : null;
};

export const toItem = (row: Row): Item => ({
	id: text(row.id),
	listId: text(row.list_id),
	aisleId: text(row.aisle_id),
	name: text(row.name),
	qty: row.qty === null || row.qty === undefined ? '' : String(row.qty),
	unit: text(row.unit, DEFAULT_UNIT),
	checked: flag(row.checked),
	priority: flag(row.priority),
	note: typeof row.note === 'string' ? row.note : undefined,
	assignedTo: typeof row.assigned_to === 'string' ? row.assigned_to : undefined,
	createdAt: Date.parse(text(row.created_at)) || 0
});

export const fromItem = (item: Item) => ({
	id: item.id,
	list_id: item.listId,
	aisle_id: item.aisleId || null,
	name: item.name,
	qty: toNumber(item.qty),
	unit: item.unit,
	checked: item.checked,
	priority: item.priority,
	note: item.note ?? null,
	assigned_to: item.assignedTo ?? null
});

/**
 * A newer device may have saved a format this one does not know yet: we bring it back to Code 39 rather
 * than let a lying type travel through the application.
 */
const toCodeType = (raw: string): CodeType =>
	(CODE_TYPES as readonly string[]).includes(raw) ? (raw as CodeType) : 'code_39';

export const toCard = (row: Row): LoyaltyCard => ({
	id: text(row.id),
	householdId: text(row.household_id),
	shopId: text(row.shop_id),
	brand: text(row.brand),
	name: text(row.name),
	num: text(row.num),
	code: text(row.code),
	codeType: toCodeType(text(row.code_type, 'code_39')),
	secretCode: typeof row.secret_code === 'string' ? row.secret_code : undefined,
	websiteUrl: typeof row.website_url === 'string' ? row.website_url : undefined,
	points: typeof row.points === 'number' ? row.points : 0,
	tint: text(row.tint, DEFAULT_TINT),
	grad: text(row.grad),
	notes: typeof row.notes === 'string' ? row.notes : undefined
});

export const fromCard = (card: LoyaltyCard, householdId: string) => ({
	id: card.id,
	household_id: householdId,
	shop_id: card.shopId || null,
	brand: card.brand,
	name: card.name,
	num: card.num,
	code: card.code,
	code_type: card.codeType,
	secret_code: card.secretCode ?? null,
	website_url: card.websiteUrl ?? null,
	points: card.points,
	tint: card.tint,
	grad: card.grad,
	notes: card.notes ?? null
});

/**
 * A member is the junction of the household membership and the profile carrying the display name.
 *
 * The key carries the (circle, person) pair and not the person alone: since we read every circle at once,
 * somebody present in two of them gives two rows, and the role as well as the colour belong to the
 * membership, not to the account.
 */
export const toMember = (row: Row, profile: Row | undefined, currentUserId: string): Member => {
	const id = text(row.user_id);
	const householdId = text(row.household_id);
	const name = text(profile?.display_name) || text(profile?.email) || '—';
	const firstName = text(profile?.first_name);
	const lastName = text(profile?.last_name);

	// The role is stored as is and translated at display time: the database does not speak the user's
	// language, and a household can mix several.
	return {
		key: memberKey(householdId, id),
		id,
		householdId,
		name,
		firstName,
		lastName,
		// An empty role in the database is a missing value, not a role: it falls back to 'member' like an absent
		// column, otherwise the translation would look for an empty key.
		role: id === currentUserId ? 'self' : text(row.role) || 'member',
		// The initials are computed, not read: the `profiles.initial` column is filled by a trigger at sign-up,
		// with a single letter, and nothing updates it afterwards — a name change would leave it stale on top of
		// being truncated.
		initial: initialsFor(firstName, lastName, name),
		tint: text(row.tint, DEFAULT_MEMBER_TINT),
		avatar: text(profile?.avatar) || undefined
	};
};

export const toLayout = (row: Row): ShopLayout => ({
	shopId: text(row.shop_id),
	aisleOrder: Array.isArray(row.aisle_order) ? (row.aisle_order as string[]) : [],
	learned: flag(row.learned)
});

export const fromLayout = (layout: ShopLayout, userId: string) => ({
	shop_id: layout.shopId,
	user_id: userId,
	aisle_order: layout.aisleOrder,
	learned: layout.learned
});

export const toItemOrder = (row: Row): ShopItemOrder => {
	const shopId = text(row.shop_id);
	const aisleId = text(row.aisle_id);

	return {
		key: itemOrderKey(shopId, aisleId),
		shopId,
		aisleId,
		productSlugs: Array.isArray(row.product_slugs) ? (row.product_slugs as string[]) : []
	};
};

/**
 * The two scope columns are read as they are, without inventing one when the other is missing: an empty
 * string put in place of a null would fail the database constraint, which requires exactly one of the two.
 */
export const toMessage = (row: Row): Message => ({
	id: text(row.id),
	listId: typeof row.list_id === 'string' ? row.list_id : undefined,
	conversationId: typeof row.conversation_id === 'string' ? row.conversation_id : undefined,
	userId: text(row.user_id),
	body: text(row.body),
	isSystem: flag(row.is_system),
	createdAt: Date.parse(text(row.created_at)) || 0
});

export const fromMessage = (message: Message) => ({
	id: message.id,
	list_id: message.listId ?? null,
	conversation_id: message.conversationId ?? null,
	user_id: message.userId || null,
	body: message.body,
	is_system: message.isSystem
});

/**
 * The participants do not come from the row: they live in their own table, like a list's members. The
 * `pair` column exists in the database but it is a uniqueness detail — we read the table that is the
 * authority for access.
 */
export const toConversation = (row: Row, participantIds: string[]): Conversation => ({
	id: text(row.id),
	scope: 'direct',
	participantIds,
	createdAt: Date.parse(text(row.created_at)) || 0
});

export const toPoll = (row: Row): Poll => ({
	id: text(row.id),
	messageId: text(row.message_id),
	kind: text(row.kind, 'date') as Poll['kind'],
	question: text(row.question),
	closed: flag(row.closed)
});

export const fromPoll = (poll: Poll) => ({
	id: poll.id,
	message_id: poll.messageId,
	kind: poll.kind,
	question: poll.question,
	closed: poll.closed
});

export const toPollOption = (row: Row): PollOption => ({
	id: text(row.id),
	pollId: text(row.poll_id),
	label: text(row.label),
	emoji: typeof row.emoji === 'string' ? row.emoji : undefined,
	claimedBy: typeof row.claimed_by === 'string' ? row.claimed_by : undefined,
	ingredients: Array.isArray(row.ingredients) ? (row.ingredients as string[]) : [],
	position: typeof row.position === 'number' ? row.position : 0
});

export const fromPollOption = (option: PollOption) => ({
	id: option.id,
	poll_id: option.pollId,
	label: option.label,
	emoji: option.emoji ?? null,
	claimed_by: option.claimedBy ?? null,
	ingredients: option.ingredients,
	position: option.position
});

export const toPollVote = (row: Row): PollVote => {
	const optionId = text(row.option_id);
	const userId = text(row.user_id);

	return { key: pollVoteKey(optionId, userId), optionId, userId };
};

export const fromItemOrder = (order: ShopItemOrder, userId: string) => ({
	shop_id: order.shopId,
	user_id: userId,
	aisle_id: order.aisleId,
	product_slugs: order.productSlugs
});

/**
 * A recorded price. `amount` arrives as `numeric`, which the client returns sometimes as a number and
 * sometimes as a string depending on the precision: we go back through Number rather than trust the type
 * received. An unreadable amount is zero, which the comparison discards by itself.
 */
export const toPrice = (row: Row): Price => ({
	id: text(row.id),
	householdId: text(row.household_id),
	shopId: text(row.shop_id),
	productSlug: text(row.product_slug),
	productName: text(row.product_name),
	amount: Number(row.amount) || 0,
	currency: text(row.currency, DEFAULT_CURRENCY),
	recordedAt: Date.parse(text(row.recorded_at)) || 0,
	recordedBy: text(row.recorded_by)
});

export const fromPrice = (price: Price, householdId: string) => ({
	id: price.id,
	household_id: householdId,
	shop_id: price.shopId,
	product_slug: price.productSlug,
	product_name: price.productName,
	amount: price.amount,
	currency: price.currency,
	// The time of the record, not the time of sending: the queue may wait until you leave the shop.
	recorded_at: new Date(price.recordedAt).toISOString(),
	recorded_by: price.recordedBy || null
});

export const toRecipe = (row: Row): Recipe => ({
	id: text(row.id),
	householdId: text(row.household_id),
	name: text(row.name),
	emoji: text(row.emoji, '🍲'),
	// A missing or unreadable number of servings falls back to the default: zero servings would make scaling
	// absurd, and the recipe would still be displayed.
	servings: typeof row.servings === 'number' && row.servings > 0 ? row.servings : DEFAULT_SERVINGS,
	notes: typeof row.notes === 'string' ? row.notes : undefined,
	photoPath: typeof row.photo_path === 'string' ? row.photo_path : undefined,
	createdBy: typeof row.created_by === 'string' ? row.created_by : undefined,
	createdAt: Date.parse(text(row.created_at)) || 0
});

export const fromRecipe = (recipe: Recipe, householdId: string) => ({
	id: recipe.id,
	household_id: householdId,
	created_by: recipe.createdBy ?? null,
	name: recipe.name,
	emoji: recipe.emoji,
	servings: recipe.servings,
	notes: recipe.notes ?? null,
	photo_path: recipe.photoPath ?? null
});

export const toRecipeIngredient = (row: Row): RecipeIngredient => ({
	id: text(row.id),
	recipeId: text(row.recipe_id),
	name: text(row.name),
	// As for an item: the quantity travels as numeric and is typed on a keyboard. A missing quantity becomes
	// an empty field again, not "null" written out in the form.
	qty: row.qty === null || row.qty === undefined ? '' : String(row.qty),
	unit: text(row.unit, DEFAULT_UNIT),
	position: typeof row.position === 'number' ? row.position : 0
});

export const fromRecipeIngredient = (ingredient: RecipeIngredient) => ({
	id: ingredient.id,
	recipe_id: ingredient.recipeId,
	name: ingredient.name,
	qty: toNumber(ingredient.qty),
	unit: ingredient.unit,
	position: ingredient.position
});

export const toRecipeShare = (row: Row): RecipeShare => ({
	key: recipeShareKey(text(row.recipe_id), text(row.household_id)),
	recipeId: text(row.recipe_id),
	householdId: text(row.household_id),
	sharedBy: typeof row.shared_by === 'string' ? row.shared_by : undefined,
	createdAt: Date.parse(text(row.created_at)) || 0
});

export const fromRecipeShare = (share: RecipeShare) => ({
	recipe_id: share.recipeId,
	household_id: share.householdId,
	shared_by: share.sharedBy ?? null
});

export const toCardShare = (row: Row): LoyaltyCardShare => ({
	key: cardShareKey(text(row.card_id), text(row.household_id)),
	cardId: text(row.card_id),
	householdId: text(row.household_id),
	status: toCardShareStatus(row.status),
	sharedBy: typeof row.shared_by === 'string' ? row.shared_by : undefined,
	createdAt: Date.parse(text(row.created_at)) || 0
});

export const toRecipeStep = (row: Row): RecipeStep => ({
	id: text(row.id),
	recipeId: text(row.recipe_id),
	body: text(row.body),
	position: typeof row.position === 'number' ? row.position : 0,
	ingredientIds: Array.isArray(row.ingredient_ids)
		? row.ingredient_ids.filter((id): id is string => typeof id === 'string')
		: []
});

export const fromRecipeStep = (step: RecipeStep) => ({
	id: step.id,
	recipe_id: step.recipeId,
	body: step.body,
	position: step.position,
	ingredient_ids: step.ingredientIds
});

export const toMealPlan = (row: Row): MealPlan => ({
	id: text(row.id),
	householdId: text(row.household_id),
	name: text(row.name, 'Menu de la semaine'),
	createdBy: typeof row.created_by === 'string' ? row.created_by : undefined,
	createdAt: Date.parse(text(row.created_at)) || 0,
	updatedAt: Date.parse(text(row.updated_at)) || 0
});

export const fromMealPlan = (plan: MealPlan, householdId: string) => ({
	id: plan.id,
	household_id: householdId,
	created_by: plan.createdBy ?? null,
	name: plan.name
});

export const toMealPlanRecipe = (row: Row): MealPlanRecipe => ({
	id: text(row.id),
	mealPlanId: text(row.meal_plan_id),
	recipeId: text(row.recipe_id),
	people: typeof row.people === 'number' && row.people > 0 ? row.people : DEFAULT_SERVINGS,
	dayIndex: typeof row.day_index === 'number' ? row.day_index : undefined,
	position: typeof row.position === 'number' ? row.position : 0
});

export const fromMealPlanRecipe = (entry: MealPlanRecipe) => ({
	id: entry.id,
	meal_plan_id: entry.mealPlanId,
	recipe_id: entry.recipeId,
	people: entry.people,
	day_index: entry.dayIndex ?? null,
	position: entry.position
});

export const toHouseholdPerson = (row: Row): HouseholdPerson => ({
	id: text(row.id),
	householdId: text(row.household_id),
	name: text(row.name),
	createdBy: typeof row.created_by === 'string' ? row.created_by : undefined,
	linkedUserId: typeof row.linked_user_id === 'string' ? row.linked_user_id : undefined,
	dietaryNotes: typeof row.dietary_notes === 'string' ? row.dietary_notes : undefined,
	createdAt: Date.parse(text(row.created_at)) || 0
});

export const fromHouseholdPerson = (person: HouseholdPerson, householdId: string) => ({
	id: person.id,
	household_id: householdId,
	created_by: person.createdBy ?? null,
	linked_user_id: person.linkedUserId ?? null,
	name: person.name,
	dietary_notes: person.dietaryNotes ?? null
});
