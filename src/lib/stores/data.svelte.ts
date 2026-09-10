import { browser } from '$app/environment';
import {
	db,
	itemOrderKey,
	pollVoteKey,
	type Aisle,
	type Item,
	type List,
	type LoyaltyCard,
	type Member,
	type Message,
	type Poll,
	type PollKind,
	type PollOption,
	type PollVote,
	type Shop,
	type ShopItemOrder,
	type ShopLayout
} from '$db/schema';
import { supabase } from '$db/supabase';
import { initialsFor } from '$domain/avatar';
import { accountDecision } from '$domain/account-switch';
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
	fromMessage,
	fromPoll,
	fromPollOption,
	fromShop
} from '$lib/sync/mapping';
import { slugify } from '$domain/slug';
import { trigram } from '$domain/trigram';
import { trigramSource } from '$domain/place';
import { DEFAULT_UNIT } from '$domain/units';
import { TINTS } from '$domain/tint';
import { t } from '$lib/i18n/index.svelte';

const ACTIVE_SHOP_KEY = 'familist:active-shop';

/**
 * Les douze derniers chiffres de l'identifiant du magasin par défaut ; les vingt-quatre premiers
 * caractères viennent de l'identifiant du foyer. Le tout reste un UUID valide, et surtout il est
 * le même sur tous les appareils du foyer — deux ouvertures simultanées ne créent pas deux
 * magasins.
 */
