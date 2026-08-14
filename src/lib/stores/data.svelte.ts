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
import { supabase } from '$db/supabase';
import { guessAisleKind, FALLBACK_AISLE_KIND } from '$domain/guess-aisle';
import { groupByAisle, learnedItemOrder } from '$domain/aisle-order';
import { sync } from '$lib/sync/index.svelte';
import {
	fromAisle,
	fromCard,
	fromItem,
	fromItemOrder,
	fromLayout,
	fromList,
	fromShop
} from '$lib/sync/mapping';

const ACTIVE_SHOP_KEY = 'familist:active-shop';

/**
 * L'écran ne lit jamais Dexie directement : il lit cet état, écrit par des méthodes qui persistent
 * en tâche de fond. Aucune interaction n'attend le disque ni le réseau — on coche un article en
 * marchant, la synchronisation suit.
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

	activeShopId = $state<string>('');
	ready = $state(false);

	activeShop = $derived(this.shops.find((s) => s.id === this.activeShopId) ?? this.shops[0]);
	activeLayout = $derived(this.layouts.find((l) => l.shopId === this.activeShopId));

	private userId = '';

	async load() {
		if (!browser || this.ready) return;

		// Le cache s'affiche d'abord, la synchronisation le remplace ensuite. Hors réseau, ou le
		// temps que le serveur réponde, l'application reste utilisable.
		await this.hydrate();
		this.ready = true;

		const { data } = await supabase.auth.getUser();
		this.userId = data.user?.id ?? '';

		await sync.start(() => void this.hydrate());
	}

	private async hydrate() {
		const [shops, aisles, lists, items, cards, members, layouts, itemOrders] = await Promise.all([
			db.shops.toArray(),
			db.aisles.orderBy('position').toArray(),
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

		const saved = localStorage.getItem(ACTIVE_SHOP_KEY);
		const known = saved && shops.some((s) => s.id === saved) ? saved : (shops[0]?.id ?? '');
		if (known !== this.activeShopId) this.activeShopId = known;
	}

	private get householdId() {
		return sync.householdId ?? '';
	}

	aisle(id: string) {
		return this.aisles.find((a) => a.id === id);
	}

	/**
	 * La détection raisonne sur des catégories ; les rayons, eux, portent un identifiant propre au
	 * foyer. On traduit ici. Un foyer dont les rayons de départ ont été supprimés n'a plus de
	 * catégorie à proposer : l'article part alors dans le premier rayon, jamais dans le vide.
	 */
	suggestAisleId(name: string) {
		const kind = guessAisleKind(name);
		const byKind = this.aisles.find((a) => a.kind === kind);
		const fallback = this.aisles.find((a) => a.kind === FALLBACK_AISLE_KIND);

		return byKind?.id ?? fallback?.id ?? this.aisles[0]?.id ?? '';
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
		this.push('items', $state.snapshot(item), fromItem);
	}

	addItem(listId: string, input: { name: string; qty: string; unit: string; aisleId?: string }) {
		const item: Item = {
			id: crypto.randomUUID(),
			listId,
			aisleId: input.aisleId || this.suggestAisleId(input.name),
			name: input.name.trim(),
			qty: input.qty || '1',
			unit: input.unit || 'pièce',
			checked: false,
			priority: false,
			createdAt: Date.now()
		};

		this.items = [...this.items, item];
		db.items.add(item);
		this.push('items', item, fromItem);
		return item;
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

	addList(input: { name: string; emoji: string; color: string }) {
		const list: List = {
			id: crypto.randomUUID(),
			name: input.name.trim(),
			emoji: input.emoji,
			color: input.color,
			memberIds: this.userId ? [this.userId] : []
		};

		this.lists = [...this.lists, list];
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

	removeList(id: string) {
		const items = this.itemsOf(id).map((i) => i.id);
		this.lists = this.lists.filter((l) => l.id !== id);
		this.items = this.items.filter((i) => i.listId !== id);
		db.lists.delete(id);
		db.items.bulkDelete(items);

		// Les articles partent avec la liste côté serveur (on delete cascade) : une seule
		// suppression à pousser.
		sync.enqueue({ table: 'lists', op: 'delete', match: { id } });
	}

	addAisle(input: { name: string; emoji: string }) {
		const aisle: Aisle = {
			id: crypto.randomUUID(),
			name: input.name.trim(),
			emoji: input.emoji || '🛒',
			position: Math.max(-1, ...this.aisles.map((a) => a.position)) + 1
		};

		this.aisles = [...this.aisles, aisle];
		db.aisles.add(aisle);
		this.push('aisles', aisle, fromAisle);

		// Un rayon créé après coup s'ajoute à la fin de chaque parcours : il apparaît, quitte à ne
		// pas être à la bonne place tant que l'utilisateur ne l'a pas déplacé.
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
		this.push('shops', shop, fromShop);
		this.pushLayout(layout);
		this.setActiveShop(shop.id);

		return shop;
	}

	addCard(input: Omit<LoyaltyCard, 'id'>) {
		const card: LoyaltyCard = { ...input, id: crypto.randomUUID() };
		this.cards = [...this.cards, card];
		db.cards.add(card);
		this.push('loyalty_cards', card, fromCard);
		return card;
	}

	updateCard(id: string, patch: Partial<Omit<LoyaltyCard, 'id'>>) {
		const card = this.cards.find((c) => c.id === id);
		if (!card) return;

		Object.assign(card, patch);

		const snapshot = $state.snapshot(card) as LoyaltyCard;
		db.cards.put(snapshot);
		this.push('loyalty_cards', snapshot, fromCard);
	}

	removeCard(id: string) {
		this.cards = this.cards.filter((c) => c.id !== id);
		db.cards.delete(id);
		sync.enqueue({ table: 'loyalty_cards', op: 'delete', match: { id } });
	}

	/**
	 * Glisser-déposer des rayons : marque le magasin comme appris. Un parcours n'existe que pour un
	 * magasin ; sans magasin actif il n'y a rien à apprendre, et rien à enregistrer.
	 */
	reorderAisles(aisleOrder: string[]) {
		if (!this.activeShopId) return;

		const layout: ShopLayout = { shopId: this.activeShopId, aisleOrder, learned: true };
		this.layouts = [...this.layouts.filter((l) => l.shopId !== this.activeShopId), layout];
		db.shopLayouts.put(layout);
		this.pushLayout(layout);
	}

	/** Glisser-déposer des produits dans un rayon : mémorisé par slug, pas par identifiant. */
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
	 * Les tables du foyer prennent toutes le même chemin : on écrit la ligne complète, l'upsert
	 * côté serveur se charge de savoir si elle existait déjà.
	 */
	private push<T extends { id: string }>(
		table: string,
		record: T,
		map: (record: T, householdId: string) => Record<string, unknown>
	) {
		sync.enqueue({
			table,
			op: 'upsert',
			match: { id: record.id },
			payload: map(record, this.householdId)
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

	async reset() {
		sync.stop();
		await db.delete();
		location.reload();
	}
}

export const data = new DataStore();
