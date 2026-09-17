/**
 * What we can read in a recipe page: the schema.org `Recipe` that nearly every cooking site publishes as
 * JSON-LD, because that is what Google asks of them to show their cards. It is structured data, put there on
 * purpose to be read by a machine: the extraction is therefore deterministic, and not guesswork on layout
 * HTML.
 *
 * We look at nothing else. No microdata, no fallback on heading tags, no heuristics on bulleted lists: a
 * page with no JSON-LD returns null, and the person types their recipe by hand as before. An approximation
 * pulled from the body of the page would look like a recipe without being one, and sorting it out costs more
 * than typing it.
 *
 * No Deno dependency, no HTML parser: `<script>` blocks are recognised with a regular expression, which
 * makes this whole file testable by vitest.
 */

export type ImportedRecipe = {
	name: string | null;
	/** Ingredient lines as written by the site, not split up: "2 tbsp of oil". */
	ingredients: string[];
	steps: string[];
	/** The number of servings as written: "4 people", "6". Interpretation is the client's. */
	servings: string | null;
};

const SCRIPT = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

const text = (value: unknown): string | null => {
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	if (typeof value !== 'string') return null;

	// Sites let entities and tags through in their JSON-LD fields.
	const cleaned = value
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
		.replace(/\s+/g, ' ')
		.trim();

	return cleaned === '' ? null : cleaned;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

function hasRecipeType(node: Record<string, unknown>): boolean {
	const type = node['@type'];
	const types = Array.isArray(type) ? type : [type];
	return types.some((entry) => typeof entry === 'string' && entry.toLowerCase() === 'recipe');
}

/** Goes down through arrays, `@graph` and wrappers to find the first `Recipe`. */
function findRecipe(node: unknown, depth = 0): Record<string, unknown> | null {
	if (depth > 6) return null;

	if (Array.isArray(node)) {
		for (const entry of node) {
			const found = findRecipe(entry, depth + 1);
			if (found) return found;
		}
		return null;
	}

	if (!isRecord(node)) return null;
	if (hasRecipeType(node)) return node;

	for (const value of Object.values(node)) {
		if (Array.isArray(value) || isRecord(value)) {
			const found = findRecipe(value, depth + 1);
			if (found) return found;
		}
	}

	return null;
}

function flatten(value: unknown, depth = 0): string[] {
	if (depth > 4) return [];
	if (Array.isArray(value)) return value.flatMap((entry) => flatten(entry, depth + 1));

	if (isRecord(value)) {
		// A `HowToSection` groups its steps in `itemListElement`; a `HowToStep` carries its text in `text`, and
		// sometimes only in `name`.
		if (value.itemListElement !== undefined) return flatten(value.itemListElement, depth + 1);
		const body = text(value.text) ?? text(value.name);
		return body ? [body] : [];
	}

	const single = text(value);
	return single ? [single] : [];
}

/** The recipe carried by a page, or null if it publishes none. */
export function extractRecipe(html: string): ImportedRecipe | null {
	SCRIPT.lastIndex = 0;

	for (const match of html.matchAll(SCRIPT)) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(match[1].trim());
		} catch {
			// An unreadable block does not stop the following ones: a page often carries several.
			continue;
		}

		const recipe = findRecipe(parsed);
		if (!recipe) continue;

		const ingredients = flatten(recipe.recipeIngredient);
		const steps = flatten(recipe.recipeInstructions);
		const name = text(recipe.name);

		// A `Recipe` with neither name nor ingredient has nothing to prefill: better say we found nothing than
		// open an empty form claiming to have imported it.
		if (!name && ingredients.length === 0) continue;

		return {
			name,
			ingredients,
			steps,
			servings: flatten(recipe.recipeYield)[0] ?? null
		};
	}

	return null;
}
