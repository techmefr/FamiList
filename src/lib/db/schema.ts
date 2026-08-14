import Dexie, { type EntityTable } from 'dexie';

export interface Shop {
	id: string;
	name: string;
	short: string;
	tint: string;
	dist?: string;
}

export interface Aisle {
	id: string;
	name: string;
	emoji: string;
}

export interface List {
	id: string;
	name: string;
	emoji: string;
	color: string;
	memberIds: string[];
	eventDate?: string;
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
	shopId: string;
	name: string;
	num: string;
	code: string;
	codeType: 'code_39' | 'ean_13' | 'qr_code';
	points: number;
	tint: string;
	grad: string;
	notes?: string;
}

export interface Member {
	id: string;
	name: string;
	role: string;
	initial: string;
	tint: string;
}

/** Parcours appris dans un magasin : ordre des rayons. Propre à l'utilisateur. */
export interface ShopLayout {
	shopId: string;
	aisleOrder: string[];
	learned: boolean;
}

/** Ordre appris des produits dans un rayon d'un magasin, indexé par slug produit. */
export interface ShopItemOrder {
	key: string;
	shopId: string;
	aisleId: string;
	productSlugs: string[];
}

export const itemOrderKey = (shopId: string, aisleId: string) => `${shopId}::${aisleId}`;

class FamiListDatabase extends Dexie {
	shops!: EntityTable<Shop, 'id'>;
	aisles!: EntityTable<Aisle, 'id'>;
	lists!: EntityTable<List, 'id'>;
	items!: EntityTable<Item, 'id'>;
	cards!: EntityTable<LoyaltyCard, 'id'>;
	members!: EntityTable<Member, 'id'>;
	shopLayouts!: EntityTable<ShopLayout, 'shopId'>;
	shopItemOrders!: EntityTable<ShopItemOrder, 'key'>;

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
	}
}

export const db = new FamiListDatabase();
