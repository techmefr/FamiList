import { test, expect } from './fixtures';
import type { Locator, Page } from '@playwright/test';

/**
 * Recipe tags (#314): ticked in the form, shown as chips on the card, kept through an edit, and proposed
 * by a link import from the page's schema.org categories. The import's edge function is answered here, so
 * no third-party page is fetched and nothing depends on the network.
 */

const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-headers': '*',
	'access-control-allow-methods': 'POST, OPTIONS'
};

async function mockImport(page: Page, recipe: unknown) {
	await page.route('**/functions/v1/import-recipe', async (route) => {
		if (route.request().method() === 'OPTIONS') {
			await route.fulfill({ status: 204, headers: CORS });
			return;
		}
		await route.fulfill({
			status: 200,
			headers: CORS,
			contentType: 'application/json',
			body: JSON.stringify(recipe)
		});
	});
}

/** The keys the chips show, whatever the account's language: the words are the locale files' business. */
const tagsOf = (chips: Locator) =>
	chips.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-test-tag')));

async function finishForm(page: Page, ingredient: string) {
	await page.getByTestId('recipe-next').click();
	await page.locator('[data-test-class="ingredient-name"]').first().fill(ingredient);
	await page.getByTestId('recipe-next').click();
	await page.getByTestId('recipe-next').click();
}

test.describe('categories de recette', () => {
	test('cocher des categories les affiche sur la carte, et la modification les retrouve', async ({
		signedInPage: page
	}) => {
		const name = `Recette categories e2e ${Date.now()}`;

		await page.goto('/recipes/new');
		await page.getByTestId('recipe-source-manual').click();
		await page.getByTestId('recipe-name').fill(name);

		await expect(page.getByTestId('recipe-tags')).toBeVisible();
		await page.getByTestId('recipe-tag-soup').check();
		await page.getByTestId('recipe-tag-vegetarian').check();
		await page.getByTestId('recipe-tag-winter').check();
		await expect(page.getByTestId('recipe-tag-soup')).toBeChecked();

		await finishForm(page, 'Poireaux');

		const card = page.locator('[data-test-class="recipe-card"]').filter({ hasText: name });
		const chips = card.locator('[data-test-class="recipe-tag-chip"]');
		await expect.poll(() => tagsOf(chips)).toEqual(['soup', 'vegetarian', 'winter']);

		await card.locator('[data-test-class="recipe-card-header"]').click();
		await card.locator('[data-test-class="recipe-edit"]').click();

		await expect(page.getByTestId('recipe-tag-soup')).toBeChecked();
		await expect(page.getByTestId('recipe-tag-vegetarian')).toBeChecked();
		await expect(page.getByTestId('recipe-tag-winter')).toBeChecked();
		await expect(page.getByTestId('recipe-tag-dessert')).not.toBeChecked();

		await page.getByTestId('recipe-tag-winter').uncheck();
		await page.getByTestId('recipe-tag-quick').check();
		await page.getByTestId('recipe-next').click();
		await page.getByTestId('recipe-next').click();
		await page.getByTestId('recipe-next').click();

		await expect.poll(() => tagsOf(chips)).toEqual(['soup', 'vegetarian', 'quick']);
	});

	test('l import d un lien coche les categories annoncees par la page', async ({ signedInPage: page }) => {
		const name = `Gratin importe e2e ${Date.now()}`;

		await mockImport(page, {
			name,
			ingredients: ['600 g de courgettes'],
			steps: ['Enfourner 30 minutes.'],
			servings: '4 personnes',
			image: null,
			categories: ['Plat principal', 'Française', 'https://schema.org/VegetarianDiet']
		});

		await page.goto('/recipes/new');
		await page.getByTestId('recipe-source-link').click();
		await page.getByTestId('recipe-import-url').fill('https://exemple.test/gratin');
		await page.getByTestId('recipe-import-submit').click();

		await expect(page.getByTestId('recipe-import-review')).toBeVisible();
		await expect(page.getByTestId('recipe-name')).toHaveValue(name);
		await expect(page.getByTestId('recipe-tag-main')).toBeChecked();
		await expect(page.getByTestId('recipe-tag-vegetarian')).toBeChecked();
		await expect(page.getByTestId('recipe-tag-dessert')).not.toBeChecked();

		await page.getByTestId('recipe-next').click();
		await page.getByTestId('recipe-next').click();
		await page.getByTestId('recipe-next').click();

		const card = page.locator('[data-test-class="recipe-card"]').filter({ hasText: name });
		await expect
			.poll(() => tagsOf(card.locator('[data-test-class="recipe-tag-chip"]')))
			.toEqual(['main', 'vegetarian']);
	});
});
