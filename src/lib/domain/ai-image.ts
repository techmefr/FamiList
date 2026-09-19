/** The instruction sent, built from what is already on screen: the recipe's own name and ingredients. */
export function dishPhotoPrompt(recipeName: string, ingredientNames: string[]): string {
	const dish = recipeName.trim();
	const ingredients = ingredientNames.filter(Boolean).join(', ');
	const subject = ingredients ? `${dish} (${ingredients})` : dish;

	return `A photorealistic, appetising photo of the finished dish: ${subject}. Plated on a table, natural light, no text or watermark.`;
}

/** Pollinations serves the image straight from the prompt in the path: no key, no request body. */
export function pollinationsImageUrl(prompt: string): string {
	return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
}

/** The path a photo is stored under: the household first, so storage's RLS can read it straight off the name. */
export function recipePhotoPath(householdId: string, recipeId: string, mimeType: string): string {
	const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
	return `${householdId}/${recipeId}.${extension}`;
}
