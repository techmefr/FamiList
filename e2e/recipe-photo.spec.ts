import { test, expect } from './fixtures';

/** A 1x1 red pixel JPEG, small enough to inline: Pollinations' own bytes are never fetched in a test. */
const FAKE_JPEG = Buffer.from(
	'/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
	'base64'
);

/** A 1x1 PNG the browser can decode: a search result whose preview fails to load is removed from the sheet. */
const FAKE_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
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

		await expect(page.locator('[data-test-class="toast"][data-tone="success"]')).toBeVisible();
		await expect(card.locator('[data-test-class="recipe-photo-regenerate"]')).toBeVisible();
	});

	test('une generation refusee le dit au lieu de ne rien faire', async ({ signedInPage: page }) => {
		const name = `Recette photo refusee e2e ${Date.now()}`;

		await page.route('https://image.pollinations.ai/prompt/**', async (route) => {
			await route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Missing token"}' });
		});

		const card = await createRecipe(page, name);
		await card.locator('[data-test-class="recipe-card-header"]').click();
		await card.locator('[data-test-class="recipe-photo-button"]').click();

		await expect(page.locator('[data-test-class="toast"][data-tone="error"]')).toBeVisible();
		await expect(card.locator('[data-test-class="recipe-photo"]')).toHaveCount(0);
	});
});

test.describe("recherche d'image de recette", () => {
	test("ouvre une fenetre, montre les resultats et pose l'image choisie", async ({ signedInPage: page }) => {
		const name = `Recette recherche e2e ${Date.now()}`;

		await page.route('https://api.openverse.org/v1/images/?**', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					results: [1, 2, 3].map((n) => ({
						id: `img-${n}`,
						title: `Plat ${n}`,
						thumbnail: `https://thumbs.example.test/${n}.jpg`,
						creator: 'Auteur',
						license: 'by'
					}))
				})
			});
		});
		await page.route('https://thumbs.example.test/**', async (route) => {
			await route.fulfill({ status: 200, contentType: 'image/png', body: FAKE_PNG });
		});

		const card = await createRecipe(page, name);
		await card.locator('[data-test-class="recipe-card-header"]').click();
		await card.locator('[data-test-class="recipe-photo-search-button"]').click();

		const sheet = page.getByTestId('recipe-image-search');
		await expect(sheet).toBeVisible();
		await expect(page.getByTestId('recipe-image-search-query')).toHaveValue(new RegExp(name));

		const results = sheet.locator('[data-test-class="recipe-image-search-result"]');
		await expect(results).toHaveCount(3);
		await results.nth(1).click();

		await expect(sheet).toBeHidden({ timeout: 15_000 });
		await expect(page.locator('[data-test-class="toast"][data-tone="success"]')).toBeVisible();
		await expect(card.locator('[data-test-class="recipe-photo"]')).toBeVisible({ timeout: 15_000 });
	});

	test("dit quand rien n'est trouve", async ({ signedInPage: page }) => {
		const name = `Recette introuvable e2e ${Date.now()}`;

		await page.route('https://api.openverse.org/v1/images/?**', async (route) => {
			await route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' });
		});

		const card = await createRecipe(page, name);
		await card.locator('[data-test-class="recipe-card-header"]').click();
		await card.locator('[data-test-class="recipe-photo-search-button"]').click();

		await expect(page.getByTestId('recipe-image-search-error')).toBeVisible();
	});
});
