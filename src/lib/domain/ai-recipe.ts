import { DEFAULT_SERVINGS, MAX_SERVINGS, MIN_SERVINGS, type RecipeLine } from './recipe';
import { slugify } from './slug';
import { guessLinks, sanitizeLinks } from './step-ingredients';
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
	/**
	 * The household's dietary restrictions and allergies, gathered from `household_persons.dietary_notes`.
	 * Absent or empty adds no instruction: most households have none, and an empty "Avoid: " line would be
	 * a strange thing to send.
	 */
	restrictions?: string[];
}

/**
 * Asked with every recipe (#308): which lines each step uses, so cook-along can show what to get out. The
 * indices are the positions in "ingredients", counted from 0, one list per step.
 */
const STEP_INGREDIENTS_RULE =
	'"stepIngredients" contient une liste par etape, dans le meme ordre que "steps" : les numeros (a partir de 0) des ingredients utilises a cette etape.';

/** The one JSON shape every recipe prompt asks for, so that `parseRecipeSuggestion` reads every answer. */
export const RECIPE_JSON_SHAPE =
	'{"name":"","emoji":"","servings":0,"ingredients":[{"name":"","qty":"","unit":""}],"steps":[""],"stepIngredients":[[0]],"imagePrompt":""}';

/**
 * Asked in English whatever the recipe's language: image models understand English far better, and a
 * French title alone ("Nems") is what used to come back as a bowl of soup (#306).
 */
const IMAGE_PROMPT_RULE =
	'"imagePrompt" decrit en anglais, en une ou deux phrases, la photo du plat fini pour un generateur d image : type de plat, ingredients visibles, texture, dressage, contenant, decor. Aucun texte dans l image.';

/** Long enough for a rich description, short enough to stay under the column's check. */
export const MAX_IMAGE_PROMPT_LENGTH = 600;

/** The instruction line added to a prompt when the household has dietary restrictions, or none at all. */
function restrictionsLine(restrictions?: string[]): string[] {
	const kept = (restrictions ?? []).map((r) => r.trim()).filter(Boolean);
	if (kept.length === 0) return [];

	return [`Eviter absolument : ${kept.join(', ')}. Ne les inclure dans aucun ingredient.`];
}

/**
 * The household's dietary restrictions, gathered from every `household_persons.dietary_notes` — account
 * holder or not, since an allergy is an allergy regardless of who carries it.
 */
export function restrictionsOf(people: { dietaryNotes?: string }[]): string[] {
	return people.map((p) => p.dietaryNotes?.trim()).filter((n): n is string => !!n);
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
		...restrictionsLine(options.restrictions),
		'Reponds uniquement par un objet JSON, sans texte autour et sans bloc de code.',
		'Forme exacte attendue :',
		RECIPE_JSON_SHAPE,
		`"emoji" est un seul caractere emoji. "servings" vaut ${servings}.`,
		`"unit" vaut obligatoirement l'une de ces valeurs : ${UNITS.join(', ')}.`,
		'"qty" est un nombre ecrit en chiffres, ou une chaine vide si la quantite ne se compte pas.',
		'"steps" contient les etapes de preparation, une par entree, dans l ordre.',
		STEP_INGREDIENTS_RULE,
		IMAGE_PROMPT_RULE
	].join('\n');
}

/**
 * The request sent when a page publishes no schema.org `Recipe` (#182): the same shape as `recipePrompt`,
 * asked from the page's own readable text instead of the household's purchases.
 *
 * This text has already left the instance's edge function once, guarded against SSRF and capped in size by
 * `readableText`; sending it on to the person's own provider is a second, explicit step the screen must
 * announce before it happens, exactly like `recipePrompt`'s sending screen.
 */
export function recipeExtractionPrompt(pageText: string, options: PromptOptions): string {
	const servings = clampServings(options.servings);

	return [
		`Voici le texte d une page web qui publie une recette de cuisine.`,
		'Texte de la page :',
		pageText,
		'',
		`Ecris la recette qu elle decrit, en ${options.language}.`,
		`Si le texte ne precise pas de nombre de personnes, prevois-la pour ${servings} personnes.`,
		...restrictionsLine(options.restrictions),
		'Reponds uniquement par un objet JSON, sans texte autour et sans bloc de code.',
		'Forme exacte attendue :',
		RECIPE_JSON_SHAPE,
		'"emoji" est un seul caractere emoji.',
		`"unit" vaut obligatoirement l'une de ces valeurs : ${UNITS.join(', ')}.`,
		'"qty" est un nombre ecrit en chiffres, ou une chaine vide si la quantite ne se compte pas.',
		'"steps" contient les etapes de preparation, une par entree, dans l ordre.',
		STEP_INGREDIENTS_RULE,
		IMAGE_PROMPT_RULE
	].join('\n');
}

