import { test, expect } from './fixtures';

test.describe('modifier une recette', () => {
	test('le bouton modifier amene au formulaire rempli, et l enregistrement revient sur la carte', async ({
		signedInPage: page
	}) => {
		const name = `Recette a modifier e2e ${Date.now()}`;

		await page.goto('/recipes/new');
		await page.getByTestId('recipe-source-manual').click();
		await page.getByTestId('recipe-name').fill(name);
		await page.getByTestId('recipe-servings').fill('6');
		await page.getByTestId('recipe-notes').fill('Meilleure le lendemain');
		await page.getByTestId('recipe-next').click();
		await page.locator('[data-test-class="ingredient-name"]').first().fill('Farine');
		await page.locator('[data-test-class="ingredient-qty"]').first().fill('250');
		await page.getByTestId('recipe-next').click();
		await page.locator('[data-test-class="recipe-step"]').first().fill('Tout melanger');
		await page.getByTestId('recipe-next').click();

		const card = page.locator('[data-test-class="recipe-card"]').filter({ hasText: name });
		await card.locator('[data-test-class="recipe-card-header"]').click();
		await expect(card.locator('[data-test-class="recipe-notes-body"]')).toHaveText('Meilleure le lendemain');

		await card.locator('[data-test-class="recipe-edit"]').click();

		const title = page.getByTestId('recipe-form-title');
		await expect(title).toBeInViewport();
		await expect(title).toBeFocused();
		await expect(page.getByTestId('recipe-name')).toHaveValue(name);
		await expect(page.getByTestId('recipe-servings')).toHaveValue('6');
		await expect(page.getByTestId('recipe-notes')).toHaveValue('Meilleure le lendemain');
		await expect(page.getByTestId('recipe-form').locator('[data-test-class="recipe-photo-button"]')).toBeVisible();

		const renamed = `${name} bis`;
		await page.getByTestId('recipe-name').fill(renamed);
		await page.getByTestId('recipe-notes').fill('Encore meilleure le surlendemain');
		await page.getByTestId('recipe-next').click();

		await expect(page.locator('[data-test-class="ingredient-name"]').first()).toHaveValue('Farine');
		await expect(page.locator('[data-test-class="ingredient-qty"]').first()).toHaveValue('250');
		await page.locator('[data-test-class="ingredient-name"]').first().fill('Farine de ble');
		await page.getByTestId('recipe-next').click();

		await expect(page.locator('[data-test-class="recipe-step"]').first()).toHaveValue('Tout melanger');
		await page.getByTestId('recipe-next').click();

		const edited = page.locator('[data-test-class="recipe-card"]').filter({ hasText: renamed });
		await expect(edited).toBeInViewport();
		await expect(edited).toContainText('Farine de ble');
		await expect(edited.locator('[data-test-class="recipe-notes-body"]')).toHaveText(
			'Encore meilleure le surlendemain'
		);
	});
});
