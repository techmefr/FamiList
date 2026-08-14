import { browser } from '$app/environment';
import {
	db,
	itemOrderKey,
	type Aisle,
	type Item,
	type List,
	type LoyaltyCard,
	type Member,
	type Shop,
	type ShopItemOrder,
	type ShopLayout
} from '$db/schema';
import { seedIfEmpty } from '$db/seed';
import { guessAisle } from '$domain/guess-aisle';
import { groupByAisle, learnedItemOrder } from '$domain/aisle-order';

const ACTIVE_SHOP_KEY = 'familist:active-shop';

/**
 * L'écran ne lit jamais Dexie directement : il lit cet état, écrit par des méthodes qui persistent
 * en tâche de fond. Aucune interaction n'attend le disque — on coche un article en marchant.
 */
class DataStore {
	shops = $state<Shop[]>([]);
	aisles = $state<Aisle[]>([]);
	lists = $state<List[]>([]);
	items = $state<Item[]>([]);
	cards = $state<LoyaltyCard[]>([]);
	members = $state<Member[]>([]);
	layouts = $state<ShopLayout[]>([]);
	itemOrders = $state<ShopItemOrder[]>([]);

	activeShopId = $state<string>('halles');
	ready = $state(false);

	activeShop = $derived(this.shops.find((s) => s.id === this.activeShopId) ?? this.shops[0]);
	activeLayout = $derived(this.layouts.find((l) => l.shopId === this.activeShopId));

	async load() {
		if (!browser || this.ready) return;

		await seedIfEmpty();

		const [shops, aisles, lists, items, cards, members, layouts, itemOrders] = await Promise.all([
			db.shops.toArray(),
			db.aisles.toArray(),
			db.lists.toArray(),
			db.items.toArray(),
			db.cards.toArray(),
			db.members.toArray(),
			db.shopLayouts.toArray(),
			db.shopItemOrders.toArray()
		]);

		this.shops = shops;
		this.aisles = aisles;
		this.lists = lists;
		this.items = items;
		this.cards = cards;
		this.members = members;
		this.layouts = layouts;
		this.itemOrders = itemOrders;

		const savedShop = localStorage.getItem(ACTIVE_SHOP_KEY);
		if (savedShop && shops.some((s) => s.id === savedShop)) this.activeShopId = savedShop;

		this.ready = true;
	}

	aisle(id: string) {
		return this.aisles.find((a) => a.id === id);
	}

	list(id: string) {
		return this.lists.find((l) => l.id === id);
	}

	itemsOf(listId: string) {
		return this.items.filter((i) => i.listId === listId);
	}

	/** Liste regroupée et ordonnée selon le parcours appris du magasin actif. */
	groupedItems(listId: string) {
		const order = this.activeLayout?.aisleOrder ?? this.aisles.map((a) => a.id);
		const byAisle: Record<string, string[]> = {};

		for (const entry of this.itemOrders) {
			if (entry.shopId === this.activeShopId) byAisle[entry.aisleId] = entry.productSlugs;
		}

		return groupByAisle(this.itemsOf(listId), order, byAisle);
	}

	setActiveShop(shopId: string) {
		this.activeShopId = shopId;
		if (browser) localStorage.setItem(ACTIVE_SHOP_KEY, shopId);
	}

	toggleItem(id: string) {
		const item = this.items.find((i) => i.id === id);
		if (!item) return;

		item.checked = !item.checked;
		db.items.update(id, { checked: item.checked });
	}

	addItem(listId: string, input: { name: string; qty: string; unit: string; aisleId?: string }) {
		const item: Item = {
			id: crypto.randomUUID(),
			listId,
			aisleId: input.aisleId || guessAisle(input.name),
			name: input.name.trim(),
			qty: input.qty || '1',
			unit: input.unit || 'pièce',
			checked: false,
			priority: false,
			createdAt: Date.now()
		};

		this.items = [...this.items, item];
		db.items.add(item);
		return item;
	}

