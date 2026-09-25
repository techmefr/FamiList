import { slugify } from './slug';

/**
 * Which ingredients each step uses (#308), so cook-along can show what to get out for this step.
 *
 * The step's own text stays the source of truth ("take two eggs", then "the remaining eggs"): the link is
 * only there to organise the workspace, so a plain many-to-many is enough — no quantity per step. In the
 * form it is kept as indices into the ingredient rows, because those rows have no id until the recipe is
 * saved; on disk it is the ingredient ids.
 */

/** The ingredients of one step, in the recipe's own order. Unknown ids (a line since removed) are skipped. */
export function ingredientsOfStep<T extends { id: string }>(ingredientIds: string[], ingredients: T[]): T[] {
	const wanted = new Set(ingredientIds);
	return ingredients.filter((ingredient) => wanted.has(ingredient.id));
}

/** The links once the ingredient row at `removed` is gone: later rows move up by one. */
export function withoutIngredient(links: number[][], removed: number): number[][] {
	return links.map((indices) =>
		indices.filter((index) => index !== removed).map((index) => (index > removed ? index - 1 : index))
	);
}

/** Adds or removes one ingredient from one step's links, keeping the indices sorted. */
export function toggleLink(links: number[][], step: number, ingredient: number): number[][] {
	return links.map((indices, position) => {
		if (position !== step) return indices;
		return indices.includes(ingredient)
			? indices.filter((index) => index !== ingredient)
			: [...indices, ingredient].toSorted((a, b) => a - b);
	});
}

/** One entry per step, padded or cut to the number of steps, each keeping only real, distinct rows. */
export function sanitizeLinks(raw: unknown, stepCount: number, ingredientCount: number): number[][] {
	const source = Array.isArray(raw) ? raw : [];

	return Array.from({ length: stepCount }, (_, step) => {
		const entry = source[step];
		if (!Array.isArray(entry)) return [];

		const kept = entry.filter(
			(index): index is number => Number.isInteger(index) && index >= 0 && index < ingredientCount
		);
		return [...new Set(kept)].toSorted((a, b) => a - b);
	});
}

/** Words too common in ingredient names to say anything about a step. */
const STOP_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'au', 'aux', 'en', 'et', 'of', 'the', 'and']);

const wordsOf = (text: string): string[] =>
	slugify(text)
		.split('-')
		.filter((word) => word.length >= 3 && !STOP_WORDS.has(word) && !/^\d+$/.test(word));

/** "tomates" and "tomate", "noix" and "noix": the plural never decides whether a step names a product. */
const stem = (word: string): string => word.replace(/[sx]$/, '');

/**
 * A best guess of the links when nothing better is known (a page's schema.org recipe, an AI answer that
 * left them out): a step uses an ingredient when it names one of its words. It only pre-ticks boxes the
 * person can untick; a step naming none of them simply shows the whole list in cook-along.
 */
export function guessLinks(ingredientNames: string[], steps: string[]): number[][] {
	const ingredientStems = ingredientNames.map((name) => wordsOf(name).map(stem));

	return steps.map((body) => {
		const stepStems = new Set(wordsOf(body).map(stem));

		return ingredientStems.flatMap((stems, index) =>
			stems.length > 0 && stems.some((word) => stepStems.has(word)) ? [index] : []
		);
	});
}
