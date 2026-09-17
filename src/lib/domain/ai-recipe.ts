import { DEFAULT_SERVINGS, MAX_SERVINGS, MIN_SERVINGS, type RecipeLine } from './recipe';
import { slugify } from './slug';
import { DEFAULT_UNIT, resolveUnit, UNITS } from './units';

/**
 * A recipe idea from what the household buys, and above all: what leaves the device to get it.
 *
 * This repository refused geocoding so as not to let an address out (`20260908170000_shop_place.sql`).
 * Asking a third party for a recipe reverses that principle, and there is no middle way: either we send
 * something, or there is no feature. What this file can do is make that "something" as small as possible and
 * entirely showable — `shoppedProducts` returns a list of strings the screen displays as it is before
 * sending, and that is literally all that leaves.
 */

/** What the function needs to know about an item. Deliberately not the whole `Item`. */
export interface Purchase {
	name: string;
	checked: boolean;
	createdAt: number;
}

/**
 * Beyond this, the list stops being readable at a glance before sending, and consent becomes a box ticked
 * without having read anything.
 */
export const MAX_PRODUCTS = 40;

/**
 * The products already bought, most recent first, with no duplicates.
 *
 * What leaves: the product name. What does not leave, and whose absence is the feature: the quantities, the
 * notes, who the item was assigned to, the list names, the member names, the shop, the prices, the dates.
 * "Size 2 nappies" and "3 bottles of whisky assigned to dad on the 14th" do not say the same thing about a
 * household, and only the first form is useful to a recipe suggestion.
 *
 * Only ticked items are kept: an unticked item is an intention, a ticked item is a purchase. The issue does
 * speak of what has been bought.
 *
 * Duplicates are judged on the slug, as everywhere else here: "Tomates" and "tomates" are the same product,
 * and sending it twice costs twice without teaching anybody anything.
 */
export function shoppedProducts(purchases: Purchase[], limit = MAX_PRODUCTS): string[] {
	const seen = new Set<string>();
	const kept: string[] = [];

	for (const purchase of purchases.toSorted((a, b) => b.createdAt - a.createdAt)) {
		if (!purchase.checked) continue;

		const name = purchase.name.trim();
		const slug = slugify(name);
		if (!slug || seen.has(slug)) continue;

		seen.add(slug);
		kept.push(name);
		if (kept.length >= limit) break;
	}

	return kept;
}

export interface PromptOptions {
	/** The language the recipe must be written in, written in that language. */
	language: string;
	servings: number;
}

/**
 * The request sent to the provider, in full.
 *
 * It is built here and nowhere else so that the screen can show its content before sending: what is
 * displayed and what leaves are then the same text, and not two wordings that a later change would make
 * diverge.
 *
 * The accepted units are dictated rather than left free: they land in the columns of `recipe_ingredients`,
 * whose `unit` must speak the same language as `items.unit` so that generating a list translates nothing.
 */
export function recipePrompt(products: string[], options: PromptOptions): string {
	const servings = clampServings(options.servings);

	return [
		`Tu proposes une recette de cuisine familiale, ecrite en ${options.language}.`,
		`Elle doit se faire principalement avec ces produits, deja achetes par le foyer :`,
		products.join(', ') || '(aucun)',
		'',
		`La recette est pour ${servings} personnes.`,
		'Reponds uniquement par un objet JSON, sans texte autour et sans bloc de code.',
		'Forme exacte attendue :',
		'{"name":"","emoji":"","servings":0,"ingredients":[{"name":"","qty":"","unit":""}],"steps":[""]}',
		`"emoji" est un seul caractere emoji. "servings" vaut ${servings}.`,
		`"unit" vaut obligatoirement l'une de ces valeurs : ${UNITS.join(', ')}.`,
		'"qty" est un nombre ecrit en chiffres, ou une chaine vide si la quantite ne se compte pas.',
		'"steps" contient les etapes de preparation, une par entree, dans l ordre.'
	].join('\n');
}

const clampServings = (value: number): number => {
	if (!Number.isFinite(value)) return DEFAULT_SERVINGS;

	return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(value)));
};

export interface SuggestedRecipe {
	name: string;
	emoji: string;
	servings: number;
	ingredients: RecipeLine[];
	steps: string[];
}

/** What we show in the absence of an emoji returned by the provider, like the entry form. */
const FALLBACK_EMOJI = '🍲';

/**
 * The JSON hidden in the response, whatever surrounds it.
 *
 * A model regularly answers "Here is your recipe: ```json … ```" despite the instruction. So we do not strip
 * the markers one by one: we take what runs from the first opening brace to the last closing one, which
 * covers both the code block and the introductory sentence without depending on their exact form.
 */
function extractJson(text: string): unknown {
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start === -1 || end <= start) return null;

	try {
		return JSON.parse(text.slice(start, end + 1));
	} catch {
		return null;
	}
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * The suggested recipe, or null if the response contains no usable one.
 *
 * Everything is validated again rather than trusted: this text comes from a third party, it ends up in
 * constrained columns on the database side, and a `servings` of 0 or an invented unit would make the write
 * fail after the person has accepted the recipe — so at the worst moment. A recipe with no name or without a
 * single ingredient returns null: there is nothing to show, and displaying an empty card would suggest a
 * useful answer.
 */
export function parseRecipeSuggestion(text: string): SuggestedRecipe | null {
	const root = asRecord(extractJson(text));
	if (!root) return null;

	const name = asText(root.name);
	if (!name) return null;

	const ingredients = (Array.isArray(root.ingredients) ? root.ingredients : [])
		.map(asRecord)
		.map(line => ({
			name: asText(line?.name),
			qty: asText(line?.qty).replace(/\s+/g, ''),
			// `resolveUnit` already knows the aliases and the plurals written by hand: a model answering "grammes"
			// despite the instruction falls back on `g` instead of being brought back to the piece.
			unit: resolveUnit(line?.unit as string) ?? DEFAULT_UNIT
		}))
		.filter(line => line.name !== '');

	if (ingredients.length === 0) return null;

	const emoji = [...asText(root.emoji)][0] ?? FALLBACK_EMOJI;

	const steps = (Array.isArray(root.steps) ? root.steps : []).map(asText).filter(Boolean);

	return {
		name,
		emoji,
		servings: clampServings(Number(root.servings)),
		ingredients,
		// A recipe with no step is still a recipe — the shopping list, which is the point, does not need one. We
		// keep an empty entry so that the review form has its row.
		steps: steps.length > 0 ? steps : ['']
	};
}
