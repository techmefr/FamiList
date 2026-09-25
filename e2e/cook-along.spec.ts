import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

const STEPS = ['Couper les légumes', 'Faire revenir dix minutes', 'Servir chaud'];

async function recipeWithSteps(page: import('@playwright/test').Page, name: string) {
	await page.goto('/recipes/new');
	await page.getByTestId('recipe-source-manual').click();
	await page.getByTestId('recipe-name').fill(name);
	await page.getByTestId('recipe-next').click();

	await page.locator('[data-test-class="ingredient-name"]').first().fill('Courgettes');
	await page.getByTestId('recipe-next').click();

	for (const [index, body] of STEPS.entries()) {
		if (index > 0) await page.getByTestId('recipe-add-step').click();
		await page.locator('[data-test-class="recipe-step"]').nth(index).fill(body);
	}
	await page.getByTestId('recipe-next').click();

	const card = page.locator('[data-test-class="recipe-card"]').filter({ hasText: name });
	await expect(card).toBeVisible();
	return card;
}

/** The stepper of cook-along (#307): position in words, a track to jump from, and the current step marked. */
test.describe('suivre la recette', () => {
	test('la piste montre la position et permet de sauter a une etape', async ({ signedInPage: page }) => {
		const card = await recipeWithSteps(page, `Poêlée e2e ${Date.now()}`);
		await card.locator('[data-test-class="recipe-card-header"]').click();
		await card.locator('[data-test-class="recipe-cook-along"]').click();

		const cookAlong = page.getByTestId('cook-along');
		const position = cookAlong.getByTestId('cook-along-position');
		const steps = cookAlong.locator('[data-test-class="cook-along-track-step"]');

		await expect(position).toHaveAttribute('aria-live', 'polite');
		await expect(steps).toHaveCount(STEPS.length);
		await expect(steps.nth(0)).toHaveAttribute('aria-current', 'step');

		await steps.nth(2).click();
		await expect(cookAlong.getByTestId('cook-along-step')).toHaveText(STEPS[2]);
		await expect(steps.nth(2)).toHaveAttribute('aria-current', 'step');
		await expect(steps.nth(0)).toHaveAttribute('data-state', 'done');
		await expect(steps.nth(0)).not.toHaveAttribute('aria-current', 'step');
		await expect(position).toContainText('3');

		await cookAlong.getByTestId('cook-along-previous').click();
		await expect(cookAlong.getByTestId('cook-along-step')).toHaveText(STEPS[1]);
		await expect(steps.nth(1)).toHaveAttribute('aria-current', 'step');

		const results = await new AxeBuilder({ page })
			.include('[data-test-id="cook-along"]')
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
			.analyze();
		expect(results.violations).toEqual([]);
	});

	test('de droite a gauche, la fleche de gauche avance', async ({ signedInPage: page }) => {
		const card = await recipeWithSteps(page, `Poêlée rtl e2e ${Date.now()}`);
		await card.locator('[data-test-class="recipe-card-header"]').click();
		await page.evaluate(() => (document.documentElement.dir = 'rtl'));
		await card.locator('[data-test-class="recipe-cook-along"]').click();

		const cookAlong = page.getByTestId('cook-along');
		await page.keyboard.press('ArrowLeft');
		await expect(cookAlong.getByTestId('cook-along-step')).toHaveText(STEPS[1]);

		await page.keyboard.press('ArrowRight');
		await expect(cookAlong.getByTestId('cook-along-step')).toHaveText(STEPS[0]);
	});
});
