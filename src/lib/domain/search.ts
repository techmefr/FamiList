import { foldForSearch } from '$domain/emoji';

/**
 * What can be found again from a fragment of a word.
 *
 * Four families, and not one more: they are the things the household wrote itself and then files away in
 * separate screens — an item noted three weeks ago sleeps at the bottom of a list among others.
 * Conversations stay out: they are read again in their thread, and mixing them with items would make
 * snippets of conversation appear in a result you open in front of somebody else. Aisles and members too:
 * they all fit on one screen, you see them without looking.
 */
export type SearchKind = 'list' | 'item' | 'shop' | 'card';

export const SEARCH_KINDS: SearchKind[] = ['list', 'item', 'shop', 'card'];

/**
 * Below two characters, everything matches: the search would return the whole household in random order,
 * which costs more to read than finding it yourself.
 */
export const MIN_QUERY_LENGTH = 2;

/** Per family, not in total: otherwise thirty items bury the single shop found. */
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
	/** What was searched for: the name, as it was written. */
	label: string;
	/** Where it lives — an item's list, a shop's brand. Empty when there is nothing to say. */
	detail: string;
	/** An emoji, never a word: it repeats the family without taking space. Empty if the object has none. */
	icon: string;
	href: string;
	/** An already ticked item is still found, but shows itself as such. */
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
	 * The name weighs more than the note: searching "milk" must bring out the item "Milk" before the item
	 * "Coffee" whose note says "with milk".
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
 * A search's score on an object, or zero if it does not match.
 *
 * Every word typed must be found somewhere — "organic milk" does not return every milk. But not
 * necessarily in the same field: you type the product's name and a word from its note without knowing
 * which is where.
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
 * Results are ordered by score, then alphabetically.
 *
 * The second criterion is not a flourish: without it, two items of the same name in two lists would swap
 * places from one keystroke to the next, and the target would slide under your finger.
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
			// The list knows how to highlight the item pointed at: this parameter is what tells it.
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

/** The results flattened, in display order: it is this sequence the arrow keys travel. */
export const flattenHits = (groups: SearchGroup[]): SearchHit[] =>
	groups.flatMap((group) => group.hits);