	removeItem(id: string) {
		this.items = this.items.filter((i) => i.id !== id);
		db.items.delete(id);
	}

	togglePriority(id: string) {
		const item = this.items.find((i) => i.id === id);
		if (!item) return;

		item.priority = !item.priority;
		db.items.update(id, { priority: item.priority });
	}

	clearChecked(listId: string) {
		const removed = this.items.filter((i) => i.listId === listId && i.checked).map((i) => i.id);
		this.items = this.items.filter((i) => !removed.includes(i.id));
		db.items.bulkDelete(removed);
		return removed.length;
	}

	addList(input: { name: string; emoji: string; color: string }) {
		const list: List = {
			id: crypto.randomUUID(),
			name: input.name.trim(),
			emoji: input.emoji,
			color: input.color,
			memberIds: ['u1']
		};

		this.lists = [...this.lists, list];
		db.lists.add(list);
		return list;
	}

	removeList(id: string) {
		const items = this.itemsOf(id).map((i) => i.id);
		this.lists = this.lists.filter((l) => l.id !== id);
		this.items = this.items.filter((i) => i.listId !== id);
		db.lists.delete(id);
		db.items.bulkDelete(items);
	}

	addAisle(input: { name: string; emoji: string }) {
		const aisle: Aisle = {
			id: crypto.randomUUID(),
			name: input.name.trim(),
			emoji: input.emoji || '🛒'
		};

		this.aisles = [...this.aisles, aisle];
		db.aisles.add(aisle);

		// Un rayon créé après coup s'ajoute à la fin de chaque parcours : il apparaît, quitte à ne
		// pas être à la bonne place tant que l'utilisateur ne l'a pas déplacé.
		this.layouts = this.layouts.map((layout) => ({
			...layout,
			aisleOrder: [...layout.aisleOrder, aisle.id]
		}));
		this.layouts.forEach((layout) => db.shopLayouts.put($state.snapshot(layout)));

		return aisle;
	}

	addShop(input: { name: string; short: string; tint: string }) {
		const shop: Shop = {
			id: crypto.randomUUID(),
			name: input.name.trim(),
			short: input.short || input.name.slice(0, 2).toUpperCase(),
			tint: input.tint
		};

		const layout: ShopLayout = {
			shopId: shop.id,
			aisleOrder: this.aisles.map((a) => a.id),
			learned: false
		};

		this.shops = [...this.shops, shop];
		this.layouts = [...this.layouts, layout];
		db.shops.add(shop);
		db.shopLayouts.add(layout);
		this.setActiveShop(shop.id);

		return shop;
	}

	addCard(input: Omit<LoyaltyCard, 'id'>) {
		const card: LoyaltyCard = { ...input, id: crypto.randomUUID() };
		this.cards = [...this.cards, card];
		db.cards.add(card);
		return card;
	}

	removeCard(id: string) {
		this.cards = this.cards.filter((c) => c.id !== id);
		db.cards.delete(id);
	}

	/** Glisser-déposer des rayons : marque le magasin comme appris. */
	reorderAisles(aisleOrder: string[]) {
		const layout: ShopLayout = { shopId: this.activeShopId, aisleOrder, learned: true };
		this.layouts = [
			...this.layouts.filter((l) => l.shopId !== this.activeShopId),
			layout
		];
		db.shopLayouts.put(layout);
	}

	/** Glisser-déposer des produits dans un rayon : mémorisé par slug, pas par identifiant. */
	reorderItems(aisleId: string, items: Item[]) {
		const entry: ShopItemOrder = {
			key: itemOrderKey(this.activeShopId, aisleId),
			shopId: this.activeShopId,
			aisleId,
			productSlugs: learnedItemOrder(items)
		};

		this.itemOrders = [...this.itemOrders.filter((o) => o.key !== entry.key), entry];
		db.shopItemOrders.put(entry);
	}

	async reset() {
		await db.delete();
		location.reload();
	}
}

export const data = new DataStore();
