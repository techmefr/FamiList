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
 * Le cœur du produit : présenter une liste dans l'ordre de marche d'un magasin donné.
 *
 * - Les rayons suivent `aisleOrder`, l'ordre appris pour ce magasin.
 * - Un rayon absent de `aisleOrder` (rayon créé après l'apprentissage) est placé à la fin plutôt que
 *   masqué : perdre un article coûte plus cher qu'un ordre imparfait.
 * - À l'intérieur d'un rayon, les produits suivent `itemOrder`, indexé par slug et non par id : un
 *   article acheté puis racheté la semaine suivante garde sa place.
 * - Les produits inconnus de l'ordre appris passent après ceux qui y figurent, dans leur ordre
 *   d'origine.
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

/** Ordre appris à retenir après un glisser-déposer : des slugs, pas des identifiants d'articles. */
export function learnedItemOrder(items: OrderableItem[]): string[] {
	return items.map((item) => slugify(item.name));
}