const DEFAULT_SHOP_NODE = 'd0defa017000';

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
	messages = $state<Message[]>([]);
	polls = $state<Poll[]>([]);
	pollOptions = $state<PollOption[]>([]);
	pollVotes = $state<PollVote[]>([]);

	activeShopId = $state<string>('');
	ready = $state(false);

	activeShop = $derived(this.shops.find((s) => s.id === this.activeShopId) ?? this.shops[0]);
	activeLayout = $derived(this.layouts.find((l) => l.shopId === this.activeShopId));

	// L'identifiant est lu de façon asynchrone, après le premier rendu : sans état réactif, tout ce
	// qui dérive de `me` — le champ du nom, le sélecteur de portrait — resterait calculé sur la
	// chaîne vide et ne trouverait jamais son propre membre.
	private userId = $state('');
	private userIdKnown = false;

	async load() {
		if (!browser) return;

		const { data, error } = await supabase.auth.getUser();
		const answer = { id: data.user?.id ?? '', failed: !!error };

		// Changer de compte sur le même appareil doit tout reprendre à zéro. Sans cette
		// comparaison, le cache du compte précédent resterait à l'écran : les listes d'une
		// personne s'afficheraient à une autre. Une réponse en erreur, elle, ne dit rien de
		// l'identité et ne décide de rien.
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

		// Le cache s'affiche d'abord, la synchronisation le remplace ensuite. Hors réseau, ou le
		// temps que le serveur réponde, l'application reste utilisable.
		await this.hydrate();
		this.ready = true;

		// Le magasin par défaut se crée après la synchronisation, jamais avant : sur un appareil
		// neuf le cache est vide, et le créer tout de suite en ferait un deuxième à côté de celui
		// que le foyer possède déjà.
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
			pollVotes
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
			db.pollVotes.toArray()
		]);

		this.shops = shops;
		this.aisles = aisles;
		this.lists = lists;
		this.items = items;
		this.cards = cards;
		this.members = members;
		this.layouts = layouts;
		this.itemOrders = itemOrders;
		this.messages = messages;
		this.polls = polls;
		this.pollOptions = pollOptions;
		this.pollVotes = pollVotes;

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
	 * Modifier un article après coup : la faute de frappe, la quantité qu'on revoit devant le
	 * rayon, la précision qu'on ajoute — « la grande bouteille », « sans sucre ».
	 *
	 * Une note vidée redevient absente plutôt que chaîne vide : l'affichage teste la présence de
	 * la note pour décider du tiret qui la précède.
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

	addList(input: { name: string; emoji: string; color: string }) {
		const list: List = {
			id: crypto.randomUUID(),
			name: input.name.trim(),
			emoji: input.emoji,
			color: input.color,
			// Une liste naît ouverte au foyer : c'est le retrait qui est un geste, pas le partage.
			// Le déclencheur `lists_share_with_household` fait la même chose côté base ; on l'écrit
			// aussi ici pour que l'affichage soit juste avant même la première synchronisation.
			memberIds: this.members.length
				? this.members.map((m) => m.id)
				: this.userId
					? [this.userId]
					: []
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

	/**
	 * Renommer une liste, ou changer son emoji.
	 *
	 * Les deux vont ensemble parce qu'ils se corrigent ensemble : « Cources » se relit une semaine
	 * plus tard, et l'emoji pris à la va-vite au moment de créer ne dit plus rien une fois la
	 * liste remplie.
	 */
	updateList(id: string, patch: { name?: string; emoji?: string }) {
		const list = this.lists.find((candidate) => candidate.id === id);
		if (!list) return;

		if (patch.name !== undefined) list.name = patch.name.trim();
		if (patch.emoji !== undefined) list.emoji = patch.emoji;

		const snapshot = $state.snapshot(list) as List;
		db.lists.put(snapshot);
		this.push('lists', snapshot, fromList);
	}

	/**
	 * Ouvre ou ferme une liste à quelqu'un.
	 *
	 * La ligne dans `list_members` est la clé : `can_access_list` s'appuie dessus, et tout ce qui
	 * appartient à la liste — articles, discussion, sondages — suit. Retirer une personne la met
	 * vraiment dehors, et elle ne peut pas s'y remettre seule.
	 */
	setListMember(listId: string, userId: string, member: boolean) {
		const list = this.lists.find((l) => l.id === listId);
		if (!list) return;

		const memberIds = member
			? [...new Set([...list.memberIds, userId])]
			: list.memberIds.filter((id) => id !== userId);

		const next = { ...list, memberIds };
		this.lists = this.lists.map((l) => (l.id === listId ? next : l));
		db.lists.put(next);

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

	/**
	 * Le magasin par défaut du foyer, celui qu'on n'a pas créé soi-même.
	 *
	 * Il existe pour une raison technique devenue une raison d'usage : un parcours appartient
	 * toujours à un magasin, donc sans magasin il n'y avait rien à réordonner. Il permet de ranger
	 * sa liste dès la première ouverture, avant d'avoir décrit le moindre commerce.
	 */
	get defaultShop() {
		return this.shops.find((shop) => shop.isDefault);
	}

	/**
	 * Le crée s'il manque, une fois le foyer connu.
	 *
	 * Son identifiant se déduit de celui du foyer au lieu d'être tiré au sort : deux téléphones
	 * qui ouvrent l'application en même temps sur un foyer neuf visent alors la même ligne, et le
	 * foyer se retrouve avec un magasin par défaut, pas deux. Un index unique en base tient le
	 * même rôle, pour ce que le client ne peut pas garantir.
	 */
	ensureDefaultShop() {
		const household = this.householdId;
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
	 * Ajouter un magasin — sauf le tout premier vrai, qui remplace le magasin par défaut au lieu
	 * de s'ajouter à côté de lui.
	 *
	 * Remplacer et non supprimer puis recréer : le parcours appris pointe sur l'identifiant du
	 * magasin, et le rangement déjà fait sous « Mon magasin » est justement ce qu'on veut garder.
	 * Il change de nom, rien de plus.
	 */
	addShop(input: {
		name: string;
		short: string;
		tint: string;
		brand?: string;
		address?: string;
		id?: string;
		isDefault?: boolean;
	}) {
		const brand = (input.brand ?? '').trim();
		const address = (input.address ?? '').trim();
		const remplace = !input.isDefault ? this.defaultShop : undefined;

		if (remplace) {
			this.updateShop(remplace.id, {
				name: input.name.trim(),
				short: this.proposedShort(
					{ brand, name: input.name, address },
					remplace.id,
					input.short
				),
				tint: input.tint,
				brand,
				address,
				isDefault: false
			});

			this.setActiveShop(remplace.id);
			return this.shops.find((shop) => shop.id === remplace.id)!;
		}

		const shop: Shop = {
			id: input.id ?? crypto.randomUUID(),
			name: input.name.trim(),
			// Un magasin, un trigramme : ce qui est déjà porté par un autre magasin du foyer est
			// écarté, saisi à la main comme calculé. Le calcul part de l'enseigne et de la commune
			// plutôt que du nom — voir $domain/place.
			short: trigram(
				input.short.trim() || trigramSource({ brand, name: input.name, address }),
				this.shops.map((existant) => existant.short)
			),
			tint: input.tint,
			brand,
			address,
			isDefault: input.isDefault ?? false
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

	/**
	 * Modifier un magasin : l'adresse qu'on complète après coup, la position qu'on relève sur
	 * place, le trigramme qu'on recalcule.
	 *
	 * Le trigramme n'est jamais recalculé tout seul ici. Changer l'adresse d'un magasin ne doit pas
	 * changer sous les yeux la pastille qu'on a appris à reconnaître : c'est un geste explicite,
	 * demandé depuis l'écran.
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
	 * Supprimer un magasin, et avec lui le parcours qu'on y avait appris.
	 *
	 * Le serveur efface en cascade la disposition et l'ordre des articles, et détache les cartes
	 * de fidélité sans les perdre (`on delete set null`) : une carte survit au magasin, c'est le
	 * rattachement qui disparaît. Le cache local fait la même chose de son côté, tout de suite,
	 * pour que l'écran ne montre pas un magasin à moitié parti en attendant la synchronisation.
	 *
	 * Le magasin par défaut se recrée tout seul si c'était le dernier : un parcours appartient
	 * toujours à un magasin, et se retrouver sans aucun laisserait les listes sans rangement.
	 */
	removeShop(id: string) {
		const shop = this.shops.find((candidate) => candidate.id === id);
		if (!shop) return;

		const orders = this.itemOrders.filter((entry) => entry.shopId === id).map((entry) => entry.key);

		this.shops = this.shops.filter((candidate) => candidate.id !== id);
		this.layouts = this.layouts.filter((layout) => layout.shopId !== id);
		this.itemOrders = this.itemOrders.filter((entry) => entry.shopId !== id);
		this.cards = this.cards.map((card) => (card.shopId === id ? { ...card, shopId: '' } : card));

		db.shops.delete(id);
		db.shopLayouts.delete(id);
		db.shopItemOrders.bulkDelete(orders);
		db.cards.bulkPut($state.snapshot(this.cards) as LoyaltyCard[]);

		sync.enqueue({ table: 'shops', op: 'delete', match: { id } });

		if (this.activeShopId === id) this.setActiveShop(this.shops[0]?.id ?? '');
	}

	/**
	 * Le trigramme libre pour ce magasin, celui d'un autre magasin du foyer ne comptant pas comme
	 * pris par lui-même — sans quoi recalculer sans rien changer donnerait un trigramme différent.
	 */
	proposedShort(
		place: { brand?: string; name: string; address?: string },
		exceptId?: string,
		saisi = ''
	) {
		return trigram(
			saisi.trim() || trigramSource(place),
			this.shops
				.filter((existant) => existant.id !== exceptId)
				.map((existant) => existant.short)
		);
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
	 * Glisser-déposer des rayons : marque le magasin comme appris.
	 *
	 * La sortie sans magasin actif est un garde-fou, plus un cas courant : tout foyer en a un
	 * depuis `ensureDefaultShop`. Elle a longtemps rendu les flèches et le glisser-déposer
	 * inertes — rendus actifs, cliquables, sans le moindre effet ni message.
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

	messagesOf(listId: string) {
		return this.messages
			.filter((m) => m.listId === listId)
			.sort((a, b) => a.createdAt - b.createdAt);
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
	 * Son propre portrait.
	 *
	 * L'écriture ne passe pas par la file de sortie : celle-ci fait des `upsert`, et personne n'a
	 * le droit d'insérer une ligne dans `profiles` — c'est un déclencheur qui la crée à
	 * l'inscription. Une mise à jour directe, comme pour les réglages d'apparence.
	 *
	 * L'écran est servi d'abord, le serveur ensuite : changer sa photo doit se voir tout de suite,
	 * et la prochaine synchronisation confirmera.
	 */
	async setMyAvatar(avatar: string | undefined) {
		const id = this.me;
		if (!id) return;

		const membre = this.members.find((m) => m.id === id);
		if (!membre) return;

		const suivant: Member = { ...membre, avatar };
		this.members = this.members.map((m) => (m.id === id ? suivant : m));
		db.members.put(suivant);

		await supabase
			.from('profiles')
			.update({ avatar: avatar ?? '' })
			.eq('id', id);
	}

	/**
	 * Change son identité : prénom, nom, et nom affiché.
	 *
	 * Les trois partent ensemble, en une écriture — ils se saisissent dans le même formulaire, et
	 * n'enregistrer que le nom affiché laisserait des initiales tirées d'un prénom périmé.
	 *
	 * Les initiales suivent d'elles-mêmes : elles se calculent à chaque lecture, la colonne
	 * `initial` n'étant plus regardée. Le nom affiché est aussi écrit dans les métadonnées du
	 * compte, où l'inscription l'avait posé, pour que les deux ne divergent pas.
	 */
	async setMyName(identite: { name: string; firstName: string; lastName: string }) {
		const id = this.me;
		if (!id) return;

		const membre = this.members.find((m) => m.id === id);
		if (!membre) return;

		const { name, firstName, lastName } = identite;
		const suivant: Member = {
			...membre,
			name,
			firstName,
			lastName,
			initial: initialsFor(firstName, lastName, name)
		};
		this.members = this.members.map((m) => (m.id === id ? suivant : m));
		db.members.put(suivant);

		const { error } = await supabase
			.from('profiles')
			.update({ display_name: name, first_name: firstName, last_name: lastName })
			.eq('id', id);
		if (error) {
			// Le nom affiché revient à ce que la base connaît : le laisser à l'écran ferait croire à
			// un enregistrement qui n'a pas eu lieu, jusqu'à la prochaine synchronisation.
			this.members = this.members.map((m) => (m.id === id ? membre : m));
			db.members.put(membre);
			return error.message;
		}

		await supabase.auth.updateUser({ data: { display_name: name } });
		return null;
	}

	member(id: string) {
		return this.members.find((m) => m.id === id);
	}

	get me() {
		return this.userId;
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
	 * Un sondage est porté par un message : il apparaît dans le fil à sa place, et disparaît avec
	 * lui. Message, sondage et options partent dans cet ordre — la file les rejouerait tels quels
	 * après une coupure, et une option sans sondage serait refusée.
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

	/** Un vote par sondage : voter ailleurs retire le vote précédent. */
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

	/** « Qui ramène quoi » : on prend une part, ou on la relâche si on l'avait prise. */
	toggleClaim(optionId: string) {
		const option = this.pollOptions.find((o) => o.id === optionId);
		if (!option || !this.userId) return;

		// Une part déjà prise par quelqu'un d'autre ne se vole pas : il faut qu'il la relâche.
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
	 * Verse dans la liste ce qu'une personne s'est engagée à apporter. Les articles déjà présents
	 * ne sont pas ajoutés une seconde fois : on pousse souvent la même part après l'avoir complétée.
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
		const list = this.lists.find((l) => l.id === listId);
		if (!list) return;

		list.eventDate = eventDate;

		const snapshot = $state.snapshot(list) as List;
		db.lists.put(snapshot);
		this.push('lists', snapshot, fromList);
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
		const enfiler = (householdId: string) =>
			sync.enqueue({
				table,
				op: 'upsert',
				match: { id: record.id },
				payload: map(record, householdId)
			});

		const connu = this.householdId;
		if (connu) {
			enfiler(connu);
			return;
		}

		/**
		 * Le foyer n'est pas encore provisionné — première ouverture, ou changement de compte en
		 * cours. Estampiller la ligne avec une chaîne vide, ce qu'on faisait ici, produisait un
		 * refus définitif de Postgres (« invalid input syntax for type uuid ») : la file jetait
		 * l'écriture en silence, et le magasin qu'on venait de créer disparaissait de l'écran à la
		 * relecture suivante, définitivement.
		 *
		 * On attend donc l'identifiant. Si on ne peut pas l'obtenir, on n'enfile rien : une file
		 * vide et un bandeau d'erreur valent mieux qu'une écriture qui part se faire refuser.
		 */
		void sync.whenHousehold().then((householdId) => {
			if (householdId) enfiler(householdId);
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
	 * Le compte ou le foyer a changé : le cache décrit le précédent, il ne doit rien en rester. On
	 * repart du serveur plutôt que de trier — les listes de quelqu'un d'autre affichées ici
	 * seraient au mieux incompréhensibles, au pire indiscrètes.
	 */
	async reload() {
		sync.stop();
		await this.clearCache();
		await this.hydrate();
		await sync.start(() => void this.hydrate());
	}

	/** À la déconnexion il n'y a plus de compte : on vide sans rien redemander au serveur. */
	async forget() {
		sync.stop();
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
			db.pollVotes.clear()
		]);

		localStorage.removeItem(ACTIVE_SHOP_KEY);
	}

	async reset() {
		sync.stop();
		await db.delete();
		location.reload();
	}
}

export const data = new DataStore();