/**
 * The request sent when the person simply types what they want ("un curry de poulet pour 4"), rather than
 * starting from what the household has bought or from a page's text: the same shape as `recipePrompt` and
 * `recipeExtractionPrompt`, asked from a free-text description instead.
 *
 * `userText` is the only thing this function sends on: no household context, no product list, nothing but
 * the words the person themselves typed and is shown before it leaves.
 */
export function recipeFromRequestPrompt(userText: string, options: PromptOptions): string {
	const servings = clampServings(options.servings);

	return [
		`Voici une demande de recette de cuisine, ecrite par une personne :`,
		userText,
		'',
		`Ecris une recette qui y repond, en ${options.language}.`,
		`Si la demande ne precise pas de nombre de personnes, prevois-la pour ${servings} personnes.`,
		...restrictionsLine(options.restrictions),
		'Reponds uniquement par un objet JSON, sans texte autour et sans bloc de code.',
		'Forme exacte attendue :',
		RECIPE_JSON_SHAPE,
		'"emoji" est un seul caractere emoji.',
		`"unit" vaut obligatoirement l'une de ces valeurs : ${UNITS.join(', ')}.`,
		'"qty" est un nombre ecrit en chiffres, ou une chaine vide si la quantite ne se compte pas.',
		'"steps" contient les etapes de preparation, une par entree, dans l ordre.',
		STEP_INGREDIENTS_RULE,
		IMAGE_PROMPT_RULE
	].join('\n');
}

/**
 * A follow-up message in an ongoing conversation (#226) — "et si je remplace le poulet par du tofu ?",
 * "plus epice" — sent alongside the earlier turns so the provider keeps what was already discussed.
 *
 * Design decision: every assistant turn, including this one's answer, is required to restate the complete
 * recipe as the same JSON object the very first turn asks for, never a plain-text reply on its own. A
 * follow-up rarely produces a fresh full recipe by itself ("plus epice" says nothing about the other
 * ingredients), so without this instruction repeated on every turn a model would drift towards answering
 * only the delta in prose. Restating the whole object keeps `parseRecipeSuggestion` and
 * `RecipeSuggestionCard` completely unchanged for every turn of the thread, one-shot or not — the
 * alternative (accepting plain-text turns) would need a second reply shape and a second review UI for no
 * benefit, since the person only ever wants a complete, acceptable recipe out of the exchange.
 */
export function recipeFollowUpPrompt(userText: string, options: PromptOptions): string {
	const servings = clampServings(options.servings);

	return [
		`Voici une suite a la conversation, ecrite par la meme personne :`,
		userText,
		'',
		`Mets a jour la recette en tenant compte de cette demande, en ${options.language}.`,
		`Garde ${servings} personnes sauf si la demande dit le contraire.`,
		'Reponds de nouveau par la recette complete, uniquement par un objet JSON, sans texte autour et sans bloc de code.',
		'Forme exacte attendue :',
		RECIPE_JSON_SHAPE,
		'"emoji" est un seul caractere emoji.',
		`"unit" vaut obligatoirement l'une de ces valeurs : ${UNITS.join(', ')}.`,
		'"qty" est un nombre ecrit en chiffres, ou une chaine vide si la quantite ne se compte pas.',
		'"steps" contient les etapes de preparation, une par entree, dans l ordre.',
		STEP_INGREDIENTS_RULE,
		IMAGE_PROMPT_RULE
	].join('\n');
}

/**
 * The request sent alongside a photo (#266): a page photographed from a book, or a handwritten/printed
 * recipe. The image itself is not built here — `ai.svelte.ts` attaches it to the request in the shape its
 * provider's dialect expects — but the text instruction travelling with it is, for the same reason every
 * other prompt in this file is: so the screen can show what is asked before it leaves, text and photo alike.
 */
