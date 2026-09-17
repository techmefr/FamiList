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
	type Member,
	type Message,
	type Poll,
	type PollKind,
	type PollOption,
	type PollVote,
	type Price,
	type Recipe,
	type RecipeIngredient,
	type RecipeStep,
	type Shop,
	type ShopItemOrder,
	type ShopLayout
} from '$db/schema';
import { supabase } from '$db/supabase';
import { initialsFor } from '$domain/avatar';
import { accountDecision } from '$domain/account-switch';
import { guessAisleKind, FALLBACK_AISLE_KIND } from '$domain/guess-aisle';
import { groupByAisle, learnedItemOrder } from '$domain/aisle-order';
import { defaultCircle, ofCircle, resolveAisle, visibleLists } from '$domain/circle';
import { session } from '$stores/session.svelte';
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
	fromPrice,
	fromRecipe,
	fromRecipeIngredient,
	fromRecipeStep,
	fromShop
} from '$lib/sync/mapping';
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
import { DEFAULT_SERVINGS, generatedItems, scalingFactor, type RecipeLine } from '$domain/recipe';
import { trigram } from '$domain/trigram';
import { trigramSource } from '$domain/place';
import { DEFAULT_UNIT } from '$domain/units';
import { TINTS } from '$domain/tint';
import { i18n, t } from '$lib/i18n/index.svelte';

/**
 * Le magasin actif est retenu par cercle : les magasins appartiennent à un cercle, et une seule clé
 * pour tous ferait retomber sur le premier magasin venu à chaque bascule.
 */
const activeShopKey = (circle: string) => `familist:active-shop:${circle}`;

