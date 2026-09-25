import { test, expect } from './fixtures';

/**
 * Ingredients per step (#308): ticked in the form, shown one step at a time in cook-along, kept across an
 * edit, and the whole list as a fallback for a step nobody linked.
 */
test.describe('ingredients par etape', () => {
	test('les cases du formulaire decident de ce que montre le panneau', async ({ signedInPage: page }) => {
		const name = `Omelette e2e ${Date.now()}`;

		await page.goto('/recipes/new');
		await page.getByTestId('recipe-source-manual').click();
		await page.getByTestId('recipe-name').fill(name);
		await page.getByTestId('recipe-next').click();

		const ingredientNames = page.locator('[data-test-class="ingredient-name"]');
		await ingredientNames.first().fill('Oeufs');
		await page.getByTestId('recipe-add-ingredient').click();
		await ingredientNames.nth(1).fill('Beurre');
		await page.getByTestId('recipe-add-ingredient').click();
		await ingredientNames.nth(2).fill('Ciboulette');
		await page.getByTestId('recipe-next').click();

		const steps = page.locator('[data-test-class="recipe-step"]');
		await steps.first().fill('Battre les oeufs');
		await page.getByTestId('recipe-add-step').click();
		await steps.nth(1).fill('Cuire à feu doux');
		await page.getByTestId('recipe-add-step').click();
		await steps.nth(2).fill('Servir');

		const links = page.locator('[data-test-class="recipe-step-ingredients"]');
		await links.nth(0).getByRole('checkbox', { name: 'Oeufs' }).check();
		await links.nth(1).getByRole('checkbox', { name: 'Beurre' }).check();
		await links.nth(1).getByRole('checkbox', { name: 'Ciboulette' }).check();
		await page.getByTestId('recipe-next').click();

		const card = page.locator('[data-test-class="recipe-card"]').filter({ hasText: name });
		await expect(card).toBeVisible();
		await card.locator('[data-test-class="recipe-card-header"]').click();
		await card.locator('[data-test-class="recipe-cook-along"]').click();

		const cookAlong = page.getByTestId('cook-along');
		const panelLines = cookAlong.locator('[data-test-class="cook-along-ingredient"]');

		await cookAlong.getByTestId('cook-along-ingredients-open').click();
		await expect(cookAlong.getByTestId('cook-along-ingredients')).toBeVisible();
		await expect(panelLines).toHaveText(['Oeufs']);

		await cookAlong.getByTestId('cook-along-ingredients-all').click();
		await expect(panelLines).toHaveCount(3);

		await page.keyboard.press('Escape');
		await expect(cookAlong.getByTestId('cook-along-ingredients')).toBeHidden();
		await expect(cookAlong).toBeVisible();
		await expect(cookAlong.getByTestId('cook-along-ingredients-open')).toBeFocused();

		await cookAlong.getByTestId('cook-along-next').click();
		await cookAlong.getByTestId('cook-along-ingredients-open').click();
		await expect(panelLines).toHaveText(['Beurre', 'Ciboulette']);
		await cookAlong.getByTestId('cook-along-ingredients-close').click();

		await cookAlong.getByTestId('cook-along-next').click();
		await cookAlong.getByTestId('cook-along-ingredients-open').click();
		await expect(cookAlong.getByTestId('cook-along-ingredients-fallback')).toBeVisible();
		await expect(panelLines).toHaveCount(3);
		await cookAlong.getByTestId('cook-along-ingredients-close').click();
		await cookAlong.getByTestId('cook-along-close').click();

		await card.locator('[data-test-class="recipe-edit"]').click();
		await page.getByTestId('recipe-next').click();
		await page.getByTestId('recipe-next').click();
		await expect(links.nth(0).getByRole('checkbox', { name: 'Oeufs' })).toBeChecked();
		await expect(links.nth(1).getByRole('checkbox', { name: 'Ciboulette' })).toBeChecked();
		await expect(links.nth(2).getByRole('checkbox', { name: 'Oeufs' })).not.toBeChecked();
	});
});