export function recipeFromPhotoPrompt(options: PromptOptions): string {
	const servings = clampServings(options.servings);

	return [
		`Voici la photo d une page de livre ou d une recette de cuisine ecrite ou imprimee.`,
		`Lis-la et ecris la recette qu elle decrit, en ${options.language}.`,
		`Si la photo ne precise pas de nombre de personnes, prevois-la pour ${servings} personnes.`,
		...restrictionsLine(options.restrictions),
		'Reponds uniquement par un objet JSON, sans texte autour et sans bloc de code.',
		'Forme exacte attendue :',
		RECIPE_JSON_SHAPE,
		'"emoji" est un seul caractere emoji.',
		`"unit" vaut obligatoirement l'une de ces valeurs : ${UNITS.join(', ')}.`,
		'"qty" est un nombre ecrit en chiffres, ou une chaine vide si la quantite ne se compte pas.',
		'"steps" contient les etapes de preparation, une par entree, dans l ordre.',
		STEP_INGREDIENTS_RULE,
		IMAGE_PROMPT_RULE
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
	/** For each of `steps`, the indices in `ingredients` it uses (#308). */
	stepIngredients: number[][];
	imagePrompt?: string;
}

/**
 * The request sent the first time a photo is generated for a recipe no AI wrote (typed by hand, imported
 * from a page's schema.org data): the same description the recipe prompts ask for, on its own.
 */
export function imagePromptRequest(recipeName: string, ingredientNames: string[], steps: string[]): string {
	const ingredients = ingredientNames.filter(Boolean).join(', ');
	const method = steps.filter(Boolean).join(' ');

	return [
		'Describe, in English and in one or two sentences, a photo of this finished dish for an image generator:',
		'type of dish, visible ingredients, texture, plating, vessel, setting. No text in the image.',
		`Dish: ${recipeName.trim()}`,
		...(ingredients ? [`Ingredients: ${ingredients}`] : []),
		...(method ? [`Method: ${method.slice(0, 800)}`] : []),
		'Reply with the description only, no introduction and no quotes.'
	].join('\n');
}

/** A description the model returned, trimmed of the quotes and labels models add despite the instruction. */
export function cleanImagePrompt(text: string): string | null {
	const cleaned = text
		.trim()
		.replace(/^(image ?prompt|description|prompt)\s*:\s*/i, '')
		.replace(/^["'“”«»\s]+|["'“”«»\s]+$/g, '')
		.replace(/\s+/g, ' ')
		.slice(0, MAX_IMAGE_PROMPT_LENGTH)
		.trim();

	return cleaned || null;
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
function suggestedLinks(raw: unknown, allIngredients: RecipeLine[], allSteps: string[]): number[][] {
	// The model numbers the lines it wrote, blank ones included: its indices are moved onto the kept lines.
	const keptIndex = new Map<number, number>();
	allIngredients.forEach((line, index) => {
		if (line.name !== '') keptIndex.set(index, keptIndex.size);
	});

	const given = sanitizeLinks(raw, allSteps.length, allIngredients.length)
		.map(indices => indices.flatMap(index => (keptIndex.has(index) ? [keptIndex.get(index)!] : [])))
		.filter((_, step) => allSteps[step] !== '');

	if (given.some(indices => indices.length > 0)) return given;

	return guessLinks(
		allIngredients.filter(line => line.name !== '').map(line => line.name),
		allSteps.filter(Boolean)
	);
}

export function parseRecipeSuggestion(text: string): SuggestedRecipe | null {
	const root = asRecord(extractJson(text));
	if (!root) return null;

	const name = asText(root.name);
	if (!name) return null;

	const allIngredients = (Array.isArray(root.ingredients) ? root.ingredients : [])
		.map(asRecord)
		.map(line => ({
			name: asText(line?.name),
			qty: asText(line?.qty).replace(/\s+/g, ''),
			// `resolveUnit` already knows the aliases and the plurals written by hand: a model answering "grammes"
			// despite the instruction falls back on `g` instead of being brought back to the piece.
			unit: resolveUnit(line?.unit as string) ?? DEFAULT_UNIT
		}));
	const ingredients = allIngredients.filter(line => line.name !== '');

	if (ingredients.length === 0) return null;

	const emoji = [...asText(root.emoji)][0] ?? FALLBACK_EMOJI;

	const allSteps = (Array.isArray(root.steps) ? root.steps : []).map(asText);
	const steps = allSteps.filter(Boolean);
	const imagePrompt = cleanImagePrompt(asText(root.imagePrompt)) ?? undefined;

	return {
		imagePrompt,
		name,
		emoji,
		servings: clampServings(Number(root.servings)),
		ingredients,
		// A recipe with no step is still a recipe — the shopping list, which is the point, does not need one. We
		// keep an empty entry so that the review form has its row.
		steps: steps.length > 0 ? steps : [''],
		stepIngredients: steps.length > 0 ? suggestedLinks(root.stepIngredients, allIngredients, allSteps) : [[]]
	};
}
