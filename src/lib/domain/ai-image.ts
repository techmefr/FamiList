import type { Provider } from './ai';

/**
 * Image generation with Gemini's "nano banana" model, gated behind a question this file cannot answer.
 *
 * `ai.ts`'s header explains how the six providers in `PROVIDERS` were each checked for TEXT generation: a
 * real request with an `Origin` header, confirming the actual `POST` response — not only the `OPTIONS`
 * preflight — carries `access-control-allow-origin`. That check has NOT been repeated here for
 * `:generateContent` on `gemini-2.5-flash-image`, because no real Gemini key was available to run it from
 * this environment. The functions below are therefore request-building and response-parsing only, pure and
 * testable with no network — the one call that actually reaches the network is marked in `ai.svelte.ts` as
 * unverified, and may need to move behind a server-side relay if the browser turns out unable to read the
 * response.
 */

/** The only provider whose dialect can generate an image today. */
export const IMAGE_PROVIDER_ID = 'gemini';

export const IMAGE_MODEL = 'gemini-2.5-flash-image';

/**
 * Image generation is priced per image, well above a text reply of the same length: the person must see
 * that before clicking, not discover it on their bill. There is no public per-call figure stable enough to
 * print here, so the warning names the fact rather than a number that would go stale.
 */
export const IMAGE_GENERATION_IS_EXPENSIVE = true;

export interface ImageRequest {
	url: string;
	headers: Record<string, string>;
	body: string;
}

/** The instruction sent, built from what is already on screen: the recipe's own name and ingredients. */
export function dishPhotoPrompt(recipeName: string, ingredientNames: string[]): string {
	const dish = recipeName.trim();
	const ingredients = ingredientNames.filter(Boolean).join(', ');
	const subject = ingredients ? `${dish} (${ingredients})` : dish;

	return `A photorealistic, appetising photo of the finished dish: ${subject}. Plated on a table, natural light, no text or watermark.`;
}

export function buildImageRequest(provider: Provider, apiKey: string, prompt: string): ImageRequest {
	return {
		url: `${provider.base}/models/${IMAGE_MODEL}:generateContent`,
		headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
		body: JSON.stringify({
			contents: [{ parts: [{ text: prompt }] }],
			generationConfig: { responseModalities: ['IMAGE'] }
		})
	};
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const firstOf = (value: unknown): unknown => (Array.isArray(value) ? value[0] : undefined);

export interface GeneratedImage {
	/** Base64-encoded bytes, as Gemini returns them: not yet decoded, not yet uploaded anywhere. */
	base64: string;
	mimeType: string;
}

/**
 * The image inside a `generateContent` response, or null if the shape does not match what is expected.
 *
 * Field by field, like `parseReply` in `ai.ts`: an error envelope and a success envelope are not
 * distinguishable by chance access here either.
 */
export function parseImageReply(payload: unknown): GeneratedImage | null {
	const root = asRecord(payload);
	if (!root) return null;

	const candidate = asRecord(firstOf(root.candidates));
	const content = asRecord(candidate?.content);
	const part = asRecord(firstOf(content?.parts));
	const inlineData = asRecord(part?.inlineData ?? part?.inline_data);

	const base64 = inlineData?.data;
	const mimeType = inlineData?.mimeType ?? inlineData?.mime_type;

	if (typeof base64 !== 'string' || !base64) return null;

	return { base64, mimeType: typeof mimeType === 'string' && mimeType ? mimeType : 'image/png' };
}

/** The path a photo is stored under: the household first, so storage's RLS can read it straight off the name. */
export function recipePhotoPath(householdId: string, recipeId: string, mimeType: string): string {
	const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
	return `${householdId}/${recipeId}.${extension}`;
}
