import { test, expect } from './fixtures';
import { createRecipe, recipeCard } from './recipe-helpers';

/**
 * The recipes' search bar (#315): name, ingredients and tags, accents and case aside, with the count
 * spoken and a way back to the whole wall; and recipes found from the household search as well.
 */
test.describe('recherche de recettes', () => {
	test('trouve par le nom, un ingredient ou une categorie, sans accents ni casse', async ({
		signedInPage: page
	}) => {
		const stamp = Date.now();
		const soup = `Velouté recherche ${stamp}`;
		const crumble = `Crumble recherche ${stamp}`;

		await createRecipe(page, { name: soup, ingredient: `Châtaigne${stamp}`, tags: ['soup'] });
		await createRecipe(page, { name: crumble, ingredient: 'Pommes', tags: ['dessert'] });

		const field = page.getByTestId('recipe-search');
		await expect(page.getByTestId('recipe-search-bar')).toBeVisible();

		await field.fill(`VELOUTE ${stamp}`);
		await expect(recipeCard(page, soup)).toBeVisible();
		await expect(recipeCard(page, crumble)).toHaveCount(0);
		await expect(page.getByTestId('recipe-search-count')).not.toBeEmpty();

		await field.fill(`chataigne${stamp}`);
		await expect(recipeCard(page, soup)).toBeVisible();
		await expect(page.locator('[data-test-class="recipe-card"]')).toHaveCount(1);

		await field.fill(`dessert recherche ${stamp}`);
		await expect(recipeCard(page, crumble)).toBeVisible();
		await expect(recipeCard(page, soup)).toHaveCount(0);

		await page.getByTestId('recipe-search-clear').click();
		await expect(field).toHaveValue('');
		await expect(field).toBeFocused();
		await expect(recipeCard(page, soup)).toBeVisible();
		await expect(recipeCard(page, crumble)).toBeVisible();
		await expect(page.getByTestId('recipe-search-count')).toBeEmpty();
	});

	test('une recherche sans resultat propose de tout afficher', async ({ signedInPage: page }) => {
		const name = `Recette vide ${Date.now()}`;
		await createRecipe(page, { name, ingredient: 'Farine' });

		await page.getByTestId('recipe-search').fill(`introuvable${Date.now()}`);
		await expect(page.getByTestId('recipes-search-empty')).toBeVisible();

		await page.getByTestId('recipes-search-reset').click();
		await expect(page.getByTestId('recipe-search')).toHaveValue('');
		await expect(recipeCard(page, name)).toBeVisible();
	});

	test('la recherche du foyer trouve une recette par un ingredient et l ouvre', async ({
		signedInPage: page
	}) => {
		const stamp = Date.now();
		const name = `Recette globale ${stamp}`;
		await createRecipe(page, { name, ingredient: `Topinambour${stamp}` });

		await page.goto('/');
		await page.getByTestId('header-search').click();
		await page.getByTestId('search-query').fill(`topinambour${stamp}`);

		const hit = page.locator('[data-test-class="search-hit"]').filter({ hasText: name });
		await expect(hit).toHaveCount(1);
		await hit.click();

		await expect(page).toHaveURL(/\/recipes\?recipe=/);
		await expect(recipeCard(page, name).locator('[data-test-class="recipe-card-panel"]')).toBeVisible();
	});
});
