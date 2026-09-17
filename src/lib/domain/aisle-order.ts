import { slugify } from './slug';

export interface OrderableItem {
	id: string;
	name: string;
	aisleId: string;
	checked: boolean;
}

export interface AisleGroup<T extends OrderableItem> {
	aisleId: string;
	items: T[];
}

/**
 * The heart of the product: presenting a list in the walking order of a given shop.
 *
 * - Aisles follow `aisleOrder`, the order learned for this shop.
 * - An aisle missing from `aisleOrder` (an aisle created after the learning) is placed at the end rather
 *   than hidden: losing an item costs more than an imperfect order.
 * - Inside an aisle, products follow `itemOrder`, indexed by slug and not by id: an item bought then bought
 *   again the following week keeps its place.
 * - Products unknown to the learned order come after those in it, in their original order.
 */
export function groupByAisle<T extends OrderableItem>(
	items: T[],
	aisleOrder: string[],
	itemOrder: Record<string, string[]> = {}
): AisleGroup<T>[] {
	const groups = new Map<string, T[]>();

	for (const item of items) {
		const bucket = groups.get(item.aisleId);
		if (bucket) bucket.push(item);
		else groups.set(item.aisleId, [item]);
	}

	const rank = new Map(aisleOrder.map((aisleId, index) => [aisleId, index]));

	return [...groups.entries()]
		.sort(([a], [b]) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity))
		.map(([aisleId, group]) => ({
			aisleId,
			items: sortWithinAisle(group, itemOrder[aisleId] ?? [])
		}));
}

function sortWithinAisle<T extends OrderableItem>(items: T[], slugOrder: string[]): T[] {
	const rank = new Map(slugOrder.map((slug, index) => [slug, index]));

	return items
		.map((item, index) => ({ item, index }))
		.sort((a, b) => {
			const rankA = rank.get(slugify(a.item.name)) ?? Infinity;
			const rankB = rank.get(slugify(b.item.name)) ?? Infinity;
			if (rankA !== rankB) return rankA - rankB;
			return a.index - b.index;
		})
		.map(({ item }) => item);
}

/** Learned order to keep after a drag-and-drop: slugs, not item identifiers. */
export function learnedItemOrder(items: OrderableItem[]): string[] {
	return items.map((item) => slugify(item.name));
}
