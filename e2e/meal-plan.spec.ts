import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * The weekly meal plan (#210): a plan is created and persisted, several recipes are picked into it with
 * their own `people` (independent of one another and of each recipe's own `servings`, per
 * `src/lib/domain/meal-plan.ts`), edited in place, then the consolidated shopping list is generated.
 */
async function createRecipe(page: Page, name: string, ingredient: string, qty: string) {
	await page.goto('/recipes');
	await page.getByTestId('recipe-new').click();
	await page.getByTestId('recipe-name').fill(name);
	await page.getByTestId('recipe-next').click();

	await page.locator('[data-test-class="ingredient-name"]').first().fill(ingredient);
	await page.locator('[data-test-class="ingredient-qty"]').first().fill(qty);
	await page.getByTestId('recipe-next').click();
	await page.getByTestId('recipe-next').click();

	await expect(
		page.locator('[data-test-class="recipe-card"]').filter({ hasText: name })
	).toBeVisible();
}

test.describe('menu de la semaine', () => {
	test('le bouton de creation propose le menu de la semaine', async ({ signedInPage: page }) => {
		await page.goto('/');

		await page.getByTestId('nav-create').click();
		await expect(page.getByTestId('create-menu')).toBeVisible();

		await page.getByTestId('create-mealPlan').click();
		await expect(page).toHaveURL(/\/meal-plan$/);
	});

	test('creer un plan, y ajouter des recettes, les editer et generer la liste', async ({
		signedInPage: page
	}) => {
		const stamp = Date.now();
		const firstRecipe = `Plat menu e2e A ${stamp}`;
		const secondRecipe = `Plat menu e2e B ${stamp}`;

		await createRecipe(page, firstRecipe, 'Riz', '200');
		await createRecipe(page, secondRecipe, 'Riz', '300');

		await page.goto('/recipes');
		await page.getByTestId('recipes-meal-plan-link').click();
		await expect(page).toHaveURL(/\/meal-plan$/);

		await page.getByTestId('meal-plan-create').click();
		await expect(page).toHaveURL(/\/meal-plan\/[^/]+$/);

		await page.getByTestId('meal-plan-pick').click();
		const picker = page.locator('dialog[data-test-id="meal-plan-recipe-picker"]');
		await expect(picker).toBeVisible();

		const firstToggle = picker
			.locator('[data-test-class="meal-plan-recipe-toggle"]')
			.filter({ hasText: firstRecipe });
		await firstToggle.locator('[data-test-class="meal-plan-recipe-checkbox"]').check();

		const secondToggle = picker
			.locator('[data-test-class="meal-plan-recipe-toggle"]')
			.filter({ hasText: secondRecipe });
		await secondToggle.locator('[data-test-class="meal-plan-recipe-checkbox"]').check();

		await page.getByTestId('meal-plan-picker-close').click();
		await expect(picker).toBeHidden();

		const entries = page.getByTestId('meal-plan-recipes');
		await expect(entries).toBeVisible();

		const firstEntry = entries.locator('li').filter({ hasText: firstRecipe });
		const secondEntry = entries.locator('li').filter({ hasText: secondRecipe });
		await expect(firstEntry).toBeVisible();
		await expect(secondEntry).toBeVisible();

		// Different `people` per recipe, independent of one another: editing one must not move the other.
		await firstEntry.locator('[data-test-class="meal-plan-people"]').fill('2');
		await firstEntry.locator('[data-test-class="meal-plan-people"]').blur();
		await secondEntry.locator('[data-test-class="meal-plan-people"]').fill('6');
		await secondEntry.locator('[data-test-class="meal-plan-people"]').blur();

		await firstEntry.locator('[data-test-class="meal-plan-day"]').selectOption('0');
		await secondEntry.locator('[data-test-class="meal-plan-day"]').selectOption('1');

		await expect(firstEntry.locator('[data-test-class="meal-plan-people"]')).toHaveValue('2');
		await expect(secondEntry.locator('[data-test-class="meal-plan-people"]')).toHaveValue('6');

		await page.getByTestId('meal-plan-generate-list').click();
		await expect(page).toHaveURL(/\/l\/[^/]+$/, { timeout: 15_000 });

		// Riz is on both recipes, same unit, so the consolidated list carries a single merged line rather than
		// two: at minimum the list is not empty, and this is the bonus check the task allows skipping if it
		// were not this easy to set up.
		const rows = page.locator('[data-test-class="item-row"]');
		await expect(rows.first()).toBeVisible();
		const riceRow = rows.filter({ hasText: 'Riz' });
		await expect(riceRow).toHaveCount(1);
	});
});
