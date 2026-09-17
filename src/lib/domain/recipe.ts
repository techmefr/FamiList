import { slugify } from './slug';
import { DEFAULT_UNIT } from './units';

/**
 * Going from a recipe to a shopping list.
 *
 * The word "ingredient" is already taken elsewhere in the application — `poll_options.ingredients` means
 * what each person brings to a shared meal. Here it is something else: a recipe's line, with its quantity
 * and its unit. The two never meet.
 */
export interface RecipeLine {
	name: string;
	/** Typed on a keyboard, so a string: "1,5" is a valid answer. Empty = no quantity. */
	qty: string;
	unit: string;
}

/** The smallest number of servings that makes sense, and the largest we accept being typed. */
export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 99;
export const DEFAULT_SERVINGS = 4;

/**
 * The number written in a quantity field, or null.
 *
 * The decimal comma is accepted: it is the one on a French keyboard, and `mapping.ts` already does the
 * same conversion before writing to the database. Text that is not a number — "a pinch" — returns null
 * rather than zero: a missing quantity and a zero quantity do not say the same thing, and scaling must
 * leave the first alone.
 */
export function parseQty(raw: string | null | undefined): number | null {
	const written = (raw ?? '').trim();
	if (written === '') return null;

	const parsed = Number(written.replace(/,/g, '.'));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * How much to multiply the quantities by to go from the written servings to the wanted ones.
 *
 * Absurd servings — zero, negative, unreadable — return 1 rather than an error: the recipe is then
 * generated as written, which stays useful, where a failure would leave nothing.
 */
export function scalingFactor(servings: number, people: number): number {
	if (!Number.isFinite(servings) || !Number.isFinite(people)) return 1;
	if (servings <= 0 || people <= 0) return 1;

	return people / servings;
}

/**
 * The quantity once scaled, as it is written in an item.
 *
 * Three decimals at most, and trailing zeros removed: a third of 400 g gives 133.333 and not
 * 133.33333333333334, and half of 2 pieces stays "1" rather than "1.0". We write a decimal point and not
 * a comma because that is what `toNumber` expects on the database side — a comma would pass too, but the
 * item is displayed as it is in the list before the first sync, and two different notations of the same
 * number would show.
 */
export function scaleQty(qty: string, factor: number): string {
	const base = parseQty(qty);
	if (base === null) return '';

	const scaled = base * factor;
	return String(Math.round(scaled * 1000) / 1000);
}

/** A recipe line ready to become an item. */
export interface GeneratedItem {
	name: string;
	qty: string;
	unit: string;
}

/**
 * The items to create for a recipe, at the requested scale, minus those the list already contains.
 *
 * The comparison goes through the slug, like `pushIngredients`: "Tomatoes" and "tomatoes" are the same
 * product, and somebody generating two recipes into the same list does not want two tomato rows. We do
 * not add the quantities up for all that — adding "3 pieces" and "500 g" has no correct result, and
 * guessing which to keep would betray the recipe. With the duplicate dropped, it is the quantity already
 * there that stays, and the person corrects it in front of the aisle.
 *
 * Nameless lines are ignored: a form always leaves an empty row lying around.
 *
 * The aisle is not decided here. Adding an item already guesses its own from the name
 * (`guessAisleKind`), so the generated list arrives sorted without the recipe having to care.
 */
export function generatedItems(
	lines: RecipeLine[],
	factor: number,
	existingNames: string[]
): GeneratedItem[] {
	const taken = new Set(existingNames.map(slugify).filter(Boolean));
	const produced: GeneratedItem[] = [];

	for (const line of lines) {
		const name = line.name.trim();
		const slug = slugify(name);
		if (!slug || taken.has(slug)) continue;

		taken.add(slug);
		produced.push({
			name,
			// A line with no quantity becomes an item by the piece: a shopping list has no empty box, and "salt"
			// with nothing beside it reads perfectly well as "some salt".
			qty: scaleQty(line.qty, factor) || '1',
			unit: line.unit || DEFAULT_UNIT
		});
	}

	return produced;
}
