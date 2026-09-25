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

/** What is sent to the image model: the recipe's own description when an AI wrote one, the template otherwise. */
export function recipeImagePrompt(
	imagePrompt: string | undefined,
	recipeName: string,
	ingredientNames: string[]
): string {
	const described = imagePrompt?.trim();
	if (!described) return dishPhotoPrompt(recipeName, ingredientNames);

	return `${described} Photorealistic food photography, natural light, no text or watermark.`;
}

/**
 * Pollinations stopped answering without a key (403, then 402), so generation goes through the person's own
 * OpenRouter key (#306). FLUX.2 klein is among the cheapest image models there, about a cent a picture, and
 * answers with an image only, hence `modalities: ['image']`. No image model is free on OpenRouter.
 *
 * `seed` is what lets a person ask for another try when the result does not match the dish: the same
 * prompt with the same seed would bring back the same picture.
 */
export const OPENROUTER_IMAGE_MODEL = 'black-forest-labs/flux.2-klein-4b';

export function openRouterImageRequest(apiKey: string, prompt: string, seed: number) {
	return {
		url: 'https://openrouter.ai/api/v1/chat/completions',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
		body: JSON.stringify({
			model: OPENROUTER_IMAGE_MODEL,
			modalities: ['image'],
			seed,
			messages: [{ role: 'user', content: prompt }]
		})
	};
}

/** The first generated image as a `data:` URL, or null when the answer carries none. */
export function openRouterImageUrl(payload: unknown): string | null {
	const choices = (payload as { choices?: unknown } | null)?.choices;
	if (!Array.isArray(choices)) return null;

	const images = (choices[0] as { message?: { images?: unknown } } | undefined)?.message?.images;
	if (!Array.isArray(images)) return null;

	const url = (images[0] as { image_url?: { url?: unknown } } | undefined)?.image_url?.url;
	return typeof url === 'string' && url.startsWith('data:image/') ? url : null;
}

/** The bytes and type of a `data:image/...;base64,` URL, or null if it is not one. */
export function decodeDataUrl(url: string): { bytes: Uint8Array; mimeType: string } | null {
	const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(url);
	if (!match) return null;

	try {
		const binary = atob(match[2]);
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		return { bytes, mimeType: match[1].toLowerCase() };
	} catch {
		return null;
	}
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
	source: 'openverse' | 'pexels' | 'pixabay';
	/** What the grid shows. */
	previewUrl: string;
	/** What gets copied into the recipe: larger than the preview when the bank offers one. */
	imageUrl: string;
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
				source: 'openverse' as const,
				previewUrl,
				imageUrl: previewUrl,
				title: result.title?.trim() ?? '',
				creator: result.creator?.trim() ?? '',
				license
			}
		];
	});
}

/** Why a photo could not be set, each one calling for a different next step from the person. */
export type PhotoFailure =
	| 'offline'
	| 'unavailable'
	| 'unreachable'
	| 'not-found'
	| 'upload'
	| 'no-key'
	| 'no-credit';

/** 401, 402 and 403 are the provider asking for a key or a balance we do not have: retrying cannot help. */
export function photoFailureOfStatus(status: number): PhotoFailure {
	return status === 401 || status === 402 || status === 403 ? 'unavailable' : 'unreachable';
}

/** On the person's own OpenRouter account, 402 means their balance is empty: only they can top it up. */
export function openRouterFailureOfStatus(status: number): PhotoFailure {
	return status === 402 ? 'no-credit' : photoFailureOfStatus(status);
}

const PHOTO_FAILURE_KEYS: Record<PhotoFailure, string> = {
	offline: 'ai.photoErrorOffline',
	unavailable: 'ai.photoErrorUnavailable',
	unreachable: 'ai.photoErrorUnreachable',
	'not-found': 'ai.photoSearchNotFound',
	upload: 'ai.photoErrorUpload',
	'no-key': 'ai.photoErrorNoKey',
	'no-credit': 'ai.photoErrorNoCredit'
};

export function photoFailureKey(failure: PhotoFailure): string {
	return PHOTO_FAILURE_KEYS[failure];
}
