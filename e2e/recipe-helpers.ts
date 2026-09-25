import { expect, type Page } from '@playwright/test';

export interface RecipeSeed {
	name: string;
	ingredient: string;
	tags?: string[];
	/** Minutes on the single step; none leaves the recipe without a total time. */
	minutes?: string;
}

/** Writes a recipe through the manual source, the same path a person takes. */
export async function createRecipe(page: Page, seed: RecipeSeed) {
	await page.goto('/recipes/new');
	await page.getByTestId('recipe-source-manual').click();
	await expect(page).toHaveURL(/\/recipes$/);

	await page.getByTestId('recipe-name').fill(seed.name);
	for (const tag of seed.tags ?? []) await page.getByTestId(`recipe-tag-${tag}`).check();
	await page.getByTestId('recipe-next').click();

	await page.locator('[data-test-class="ingredient-name"]').first().fill(seed.ingredient);
	await page.getByTestId('recipe-next').click();

	await page.locator('[data-test-class="recipe-step"]').first().fill('Cuire.');
	if (seed.minutes) await page.locator('[data-test-class="recipe-step-minutes"]').first().fill(seed.minutes);
	await page.getByTestId('recipe-next').click();

	await expect(page.locator('[data-test-class="recipe-card"]').filter({ hasText: seed.name })).toBeVisible();
}

export const recipeCard = (page: Page, name: string) =>
	page.locator('[data-test-class="recipe-card"]').filter({ hasText: name });
