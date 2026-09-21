import { test, expect } from './fixtures';

/** A 1x1 red pixel JPEG, small enough to inline: Pollinations' own bytes are never fetched in a test. */
const FAKE_JPEG = Buffer.from(
	'/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
	'base64'
);

async function createRecipe(page: import('@playwright/test').Page, name: string) {
	await page.goto('/recipes');
	await page.getByTestId('recipe-new').click();
	await page.getByTestId('recipe-name').fill(name);
	await page.getByTestId('recipe-next').click();

	await page.locator('[data-test-class="ingredient-name"]').first().fill('Farine');
	await page.getByTestId('recipe-next').click();
	await page.getByTestId('recipe-next').click();

	const card = page.locator('[data-test-class="recipe-card"]').filter({ hasText: name });
	await expect(card).toBeVisible();
	return card;
}

/**
 * The Pollinations photo generation (#203, #186): keyless, so `canGeneratePhoto` no longer gates the button
 * on a provider being configured — no AI key is set anywhere in this suite. The real `image.pollinations.ai`
 * request is intercepted: nothing here should depend on that third party being reachable or fast in CI.
 */
test.describe('photo de recette Pollinations', () => {
	test('generer une photo ne demande aucune cle IA configuree', async ({ signedInPage: page }) => {
		const name = `Recette photo e2e ${Date.now()}`;

		await page.route('https://image.pollinations.ai/prompt/**', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'image/jpeg',
				body: FAKE_JPEG
			});
		});

		const card = await createRecipe(page, name);

		// The card is a collapsed accordion by default (#246): photo and actions only show once opened.
		await card.locator('[data-test-class="recipe-card-header"]').click();

		// No AI key is configured for this account (the whole point of #186): the button must be there anyway.
		const generateButton = card.locator('[data-test-class="recipe-photo-button"]');
		await expect(generateButton).toBeVisible();

		await generateButton.click();
		await expect(page.locator('[data-test-class="recipe-photo"]').first()).toBeVisible({
			timeout: 15_000
		});

		// The generation button is gone now that a photo exists, replaced by the image itself.
		await expect(card.locator('[data-test-class="recipe-photo-button"]')).toHaveCount(0);
	});
});
