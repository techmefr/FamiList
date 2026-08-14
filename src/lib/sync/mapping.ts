import type {
	Aisle,
	Item,
	List,
	LoyaltyCard,
	Member,
	Shop,
	ShopItemOrder,
	ShopLayout
} from '$db/schema';
import { itemOrderKey } from '$db/schema';

/**
 * Traduction entre le modèle local, écrit pour l'écran, et les colonnes Postgres. Tout passe par
 * ici : c'est le seul endroit à relire quand une colonne change de nom ou de type.
 */

type Row = Record<string, unknown>;

const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const flag = (value: unknown) => value === true;

export const toShop = (row: Row): Shop => ({
	id: text(row.id),
	name: text(row.name),
	short: text(row.short),
	tint: text(row.tint, '#5A4A2F')
});

export const fromShop = (shop: Shop, householdId: string) => ({
	id: shop.id,
	household_id: householdId,
	name: shop.name,
	short: shop.short,
	tint: shop.tint
});

export const toAisle = (row: Row): Aisle => ({
	id: text(row.id),
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
	color: text(row.color, '#C8532A'),
	memberIds,
	eventDate: typeof row.event_date === 'string' ? row.event_date : undefined
});

export const fromList = (list: List, householdId: string) => ({
	id: list.id,
	household_id: householdId,
	name: list.name,
	emoji: list.emoji,
	color: list.color,
	event_date: list.eventDate ?? null
});

/**
 * La quantité est saisie au clavier ("500", "1,5") et stockée en numeric. Une saisie qui n'est pas
 * un nombre part à null plutôt que de faire échouer l'insertion : l'article reste dans la liste.
 */
const toNumber = (value: string) => {
	const parsed = Number(value.replace(',', '.'));
	return Number.isFinite(parsed) ? parsed : null;
};

export const toItem = (row: Row): Item => ({
	id: text(row.id),
	listId: text(row.list_id),
	aisleId: text(row.aisle_id),
	name: text(row.name),
	qty: row.qty === null || row.qty === undefined ? '' : String(row.qty),
	unit: text(row.unit, 'pièce'),
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

export const toCard = (row: Row): LoyaltyCard => ({
	id: text(row.id),
	shopId: text(row.shop_id),
	name: text(row.name),
	num: text(row.num),
	code: text(row.code),
	codeType: (text(row.code_type, 'code_39') as LoyaltyCard['codeType']) ?? 'code_39',
	points: typeof row.points === 'number' ? row.points : 0,
	tint: text(row.tint, '#5A4A2F'),
	grad: text(row.grad),
	notes: typeof row.notes === 'string' ? row.notes : undefined
});

export const fromCard = (card: LoyaltyCard, householdId: string) => ({
	id: card.id,
	household_id: householdId,
	shop_id: card.shopId || null,
	name: card.name,
	num: card.num,
	code: card.code,
	code_type: card.codeType,
	points: card.points,
	tint: card.tint,
	grad: card.grad,
	notes: card.notes ?? null
});

/** Un membre est la jonction du rattachement au foyer et du profil qui porte le nom affiché. */
export const toMember = (row: Row, profile: Row | undefined, currentUserId: string): Member => {
	const id = text(row.user_id);
	const name = text(profile?.display_name) || text(profile?.email) || '—';

	return {
		id,
		name,
		role: id === currentUserId ? 'Vous' : text(row.role, 'member'),
		initial: text(profile?.initial) || name.slice(0, 1).toUpperCase(),
		tint: text(row.tint, '#C8532A')
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

export const fromItemOrder = (order: ShopItemOrder, userId: string) => ({
	shop_id: order.shopId,
	user_id: userId,
	aisle_id: order.aisleId,
	product_slugs: order.productSlugs
});
