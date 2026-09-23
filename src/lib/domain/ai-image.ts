/**
 * The instruction sent, built from what is already on screen: the recipe's own name and ingredients.
 *
 * The dish name alone ("Nems") is regularly too little for the provider to picture the right thing — it has
 * come back with a bowl of soup for it. Naming the dish's actual shape and cooking method, drawn from its
 * own ingredients, gives the model something concrete to render instead of guessing at a generic "Asian
 * food" scene.
 */
export function dishPhotoPrompt(recipeName: string, ingredientNames: string[]): string {
	const dish = recipeName.trim();
	const ingredients = ingredientNames.filter(Boolean).join(', ');
	const subject = ingredients ? `${dish}, made of ${ingredients}` : dish;

	return `A photorealistic, appetising photo of the finished dish named "${subject}". Show the dish exactly as its name says — do not substitute a different, more generic dish (no soup or drink unless the name itself says so). Plated on a table, natural light, no text or watermark.`;
}

/**
 * Pollinations serves the image straight from the prompt in the path: no key, no request body.
 *
 * `seed` is what lets a person ask for another try when the result does not match the dish: the provider
 * otherwise tends to answer the exact same prompt with the exact same (possibly wrong) image, so retrying
 * without changing anything would just fetch the same picture again.
 */
export function pollinationsImageUrl(prompt: string, seed: number): string {
	return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}`;
}

/** The path a photo is stored under: the household first, so storage's RLS can read it straight off the name. */
export function recipePhotoPath(householdId: string, recipeId: string, mimeType: string): string {
	const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
	return `${householdId}/${recipeId}.${extension}`;
}

/**
 * What is typed into the free-image search: the dish name plus its two or three main ingredients, so a
 * query stays specific ("Poulet basquaise poivron tomate") rather than the single word a household actually
 * named the recipe ("Poulet"), which returns whatever stock photo of chicken the bank happens to rank first.
 */
const MAX_SEARCH_INGREDIENTS = 3;

export function recipeImageSearchQuery(recipeName: string, ingredientNames: string[]): string {
	const dish = recipeName.trim();
	const ingredients = ingredientNames
		.map(name => name.trim())
		.filter(Boolean)
		.slice(0, MAX_SEARCH_INGREDIENTS);

	return [dish, ...ingredients].filter(Boolean).join(' ');
}

/**
 * Openverse (api.openverse.org): a keyless, CORS-open index of openly licensed images, queried straight from
 * the browser like Pollinations already is — no server of our own to hide a key behind, so a keyless provider
 * is the only kind that fits here. `license_type=commercial,modification` keeps results a household can
 * actually put on a recipe card without a usage question hanging over it.
 */
export function openverseSearchUrl(query: string): string {
	const params = new URLSearchParams({
		q: query,
		page_size: '1',
		license_type: 'commercial,modification'
	});
	return `https://api.openverse.org/v1/images/?${params.toString()}`;
}

/** One Openverse search hit, trimmed to what `pickImageResult` needs. */
export interface OpenverseResult {
	id?: string;
	thumbnail?: string;
	url?: string;
}

interface OpenverseSearchResponse {
	results?: OpenverseResult[];
}

/**
 * The thumbnail is preferred over the original `url`: it is served from Openverse's own domain with CORS
 * open to any origin, while the original sits on whatever third-party site it was indexed from and may
 * refuse a cross-origin browser fetch entirely. `url` is kept as a fallback for a result Openverse returns
 * without a thumbnail.
 */
export function pickImageResult(payload: unknown): string | null {
	const results = (payload as OpenverseSearchResponse | null)?.results;
	if (!Array.isArray(results) || results.length === 0) return null;

	const first = results[0];
	return first?.thumbnail ?? first?.url ?? null;
}
