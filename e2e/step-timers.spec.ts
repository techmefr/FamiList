import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * Timers on recipe steps (#310): a duration typed in the form becomes a timer in cook-along, which
 * survives closing cook-along and rings over whatever screen is open. The clock is driven by the test.
 */
async function createRecipe(page: Page, name: string) {
	await page.goto('/recipes');
	await page.getByTestId('recipe-new').click();
	await page.getByTestId('recipe-name').fill(name);
	await page.getByTestId('recipe-next').click();
	await page.locator('[data-test-class="ingredient-name"]').first().fill('Pâtes');
	await page.getByTestId('recipe-next').click();

	const steps = page.locator('[data-test-class="recipe-step"]');
	await steps.first().fill('Faire bouillir l eau');
	await page.getByTestId('recipe-add-step').click();
	await steps.nth(1).fill('Cuire les pâtes');
	await page.locator('[data-test-class="recipe-step-minutes"]').nth(1).fill('2');
	await page.getByTestId('recipe-next').click();

	return page.locator('[data-test-class="recipe-card"]').filter({ hasText: name });
}

async function openCookAlong(card: ReturnType<Page['locator']>) {
	const start = card.locator('[data-test-class="recipe-cook-along"]');
	if (!(await start.isVisible())) await card.locator('[data-test-class="recipe-card-header"]').click();
	await start.click();
}

test.describe('minuteurs des étapes', () => {
	test('une durée devient un minuteur qui survit à la fermeture et sonne partout', async ({
		signedInPage: page
	}) => {
		await page.clock.install();
		await page.reload();
		await page.evaluate(() => localStorage.setItem('familist:locale', 'fr'));
		await page.reload();

		const card = await createRecipe(page, `Pâtes e2e ${Date.now()}`);
		await openCookAlong(card);

		const cookAlong = page.getByTestId('cook-along');
		await expect(cookAlong.getByTestId('cook-along-timer-start')).toHaveCount(0);

		await cookAlong.getByTestId('cook-along-next').click();
		await expect(cookAlong.getByTestId('cook-along-timer-start')).toContainText('02:00');
		await cookAlong.getByTestId('cook-along-timer-start').click();

		const timer = cookAlong.locator('[data-test-class="cook-along-timer"]');
		await expect(timer).toHaveCount(1);
		await expect(timer).toContainText('Étape 2');
		await expect(cookAlong.getByTestId('cook-along-timer-start')).toHaveCount(0);

		await page.clock.fastForward('00:30');
		await expect(timer.locator('[data-test-class="cook-along-timer-clock"]')).toHaveText('01:30');

		await timer.locator('[data-test-class="cook-along-timer-add"]').click();
		await expect(timer.locator('[data-test-class="cook-along-timer-clock"]')).toHaveText('02:30');

		await cookAlong.getByTestId('cook-along-timer-announce').click();
		await expect(cookAlong.getByTestId('cook-along-timer-notice')).toHaveText(
			'Il reste 2 minutes 30 secondes pour l’étape 2.'
		);

		await cookAlong.getByTestId('cook-along-close').click();
		await expect(cookAlong).toBeHidden();

		await page.clock.fastForward('02:31');
		const alarm = page.getByTestId('timer-alarm');
		await expect(alarm).toBeVisible();
		await expect(alarm).toContainText('Cuire les pâtes');
		await alarm.locator('[data-test-class="timer-alarm-stop"]').click();
		await expect(alarm).toBeHidden();

		await openCookAlong(card);
		await expect(page.getByTestId('cook-along').locator('[data-test-class="cook-along-timer"]')).toHaveCount(0);
	});

	test('la durée se relit dans le formulaire et un minuteur survit au rechargement', async ({
		signedInPage: page
	}) => {
		const name = `Relecture e2e ${Date.now()}`;
		const card = await createRecipe(page, name);

		await card.locator('[data-test-class="recipe-card-header"]').click();
		await card.locator('[data-test-class="recipe-edit"]').click();
		await page.getByTestId('recipe-next').click();
		await page.getByTestId('recipe-next').click();
		await expect(page.locator('[data-test-class="recipe-step-minutes"]').nth(1)).toHaveValue('2');
		await expect(page.locator('[data-test-class="recipe-step-minutes"]').first()).toHaveValue('');
		await page.getByTestId('recipe-next').click();

		await openCookAlong(card);
		const cookAlong = page.getByTestId('cook-along');
		await cookAlong.getByTestId('cook-along-next').click();
		await cookAlong.getByTestId('cook-along-timer-start').click();

		await page.reload();
		await openCookAlong(page.locator('[data-test-class="recipe-card"]').filter({ hasText: name }));
		const timer = page.getByTestId('cook-along').locator('[data-test-class="cook-along-timer"]');
		await expect(timer).toHaveCount(1);
		await timer.locator('[data-test-class="cook-along-timer-stop"]').click();
		await expect(timer).toHaveCount(0);
	});
});
