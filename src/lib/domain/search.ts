import { foldForSearch } from '$domain/emoji';

/**
 * Ce qu'on peut retrouver d'un bout de mot.
 *
 * Quatre familles, et pas une de plus : ce sont les choses que le foyer a écrites lui-même et
 * qu'il range ensuite dans des écrans séparés — un article noté il y a trois semaines dort au
 * fond d'une liste parmi d'autres. Les discussions restent dehors : elles se relisent dans leur
 * fil, et les mêler aux articles ferait apparaître des bribes de conversation dans un résultat
 * qu'on ouvre devant quelqu'un d'autre. Les rayons et les membres aussi : ils tiennent tous sur
 * un écran, on les voit sans les chercher.
 */
export type SearchKind = 'list' | 'item' | 'shop' | 'card';

export const SEARCH_KINDS: SearchKind[] = ['list', 'item', 'shop', 'card'];

/**
 * En dessous de deux caractères, tout correspond : la recherche rendrait le foyer entier trié au
 * hasard, ce qui coûte plus à lire qu'à retrouver soi-même.
 */
export const MIN_QUERY_LENGTH = 2;

/** Par famille, pas au total : sinon trente articles enterrent l'unique magasin trouvé. */
export const HITS_PER_KIND = 6;

export interface SearchableList {
	id: string;
	name: string;
	emoji: string;
}

export interface SearchableItem {
	id: string;
	listId: string;
	name: string;
	note?: string;
	checked: boolean;
}

export interface SearchableShop {
	id: string;
	name: string;
	brand: string;
}

export interface SearchableCard {
	id: string;
	name: string;
	brand: string;
}

export interface SearchSource {
	lists: SearchableList[];
	items: SearchableItem[];
	shops: SearchableShop[];
	cards: SearchableCard[];
}

export interface SearchHit {
	kind: SearchKind;
	id: string;
	/** Ce qu'on a cherché : le nom, tel qu'il a été écrit. */
	label: string;
	/** Où ça vit — la liste d'un article, l'enseigne d'un magasin. Vide quand il n'y a rien à dire. */
	detail: string;
	/** Un emoji, jamais un mot : il redit la famille sans occuper de place. Vide si l'objet n'en a pas. */
	icon: string;
	href: string;
	/** Un article déjà coché se retrouve encore, mais se montre comme tel. */
	checked: boolean;
	score: number;
}

export interface SearchGroup {
	kind: SearchKind;
	hits: SearchHit[];
}

interface Field {
	value: string;
	/**
	 * Le nom pèse plus que la note : « lait » cherché doit sortir l'article « Lait » avant
	 * l'article « Café » dont la note dit « avec du lait ».
	 */
	weight: number;
}

const EXACT = 100;
const PREFIX = 60;
const WORD_START = 40;
const ANYWHERE = 20;

const WORD_SEPARATORS = /[^\p{L}\p{N}]+/u;

function fieldScore(needle: string, value: string): number {
	const folded = foldForSearch(value);
	if (!folded) return 0;

	if (folded === needle) return EXACT;
	if (folded.startsWith(needle)) return PREFIX;
	if (folded.split(WORD_SEPARATORS).some((word) => word.startsWith(needle))) return WORD_START;

	return folded.includes(needle) ? ANYWHERE : 0;
}

/**
 * La note d'une recherche sur un objet, ou zéro s'il ne correspond pas.
 *
 * Chaque mot tapé doit se retrouver quelque part — « lait bio » ne rend pas tous les laits. Mais
 * pas forcément dans le même champ : on tape le nom du produit et un mot de sa note sans savoir
 * lequel est où.
 */
export function scoreEntry(query: string, fields: Field[]): number {
	const needles = foldForSearch(query).split(WORD_SEPARATORS).filter(Boolean);
	if (needles.length === 0) return 0;

	let total = 0;

	for (const needle of needles) {
		let best = 0;

		for (const field of fields) {
			best = Math.max(best, fieldScore(needle, field.value) * field.weight);
		}

		if (best === 0) return 0;
		total += best;
	}

	return total / needles.length;
}

/**
 * Les résultats sont ordonnés à la note, puis à l'alphabet.
 *
 * Le second critère n'est pas une coquetterie : sans lui, deux articles homonymes dans deux listes
 * changeraient de place d'une frappe à l'autre, et la cible glisserait sous le doigt.
 */
const byScoreThenLabel = (a: SearchHit, b: SearchHit) =>
	b.score - a.score || a.label.localeCompare(b.label);

const take = (hits: SearchHit[]) => hits.sort(byScoreThenLabel).slice(0, HITS_PER_KIND);

export function searchAll(query: string, source: SearchSource): SearchGroup[] {
	if (foldForSearch(query).length < MIN_QUERY_LENGTH) return [];

	const listName = new Map(source.lists.map((list) => [list.id, list]));

	const lists: SearchHit[] = [];
	for (const list of source.lists) {
		const score = scoreEntry(query, [{ value: list.name, weight: 1 }]);
		if (score === 0) continue;

		lists.push({
			kind: 'list',
			id: list.id,
			label: list.name,
			detail: '',
			icon: list.emoji,
			href: `/l/${list.id}`,
			checked: false,
			score
		});
	}

	const items: SearchHit[] = [];
	for (const item of source.items) {
		const score = scoreEntry(query, [
			{ value: item.name, weight: 1 },
			{ value: item.note ?? '', weight: 0.5 }
		]);
		if (score === 0) continue;

		const parent = listName.get(item.listId);

		items.push({
			kind: 'item',
			id: item.id,
			label: item.name,
			detail: parent?.name ?? '',
			icon: parent?.emoji ?? '',
			// La liste sait mettre en évidence l'article désigné : c'est ce paramètre qui le lui dit.
			href: `/l/${item.listId}?item=${item.id}`,
			checked: item.checked,
			score
		});
	}

	const shops: SearchHit[] = [];
	for (const shop of source.shops) {
		const score = scoreEntry(query, [
			{ value: shop.name, weight: 1 },
			{ value: shop.brand, weight: 0.8 }
		]);
		if (score === 0) continue;

		shops.push({
			kind: 'shop',
			id: shop.id,
			label: shop.name,
			detail: shop.brand,
			icon: '',
			href: '/shops',
			checked: false,
			score
		});
	}

	const cards: SearchHit[] = [];
	for (const card of source.cards) {
		const score = scoreEntry(query, [
			{ value: card.name, weight: 1 },
			{ value: card.brand, weight: 0.8 }
		]);
		if (score === 0) continue;

		cards.push({
			kind: 'card',
			id: card.id,
			label: card.name,
			detail: card.brand,
			icon: '',
			href: '/cards',
			checked: false,
			score
		});
	}

	const byKind: Record<SearchKind, SearchHit[]> = {
		list: take(lists),
		item: take(items),
		shop: take(shops),
		card: take(cards)
	};

	return SEARCH_KINDS.map((kind) => ({ kind, hits: byKind[kind] })).filter(
		(group) => group.hits.length > 0
	);
}

/** Les résultats à plat, dans l'ordre affiché : c'est sur cette suite que voyagent les flèches. */
export const flattenHits = (groups: SearchGroup[]): SearchHit[] =>
	groups.flatMap((group) => group.hits);
