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
