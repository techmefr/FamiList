import { test, expect, signIn, FIXTURE_EMAIL, FIXTURE_PASSWORD } from './fixtures';
import { presetAppearance } from './a11y';
import type { Page } from '@playwright/test';
import { createRecipe, recipeCard } from './recipe-helpers';

/**
 * The recipe filters sheet (#316): categories with their count, the selected filters above all the others,
 * one search over both, clear all and apply; and its stacked shape at the largest text size, in Arabic,
 * for a left hand.
 */

const option = (page: Page, zone: 'all' | 'selected', key: string) =>
	page.locator(
		`[data-test-class="${zone === 'all' ? 'recipe-filter-option' : 'recipe-filter-selected-option'}"][data-test-key="${key}"]`
	);

test.describe('filtres de recettes', () => {
	test('filtrer par type de plat, ingredient et temps, puis tout effacer', async ({ signedInPage: page }) => {
		const stamp = Date.now();
		const gratin = `Gratin filtres ${stamp}`;
		const tarte = `Tarte filtres ${stamp}`;
		const leek = `Poireau${stamp}`;

		await createRecipe(page, { name: gratin, ingredient: leek, tags: ['main', 'vegetarian'], minutes: '20' });
		await createRecipe(page, { name: tarte, ingredient: 'Pommes', tags: ['dessert'] });

		// The search narrows the wall to this test's two recipes: the shared account holds everybody else's.
		await page.getByTestId('recipe-search').fill(`filtres ${stamp}`);
		await expect(page.locator('[data-test-class="recipe-card"]')).toHaveCount(2);

		await page.getByTestId('recipe-filters-open').click();
		const sheet = page.getByTestId('recipe-filter-sheet');
		await expect(sheet).toBeVisible();
		await expect(page.getByTestId('recipe-filter-body')).toHaveAttribute('data-layout', 'columns');

		await page.getByTestId('recipe-filter-category-course').click();
		await option(page, 'all', 'dessert').check();
		await expect(option(page, 'selected', 'dessert')).toBeChecked();
		await expect(page.getByTestId('recipe-filter-count-course')).toHaveText('1');
		await page.getByTestId('recipe-filter-apply').click();

		await expect(sheet).toBeHidden();
		await expect(recipeCard(page, tarte)).toBeVisible();
		await expect(recipeCard(page, gratin)).toHaveCount(0);
		await expect(page.getByTestId('recipe-filters-count')).toHaveText('1');

		await page.getByTestId('recipe-filters-open').click();
		await page.getByTestId('recipe-filter-reset').click();
		await page.getByTestId('recipe-filter-category-ingredient').click();
		await page.getByTestId('recipe-filter-query').fill(leek.toUpperCase());
		await expect(page.locator('[data-test-class="recipe-filter-option"]')).toHaveCount(1);
		await page.locator('[data-test-class="recipe-filter-option"]').check();
		await expect(page.getByTestId('recipe-filter-count-ingredient')).toHaveText('1');
		await expect(page.getByTestId('recipe-filter-count-course')).toHaveCount(0);
		await page.getByTestId('recipe-filter-apply').click();

		await expect(recipeCard(page, gratin)).toBeVisible();
		await expect(recipeCard(page, tarte)).toHaveCount(0);

		await page.getByTestId('recipe-filters-open').click();
		await page.getByTestId('recipe-filter-reset').click();
		await page.getByTestId('recipe-filter-category-time').click();
		await option(page, 'all', 'upTo30').check();
		await page.getByTestId('recipe-filter-apply').click();

		await expect(recipeCard(page, gratin)).toBeVisible();
		await expect(recipeCard(page, tarte)).toHaveCount(0);

		await page.getByTestId('recipe-filters-open').click();
		await page.getByTestId('recipe-filter-reset').click();
		await expect(page.getByTestId('recipe-filter-reset')).toBeDisabled();
		await page.getByTestId('recipe-filter-apply').click();

		await expect(page.getByTestId('recipe-filters-count')).toHaveCount(0);
		await expect(page.locator('[data-test-class="recipe-card"]')).toHaveCount(2);
	});

	test('la recherche de la feuille filtre les choisis et tous les filtres, et fermer n applique rien', async ({
		signedInPage: page
	}) => {
		const name = `Soupe feuille ${Date.now()}`;
		await createRecipe(page, { name, ingredient: 'Carottes', tags: ['soup'] });

		await page.getByTestId('recipe-filters-open').click();
		await page.getByTestId('recipe-filter-category-course').click();
		await option(page, 'all', 'soup').check();
		await option(page, 'all', 'dessert').check();
		await expect(page.locator('[data-test-class="recipe-filter-selected-option"]')).toHaveCount(2);

		await page.getByTestId('recipe-filter-query').fill('SOU');
		await expect(page.locator('[data-test-class="recipe-filter-selected-option"]')).toHaveCount(1);
		await expect(option(page, 'selected', 'soup')).toBeVisible();
		await expect(page.locator('[data-test-class="recipe-filter-option"]')).toHaveCount(1);

		await option(page, 'all', 'soup').uncheck();
		await expect(option(page, 'selected', 'soup')).toHaveCount(0);
		await expect(page.getByTestId('recipe-filter-count-course')).toHaveText('1');

		await page.getByTestId('recipe-filter-sheet-close').click();
		await expect(page.getByTestId('recipe-filters-count')).toHaveCount(0);
	});

	test('empile les colonnes en police confort, en arabe, pour un gaucher', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 780 });
		await presetAppearance(page, { fontScaleId: 'comfort', fontId: 'atkinson', hand: 'left' });
		await page.addInitScript(() => localStorage.setItem('familist:locale', 'ar'));
		await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);

		await createRecipe(page, { name: `Recette confort ${Date.now()}`, ingredient: 'Riz', tags: ['main'] });
		await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
		await expect(page.locator('html')).toHaveAttribute('data-hand', 'left');

		const bar = page.getByTestId('recipe-search-bar');
		const filters = page.getByTestId('recipe-filters-open');
		const create = page.getByTestId('nav-create');
		for (const target of [bar, filters, page.getByTestId('recipe-search')]) {
			const box = (await target.boundingBox())!;
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(360);
			expect(box.height).toBeGreaterThanOrEqual(44);
		}

		// Never over the create button, which a left hand keeps on the left.
		const barBox = (await bar.boundingBox())!;
		const createBox = (await create.boundingBox())!;
		expect(createBox.x + createBox.width).toBeLessThanOrEqual(barBox.x);

		await filters.click();
		const body = page.getByTestId('recipe-filter-body');
		await expect(body).toHaveAttribute('data-layout', 'stacked');
		await expect(page.getByTestId('recipe-filter-detail')).toHaveCount(0);

		await page.getByTestId('recipe-filter-category-diet').click();
		await expect(page.getByTestId('recipe-filter-detail')).toBeVisible();
		await expect(page.getByTestId('recipe-filter-category-diet')).toHaveCount(0);
		await option(page, 'all', 'vegan').check();

		const sheetOverflow = await page
			.getByTestId('recipe-filter-sheet')
			.evaluate((node) => node.scrollWidth - node.clientWidth);
		expect(sheetOverflow).toBeLessThanOrEqual(0);

		await page.getByTestId('recipe-filter-back').click();
		await expect(page.getByTestId('recipe-filter-category-diet')).toBeFocused();
		await expect(page.getByTestId('recipe-filter-count-diet')).toHaveText('1');
	});
});
