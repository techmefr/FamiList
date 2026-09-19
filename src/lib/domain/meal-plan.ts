import { slugify } from './slug';
import { DEFAULT_UNIT } from './units';
import { parseQty, scaleQty, type GeneratedItem, type RecipeLine } from './recipe';

/**
 * Going from a whole meal plan — several recipes, each already scaled by its own number of people — to
 * one consolidated shopping list.
 *
 * `generatedItems` (recipe.ts) answers the single-recipe case and explicitly refuses to sum quantities:
 * "3 pieces" and "500 g" of the same product have no correct total. Here the same rule applies, but
 * across recipes rather than against the target list: two recipes both asking for "tomatoes, g" do add
 * up, because the unit agrees; "tomatoes, g" from one and "tomatoes, piece" from another stay two lines,
 * for the same reason `generatedItems` never guesses.
 */

/** One recipe's lines, already scaled for the number of people it is cooked for in this plan. */
export interface MealPlanRecipeLines {
	lines: RecipeLine[];
	factor: number;
}

/**
 * The merged, deduplicated ingredient list for a whole meal plan.
 *
 * Lines are grouped by `(slug(name), unit)`: same product in the same unit sums, same product in a
 * different unit stays a separate line. A line with no quantity counts as one piece, like a single
 * recipe's generation — "a pinch of salt" used twice is worth two pinches, not zero.
 *
 * `existingNames` plays the same role as in `generatedItems`: a product already on the target list is
 * left alone rather than summed into or duplicated, since we do not know what quantity is really still
 * needed for something already there.
 */
export function generatedItemsForPlan(
	sources: MealPlanRecipeLines[],
	existingNames: string[]
): GeneratedItem[] {
	const taken = new Set(existingNames.map(slugify).filter(Boolean));
	const order: string[] = [];
	const merged = new Map<string, { name: string; qty: number; unit: string }>();

	for (const source of sources) {
		for (const line of source.lines) {
			const name = line.name.trim();
			const slug = slugify(name);
			if (!slug || taken.has(slug)) continue;

			const unit = line.unit || DEFAULT_UNIT;
			const key = `${slug}::${unit}`;
			const amount = parseQty(scaleQty(line.qty, source.factor)) ?? 1;

			const existing = merged.get(key);
			if (existing) {
				existing.qty += amount;
				continue;
			}

			merged.set(key, { name, qty: amount, unit });
			order.push(key);
		}
	}

	return order.map((key) => {
		const line = merged.get(key)!;
		return {
			name: line.name,
			qty: String(Math.round(line.qty * 1000) / 1000),
			unit: line.unit
		};
	});
}
