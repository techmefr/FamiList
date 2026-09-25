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
 * Openverse (api.openverse.org): a keyless, CORS-open index of openly licensed images, queried straight from
 * the browser like Pollinations already is — no server of our own to hide a key behind, so a keyless provider
 * is the only kind that fits here. `license_type=commercial,modification` keeps results a household can
 * actually put on a recipe card without a usage question hanging over it.
 */
export const IMAGE_SEARCH_PAGE_SIZE = 20;

export function openverseSearchUrl(query: string): string {
	const params = new URLSearchParams({
		q: query,
		page_size: String(IMAGE_SEARCH_PAGE_SIZE),
		license_type: 'commercial,modification'
	});
	return `https://api.openverse.org/v1/images/?${params.toString()}`;
}

interface OpenverseResult {
	id?: string;
	title?: string;
	thumbnail?: string;
	url?: string;
	creator?: string;
	license?: string;
	license_version?: string;
}

interface OpenverseSearchResponse {
	results?: OpenverseResult[];
}

/** One image a person can pick in the search sheet, with the credit its licence asks for. */
export interface ImageSearchResult {
	id: string;
	previewUrl: string;
	title: string;
	creator: string;
	license: string;
}

/**
 * The thumbnail is preferred over the original `url`: it is served from Openverse's own domain with CORS
 * open to any origin, while the original sits on whatever third-party site it was indexed from and may
 * refuse a cross-origin browser fetch entirely. `url` is kept as a fallback for a result Openverse returns
 * without a thumbnail.
 */
export function imageSearchResults(payload: unknown): ImageSearchResult[] {
	const results = (payload as OpenverseSearchResponse | null)?.results;
	if (!Array.isArray(results)) return [];

	return results.flatMap((result) => {
		const previewUrl = result?.thumbnail ?? result?.url;
		if (!result?.id || !previewUrl) return [];

		const license = [result.license?.toUpperCase(), result.license_version].filter(Boolean).join(' ');
		return [
			{
				id: result.id,
				previewUrl,
				title: result.title?.trim() ?? '',
				creator: result.creator?.trim() ?? '',
				license
			}
		];
	});
}

/** Why a photo could not be set, each one calling for a different next step from the person. */
export type PhotoFailure = 'offline' | 'unavailable' | 'unreachable' | 'not-found' | 'upload';

/** 401, 402 and 403 are the provider asking for a key or a balance we do not have: retrying cannot help. */
export function photoFailureOfStatus(status: number): PhotoFailure {
	return status === 401 || status === 402 || status === 403 ? 'unavailable' : 'unreachable';
}

const PHOTO_FAILURE_KEYS: Record<PhotoFailure, string> = {
	offline: 'ai.photoErrorOffline',
	unavailable: 'ai.photoErrorUnavailable',
	unreachable: 'ai.photoErrorUnreachable',
	'not-found': 'ai.photoSearchNotFound',
	upload: 'ai.photoErrorUpload'
};

export function photoFailureKey(failure: PhotoFailure): string {
	return PHOTO_FAILURE_KEYS[failure];
}