/** La clé d'avant les cercles multiples, relue une dernière fois pour ne pas perdre le choix en cours. */
const LEGACY_ACTIVE_SHOP_KEY = 'familist:active-shop';

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
	/**
	 * Le cache complet : tous les cercles du compte. L'écran ne le lit pas directement — il lit les
	 * vues dérivées juste en dessous, qui ne montrent que le cercle actif.
	 */
	private cachedShops = $state<Shop[]>([]);
	private cachedAisles = $state<Aisle[]>([]);
	private cachedLists = $state<List[]>([]);
	private cachedCards = $state<LoyaltyCard[]>([]);
	private cachedMembers = $state<Member[]>([]);
	private cachedPrices = $state<Price[]>([]);
	private cachedRecipes = $state<Recipe[]>([]);

	// Ce qui se lit par liste, par magasin ou par recette n'est pas filtré ici : la clé étrangère le
	// fait déjà, et ces tables n'ont pas de cercle à elles.
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

	activeShopId = $state<string>('');
	ready = $state(false);

	/** Le cercle actif — celui qu'on regarde, et celui dans lequel ce qu'on crée atterrit. */
	circle = $derived(sync.householdId ?? '');

	/** Les cercles entre lesquels basculer. Un seul cercle, et le sélecteur n'a rien à proposer. */
	circles = $derived(sync.circles);

	shops = $derived(ofCircle(this.cachedShops, this.circle));
	aisles = $derived(ofCircle(this.cachedAisles, this.circle));
	cards = $derived(ofCircle(this.cachedCards, this.circle));
	members = $derived(ofCircle(this.cachedMembers, this.circle));
	prices = $derived(ofCircle(this.cachedPrices, this.circle));
	recipes = $derived(ofCircle(this.cachedRecipes, this.circle));
	lists = $derived(visibleLists(this.cachedLists, this.circle));

	activeShop = $derived(this.shops.find((s) => s.id === this.activeShopId) ?? this.shops[0]);
	activeLayout = $derived(this.layouts.find((l) => l.shopId === this.activeShopId));

	/** Les rayons du cercle actif, pour décider si celui d'un article y a un sens. */
	private knownAisleIds = $derived(new Set(this.aisles.map((aisle) => aisle.id)));

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
			pollVotes,
			prices,
			recipes,
			recipeIngredients,
			recipeSteps,
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
			db.conversations.toArray()
		]);

		this.cachedShops = shops;
		this.cachedAisles = aisles;
		this.cachedLists = lists;
		this.items = items;
		this.cachedCards = cards;
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
		this.conversations = conversations;

		this.restoreActiveShop();
	}

	/**
	 * Le magasin actif du cercle qu'on regarde.
	 *
	 * Relu à l'hydratation comme à chaque bascule : un magasin appartient à un cercle, et garder
	 * celui d'à côté laisserait l'écran ranger la liste selon un parcours qui n'existe pas ici.
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
	 * Bascule de cercle.
	 *
	 * Rien n'est relu et rien n'est vidé : le cache porte déjà tous les cercles, seule change la
	 * tranche que l'écran en montre. C'est ce qui rend la bascule immédiate, y compris sans réseau.
	 * Le magasin actif suit, et le cercle reçoit son magasin par défaut s'il n'en a pas encore.
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

	/**
	 * Une liste par identifiant, prise dans tout le cache et non dans la seule tranche affichée : un
	 * lien reçu ou une notification peut viser une liste d'un autre cercle, et l'écran de détail doit
	 * l'ouvrir plutôt que de conclure qu'elle n'existe pas.
	 */
	list(id: string) {
		return this.cachedLists.find((l) => l.id === id);
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

		// Une liste personnelle suit son auteur d'un cercle à l'autre, mais le rayon de ses articles
		// appartient au cercle où on les a saisis : ailleurs, il se range là où la détection le
		// mettrait. Rien n'est réécrit — revenir retrouve le rangement d'origine.
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

	addList(input: { name: string; emoji: string; color: string; eventDate?: string }) {
		const list: List = {
			id: crypto.randomUUID(),
			name: input.name.trim(),
			emoji: input.emoji,
			color: input.color,
			eventDate: input.eventDate || undefined,
			// Une liste naît personnelle : elle n'a pas de cercle, et son auteur en est le seul
			// membre. Le déclencheur `lists_share_with_household` fait la même chose côté base ; on
			// l'écrit aussi ici pour que l'affichage soit juste avant la première synchronisation.
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
	 * Renommer une liste, changer son emoji, poser ou retirer sa date.
	 *
	 * Les trois vont ensemble parce qu'ils se corrigent ensemble : « Cources » se relit une semaine
	 * plus tard, l'emoji pris à la va-vite au moment de créer ne dit plus rien une fois la liste
	 * remplie, et le repas prévu samedi se décale au dimanche.
	 */
	updateList(id: string, patch: { name?: string; emoji?: string; eventDate?: string }) {
		const list = this.cachedLists.find((candidate) => candidate.id === id);
		if (!list) return;

		if (patch.name !== undefined) list.name = patch.name.trim();
		if (patch.emoji !== undefined) list.emoji = patch.emoji;
		// Un champ vidé retire la date : c'est le seul geste disponible pour annuler un rappel.
		if (patch.eventDate !== undefined) list.eventDate = patch.eventDate || undefined;

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
	 *
	 * Ouvrir une liste personnelle à quelqu'un, c'est la partager, et partager exige de désigner un
	 * cercle. Sans ça la base refuserait la ligne — `list_belongs_to_household_of` n'accepte sur une
	 * liste sans cercle que son propre auteur.
	 *
	 * Le cercle est désormais dit par l'appelant : depuis qu'un compte en a plusieurs à l'écran en
	 * même temps, prendre celui qu'on regarde partagerait avec les collègues une liste qu'on ouvrait
	 * à la famille. Sans précision, le cercle actif reste le défaut — c'est le cas d'un compte qui
	 * n'en a qu'un.
	 */
	setListMember(listId: string, userId: string, member: boolean, circleId?: string) {
		const list = this.cachedLists.find((l) => l.id === listId);
		if (!list) return;

		const memberIds = member
			? [...new Set([...list.memberIds, userId])]
			: list.memberIds.filter((id) => id !== userId);

		const partage = member && !list.householdId && userId !== this.userId;
		const cercle = partage ? (circleId ?? this.circle) : list.householdId;

		// Partager dans un cercle dont on n'est pas membre est refusé par la RLS : on ne l'enfile
		// même pas, plutôt que de laisser la file s'en débarrasser en silence.
		if (partage && !this.circles.some((candidate) => candidate.id === cercle)) return;

		const next = { ...list, memberIds, householdId: cercle || undefined };
		this.cachedLists = this.cachedLists.map((l) => (l.id === listId ? next : l));
		db.lists.put(next);

		if (partage && cercle) this.push('lists', next, fromList);

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
	 * Refaire une liste qui revient : les courses de la semaine, le repas du dimanche.
	 *
	 * La copie reprend l'apparence de l'originale — emoji, couleur — et son partage : une liste
	 * privée reste privée, une liste ouverte au foyer le reste. Recopier `memberIds` plutôt que
	 * repartir de tout le foyer comme `addList` est ce qui empêche une liste d'anniversaire de
	 * s'afficher chez la personne concernée.
	 *
	 * La date d'événement ne suit pas : elle datait l'occasion passée, et la reconduire ferait
	 * afficher un repas déjà eu sur une liste à venir.
	 *
	 * L'ordre des rayons n'est pas recopié parce qu'il n'appartient pas à la liste : il vit dans le
	 * parcours du magasin actif, et la copie s'y range donc toute seule.
	 *
	 * Rien de spécial pour le réseau : chaque ligne part par la même file que si on l'avait tapée,
	 * ce qui rend la duplication utilisable hors ligne comme le reste.
	 */
	duplicateList(id: string) {
		const source = this.cachedLists.find((candidate) => candidate.id === id);
		if (!source) return;

		const copie: List = {
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

		const articles: Item[] = this.itemsOf(id).map((item, rang) => ({
			...copiedItem(item),
			id: crypto.randomUUID(),
			listId: copie.id,
			// Le rang préserve l'ordre de saisie de l'originale : deux articles créés dans la même
			// milliseconde se départageaient sinon au hasard de la relecture.
			createdAt: Date.now() + rang
		}));

		this.cachedLists = [...this.cachedLists, copie];
		this.items = [...this.items, ...articles];
		db.lists.add(copie);
		db.items.bulkAdd(articles);

		this.push('lists', copie, fromList);
		for (const article of articles) this.push('items', article, fromItem);

		// Le partage de l'originale se rejoue ligne à ligne. Une liste naît désormais ouverte à son
		// seul auteur : il n'y a plus rien à refermer derrière l'insertion, seulement à rouvrir aux
		// personnes que la source connaissait.
		for (const membre of copie.memberIds) {
			if (membre === this.userId) continue;
			sync.enqueue({
				table: 'list_members',
				op: 'upsert',
				match: { list_id: copie.id, user_id: membre },
				payload: { list_id: copie.id, user_id: membre }
			});
		}

		return copie;
	}

	removeList(id: string) {
		const items = this.itemsOf(id).map((i) => i.id);
		this.cachedLists = this.cachedLists.filter((l) => l.id !== id);
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
			householdId: this.circle,
			name: input.name.trim(),
			emoji: input.emoji || '🛒',
			position: Math.max(-1, ...this.aisles.map((a) => a.position)) + 1
		};

		this.cachedAisles = [...this.cachedAisles, aisle];
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
		lat?: number;
		lng?: number;
		id?: string;
		isDefault?: boolean;
	}) {
		const brand = (input.brand ?? '').trim();
		const address = (input.address ?? '').trim();
		const remplace = !input.isDefault ? this.defaultShop : undefined;

		// Une position absente reste absente : écrire `lat: undefined` effacerait celle qu'un
		// magasin remplacé avait déjà, et ferait porter la clé à un magasin qui n'en a pas.
		const position =
			input.lat !== undefined && input.lng !== undefined
				? { lat: input.lat, lng: input.lng }
				: {};

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
				isDefault: false,
				...position
			});

			this.setActiveShop(remplace.id);
			return this.shops.find((shop) => shop.id === remplace.id)!;
		}

		const shop: Shop = {
			id: input.id ?? crypto.randomUUID(),
			householdId: this.circle,
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

	addCard(input: Omit<LoyaltyCard, 'id' | 'householdId'>) {
		const card: LoyaltyCard = { ...input, id: crypto.randomUUID(), householdId: this.circle };
		this.cachedCards = [...this.cachedCards, card];
		db.cards.add(card);
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

	removeCard(id: string) {
		this.cachedCards = this.cachedCards.filter((c) => c.id !== id);
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

	/**
	 * Le prix d'un produit, relevé au moment où on le met dans le chariot.
	 *
	 * C'est la seule minute où quelqu'un connaît le prix : l'étiquette est sous les yeux, et
	 * l'article vient d'être coché. Le demander à l'ajout — souvent la veille, sur le canapé —
	 * reviendrait à demander de deviner, et le demander après la course obligerait à rouvrir chaque
	 * ligne de mémoire. Le champ n'apparaît donc que sur un article coché, et il reste facultatif :
	 * une course entière peut se faire sans en remplir un seul.
	 *
	 * Le magasin est celui qui est actif — celui dont le parcours range déjà la liste. Une liste
	 * n'appartient à aucun magasin ; c'est le sélecteur en bas de l'écran qui dit où l'on est.
	 *
	 * Un second relevé du même produit, dans le même magasin, le même jour, remplace le précédent au
	 * lieu de s'ajouter : c'est une correction de frappe, pas une évolution de prix. Vider le champ
	 * efface ce relevé du jour, pour la même raison.
	 */
	setItemPrice(item: Item, raw: string) {
		const shopId = this.activeShopId;
		if (!shopId) return;

		const slug = slugify(item.name);
		if (!slug) return;

		const amount = parseAmount(raw);
		const existing = latestAt(this.prices, slug, shopId);
		const dujour = existing && sameDay(existing.recordedAt, Date.now()) ? existing : null;

		if (amount === null) {
			if (dujour) this.removePrice(dujour.id);
			return;
		}

		const price: Price = {
			id: dujour?.id ?? crypto.randomUUID(),
			householdId: this.circle,
			shopId,
			productSlug: slug,
			productName: item.name,
			amount,
			// La monnaie ne change jamais sur un relevé existant : celle d'hier reste celle d'hier,
			// même si l'application a changé de langue depuis.
			currency: dujour?.currency ?? currencyForLocale(i18n.locale),
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

	/** Le dernier prix connu de ce produit dans le magasin actif, celui que le champ réaffiche. */
	priceOf(item: Item) {
		if (!this.activeShopId) return null;
		return latestAt(this.prices, slugify(item.name), this.activeShopId);
	}

	/** Les magasins où ce produit a été relevé, du moins cher au plus cher. */
	priceComparison(slug: string) {
		return compareShops(this.prices, slug);
	}

	/** Les produits dont on connaît au moins un prix. */
	get pricedProducts() {
		return pricedProducts(this.prices);
	}

	messagesOf(listId: string) {
		return this.messages
			.filter((m) => m.listId === listId)
			.sort((a, b) => a.createdAt - b.createdAt);
	}

	/** Mes conversations directes, la plus récemment animée en tête. */
	get directs() {
		return directSummaries(this.conversations, this.messages, this.me);
	}

	direct(conversationId: string) {
		return this.conversations.find((c) => c.id === conversationId);
	}

	/**
	 * Les personnes avec qui une conversation directe peut s'ouvrir : celles d'un cercle commun,
	 * sauf soi-même et celles à qui on écrit déjà. Le cercle ne sert ici que d'annuaire — la
	 * conversation, elle, n'en dépendra pas.
	 */
	get directCandidates() {
		const dejaVus = new Set(this.directs.map((d) => d.otherId));

		// Une personne figure une fois par cercle partagé : sans ce tri, quelqu'un qu'on côtoie dans
		// deux cercles apparaîtrait deux fois dans la liste. C'est précisément l'ambiguïté qu'une
		// conversation directe écarte — elle n'appartient à aucun des deux — et la liste des gens à
		// qui écrire doit la refléter : un compte, une entrée.
		const vus = new Set<string>();

		return this.cachedMembers.filter((m) => {
			if (m.id === this.me || dejaVus.has(m.id) || vus.has(m.id)) return false;

			vus.add(m.id);
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

		// Le portrait appartient au profil, pas au rattachement : il change dans tous les cercles où
		// la personne figure, et le cache en porte une ligne par cercle.
		const miennes = this.cachedMembers.filter((m) => m.id === id);
		if (miennes.length === 0) return;

		const suivants = miennes.map((membre) => ({ ...membre, avatar }));
		this.cachedMembers = this.cachedMembers.map(
			(m) => suivants.find((suivant) => suivant.key === m.key) ?? m
		);
		db.members.bulkPut(suivants);

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

		const miennes = this.cachedMembers.filter((m) => m.id === id);
		if (miennes.length === 0) return;

		const { name, firstName, lastName } = identite;
		const suivants: Member[] = miennes.map((membre) => ({
			...membre,
			name,
			firstName,
			lastName,
			initial: initialsFor(firstName, lastName, name)
		}));
		const remplace = (rows: Member[]) =>
			this.cachedMembers.map((m) => rows.find((row) => row.key === m.key) ?? m);

		this.cachedMembers = remplace(suivants);
		db.members.bulkPut(suivants);

		const { error } = await supabase
			.from('profiles')
			.update({ display_name: name, first_name: firstName, last_name: lastName })
			.eq('id', id);
		if (error) {
			// Le nom affiché revient à ce que la base connaît : le laisser à l'écran ferait croire à
			// un enregistrement qui n'a pas eu lieu, jusqu'à la prochaine synchronisation.
			this.cachedMembers = remplace(miennes);
			db.members.bulkPut(miennes);
			return error.message;
		}

		await supabase.auth.updateUser({ data: { display_name: name } });
		return null;
	}

	member(id: string) {
		// Tout le cache et non le seul cercle actif : une liste personnelle partagée ailleurs, ou une
		// discussion ouverte depuis un lien, montre des visages qui ne sont pas d'ici.
		return this.cachedMembers.find((m) => m.id === id);
	}

	/** Les membres d'un cercle donné — celui vers lequel on s'apprête à partager, par exemple. */
	membersOf(circleId: string) {
		return ofCircle(this.cachedMembers, circleId);
	}

	/** Le nom d'un cercle, tel que le sélecteur l'affiche. */
	circleName(circleId: string) {
		return this.circles.find((circle) => circle.id === circleId)?.name ?? '';
	}

	/**
	 * Le compte connecté, tel que la session le connaît.
	 *
	 * `userId` n'en est qu'une copie, posée par `load()`. Entre une déconnexion suivie d'une
	 * reconnexion sur un autre compte et la relecture qui suit, cette copie décrit encore le compte
	 * précédent — l'écran désigne alors la mauvaise personne, et surtout un message direct part
	 * signé de quelqu'un d'autre. La base le refuse, à juste titre : elle exige que l'auteur soit le
	 * compte connecté. Le message était perdu sans que rien ne le dise.
	 *
	 * La session, elle, est mise à jour par `onAuthStateChange`, à l'instant du changement. On la
	 * lit donc en premier, et `userId` ne sert plus que de repli quand la session n'a pas encore
	 * répondu — au tout premier rendu, ou hors ligne.
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
	 * Ouvre — ou retrouve — la conversation directe avec quelqu'un.
	 *
	 * Seule écriture du client sur ces tables, et elle passe par une fonction : personne n'a le
	 * droit d'insérer une conversation ni un participant, c'est ce qui garantit qu'on ne s'invite
	 * pas dans celle des autres. Rien n'est donc posé d'avance dans le cache — l'écran attend le
	 * serveur, comme pour l'envoi d'un portrait.
	 */
	async startDirect(otherId: string) {
		const moi = this.me;
		if (!moi || otherId === moi) return null;

		const { data: conversationId, error } = await supabase.rpc('start_direct_conversation', {
			other: otherId
		});
		if (error || typeof conversationId !== 'string') return null;

		// La conversation vient peut-être de naître : sans elle dans le cache, le fil qu'on ouvre
		// serait vide et la relecture complète n'arriverait qu'après coup.
		const conversation: Conversation = {
			id: conversationId,
			scope: 'direct',
			participantIds: [moi, otherId],
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
	 * Un message direct ne porte pas de liste : c'est l'autre colonne de portée qui le rattache, et
	 * la base refuse qu'il en porte deux.
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

		// `push` estampille l'écriture avec le cercle de la ligne, et attend qu'un cercle existe
		// avant d'enfiler quoi que ce soit. Une conversation directe n'en a aucun, par construction :
		// l'attente allait donc jusqu'à son terme, cinq secondes plus tard, et une déconnexion dans
		// cet intervalle emportait le message. Il n'a rien à attendre, il part directement.
		//
		// L'attente porte sur la mise en file, pas sur le serveur : l'écran a déjà le message, mais
		// une déconnexion juste après le clic doit trouver l'écriture dans la file plutôt qu'une
		// file encore vide.
		await sync.enqueue({
			table: 'messages',
			op: 'upsert',
			match: { id: message.id },
			payload: fromMessage(message)
		});

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

	/** Les lignes d'une recette, dans l'ordre où elles ont été saisies. */
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
	 * Une recette, avec ses ingrédients et ses étapes, écrits d'un seul geste.
	 *
	 * Les trois tables partent dans la file dans cet ordre : la recette d'abord, ses lignes ensuite.
	 * La file est vidée dans l'ordre d'arrivée, et les clés étrangères côté serveur refuseraient une
	 * ligne dont la recette n'existe pas encore.
	 *
	 * Les lignes sans nom sont écartées ici plutôt qu'à l'écran : un formulaire propose toujours une
	 * rangée vide de plus que ce qu'on a rempli, et l'enregistrer produirait des ingrédients
	 * fantômes qu'on retrouverait dans la liste de courses.
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
			servings: input.servings > 0 ? Math.round(input.servings) : DEFAULT_SERVINGS,
			notes: input.notes?.trim() || undefined,
			createdBy: this.userId || undefined,
			createdAt: Date.now()
		};

		const lignes: RecipeIngredient[] = input.ingredients
			.filter((line) => line.name.trim())
			.map((line, position) => ({
				id: crypto.randomUUID(),
				recipeId: recipe.id,
				name: line.name.trim(),
				qty: line.qty.trim(),
				unit: line.unit || DEFAULT_UNIT,
				position
			}));

		const etapes: RecipeStep[] = input.steps
			.filter((body) => body.trim())
			.map((body, position) => ({
				id: crypto.randomUUID(),
				recipeId: recipe.id,
				body: body.trim(),
				position
			}));

		this.cachedRecipes = [...this.cachedRecipes, recipe];
		this.recipeIngredients = [...this.recipeIngredients, ...lignes];
		this.recipeSteps = [...this.recipeSteps, ...etapes];

		db.recipes.add(recipe);
		db.recipeIngredients.bulkAdd(lignes);
		db.recipeSteps.bulkAdd(etapes);

		this.push('recipes', recipe, fromRecipe);
		for (const ligne of lignes) this.push('recipe_ingredients', ligne, fromRecipeIngredient);
		for (const etape of etapes) this.push('recipe_steps', etape, fromRecipeStep);

		return recipe;
	}

	/**
	 * Le serveur supprime les lignes et les étapes de lui-même — `on delete cascade` sur la recette.
	 * On ne met donc dans la file que la recette, et on vide le cache local à la main pour que
	 * l'écran soit juste avant la prochaine relecture.
	 */
	removeRecipe(id: string) {
		const lignes = this.recipeIngredients.filter((line) => line.recipeId === id).map((l) => l.id);
		const etapes = this.recipeSteps.filter((step) => step.recipeId === id).map((s) => s.id);

		this.cachedRecipes = this.cachedRecipes.filter((r) => r.id !== id);
		this.recipeIngredients = this.recipeIngredients.filter((line) => line.recipeId !== id);
		this.recipeSteps = this.recipeSteps.filter((step) => step.recipeId !== id);

		db.recipes.delete(id);
		db.recipeIngredients.bulkDelete(lignes);
		db.recipeSteps.bulkDelete(etapes);
		sync.enqueue({ table: 'recipes', op: 'delete', match: { id } });
	}

	/**
	 * La liste de courses d'une recette, pour un nombre de convives donné.
	 *
	 * C'est une copie, pas un lien. Les articles nés ici vivent ensuite leur vie — on les coche, on
	 * corrige « grande bouteille » devant le rayon, on en supprime — et la recette continue la
	 * sienne. Un lien vivant ferait qu'une correction de recette réécrive une course en train de se
	 * faire, et que supprimer la recette vide la liste. `pushIngredients`, le seul précédent de la
	 * base, copie pour les mêmes raisons.
	 *
	 * Sans liste visée, on en crée une au nom de la recette : c'est le cas courant — on décide de
	 * cuisiner ça, on va acheter de quoi. Avec une liste visée, les ingrédients s'ajoutent aux
	 * courses de la semaine sans écraser ce qui s'y trouve déjà.
	 *
	 * Le rayon n'est pas décidé ici : `addItem` devine celui de chaque article depuis son nom, donc
	 * la liste générée arrive rangée selon le parcours du magasin actif, comme si elle avait été
	 * saisie à la main.
	 */
	generateList(recipeId: string, people: number, targetListId?: string) {
		const recipe = this.recipe(recipeId);
		if (!recipe) return null;

		const cible = targetListId ? this.list(targetListId) : null;
		const liste =
			cible ??
			this.addList({
				name: recipe.name,
				emoji: recipe.emoji,
				color: TINTS[this.cachedLists.length % TINTS.length]
			});

		const articles = generatedItems(
			this.ingredientsOf(recipeId),
			scalingFactor(recipe.servings, people),
			this.itemsOf(liste.id).map((item) => item.name)
		);

		for (const article of articles) this.addItem(liste.id, article);

		return { listId: liste.id, added: articles.length };
	}

	/**
	 * Les tables du foyer prennent toutes le même chemin : on écrit la ligne complète, l'upsert
	 * côté serveur se charge de savoir si elle existait déjà.
	 */
	private push<T extends { id: string; householdId?: string }>(
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

		// Le cercle de la ligne elle-même passe avant le cercle affiché : une carte ou un prix qu'on
		// modifie appartient au cercle où il est né, et le réécrire avec celui qu'on regarde le ferait
		// changer de cercle à la première correction.
		const connu = record.householdId || this.circle;
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

	/**
	 * À la déconnexion il n'y a plus de compte : on vide sans rien redemander au serveur.
	 *
	 * La file part avec le compte qui l'a remplie. `signOut` la vide d'abord ; ce qui reste ici n'a
	 * pas pu partir — hors ligne, ou serveur injoignable. Le garder ne la sauverait pas : la
	 * prochaine tentative se ferait avec le jeton du compte suivant, et la base refuse qu'on écrive
	 * au nom de quelqu'un d'autre.
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
