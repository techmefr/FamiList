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
	/**
	 * Ordre de référence des rayons, celui d'un magasin qu'on ne connaît pas encore. Sans lui,
	 * Dexie rend les rayons triés par identifiant, donc dans un ordre alphabétique qui ne
	 * correspond à aucun magasin réel.
	 */
	position: number;
	/**
	 * Catégorie de référence (fruits, boulangerie, …), cible de la détection automatique. Absente
	 * sur un rayon créé par l'utilisateur, qui n'entre pas dans la détection.
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

export interface Message {
	id: string;
	listId: string;
	userId: string;
	body: string;
	isSystem: boolean;
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
	/** Ce que la personne apporte : ces lignes deviennent des articles de la liste. */
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
 * Écriture locale pas encore confirmée par le serveur. C'est ce qui permet de cocher un article
 * dans un magasin sans réseau : la modification part de la file dès que la connexion revient.
 */
export interface OutboxEntry {
	seq?: number;
	table: string;
	op: 'upsert' | 'delete';
	/** Clé primaire côté serveur, un objet car certaines tables ont une clé composée. */
	match: Record<string, string>;
	payload?: Record<string, unknown>;
}

export const itemOrderKey = (shopId: string, aisleId: string) => `${shopId}::${aisleId}`;

/** Rayons livrés avec l'application, dans l'ordre d'une grande surface classique. */
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
	members!: EntityTable<Member, 'id'>;
	shopLayouts!: EntityTable<ShopLayout, 'shopId'>;
	shopItemOrders!: EntityTable<ShopItemOrder, 'key'>;
	outbox!: EntityTable<OutboxEntry, 'seq'>;
	messages!: EntityTable<Message, 'id'>;
	polls!: EntityTable<Poll, 'id'>;
	pollOptions!: EntityTable<PollOption, 'id'>;
	pollVotes!: EntityTable<PollVote, 'key'>;

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
	}
}

export const db = new FamiListDatabase();
