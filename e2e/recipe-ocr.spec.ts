import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * "Scan a recipe" (#312). The text engine is replaced by a fake `TextDetector` (the Shape Detection API the
 * app falls back on), so what is checked is FamiList's side: pages, order, progress, structuring, and the
 * hand-over to the recipe form. Each page returns the next canned text; `__ocrRelease` lets a reading end.
 */
const FAKE_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

async function fakeDetector(page: Page, pages: string[][], held = false) {
	await page.addInitScript(
		({ pages, held }) => {
			const queue = [...pages];
			let release: () => void = () => {};
			const gate = held ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve();
			(window as unknown as { __ocrRelease: () => void }).__ocrRelease = () => release();

			class FakeTextDetector {
				async detect() {
					await gate;
					const lines = queue.shift() ?? [];
					return lines.map((rawValue, index) => ({
						rawValue,
						boundingBox: { x: 0, y: index * 30, width: 200, height: 20 }
					}));
				}
			}
			(window as unknown as Record<string, unknown>).TextDetector = FakeTextDetector;
		},
		{ pages, held }
	);
}

const photo = (name: string) => ({ name, mimeType: 'image/png', buffer: FAKE_PNG });

test.describe('scanner une recette', () => {
	test('deux pages remises dans l ordre deviennent une recette a relire', async ({ signedInPage: page }) => {
		const name = `Tarte scannee e2e ${Date.now()}`;
		await fakeDetector(page, [
			[name, 'Pour 6 personnes', 'Ingrédients', '200 g de farine', '3 œufs'],
			['Préparation', '1. Mélanger la farine et les œufs.', '2. Cuire 25 minutes.']
		]);

		await page.goto('/recipes/new');
		await page.getByTestId('recipe-source-scan').click();
		await page.getByTestId('recipe-scan-gallery-input').setInputFiles([photo('b.png'), photo('a.png')]);

		const pages = page.locator('[data-test-class="recipe-scan-page"]');
		await expect(pages).toHaveCount(2);
		await pages.nth(1).locator('[data-test-class="recipe-scan-page-up"]').click();
		await pages.nth(1).locator('[data-test-class="recipe-scan-page-remove"]').click();
		await expect(pages).toHaveCount(1);
		await page.getByTestId('recipe-scan-gallery-input').setInputFiles([photo('c.png')]);
		await expect(pages).toHaveCount(2);

		await page.getByTestId('recipe-scan-read').click();
		await expect(page.getByTestId('recipe-scan-ready')).toBeVisible({ timeout: 15_000 });
		await page.getByTestId('recipe-scan-open').click();

		await expect(page).toHaveURL(/\/recipes$/);
		await expect(page.getByTestId('recipe-name')).toHaveValue(name);
		await expect(page.getByTestId('recipe-servings')).toHaveValue('6');
		await expect(page.getByTestId('recipe-import-review')).toBeVisible();
	});

	test('la lecture continue ailleurs, et le message ouvre la recette', async ({ signedInPage: page }) => {
		const name = `Soupe scannee e2e ${Date.now()}`;
		await fakeDetector(page, [[name, 'Ingrédients', '1 potiron', 'Préparation', 'Cuire 30 min.']], true);

		await page.goto('/recipes/new');
		await page.getByTestId('recipe-source-scan').click();
		await page.getByTestId('recipe-scan-gallery-input').setInputFiles([photo('p.png')]);
		await page.getByTestId('recipe-scan-read').click();

		await expect(page.locator('[data-test-class="toast"][data-tone="progress"]')).toBeVisible();
		await page.getByTestId('nav-/shops').click();
		await page.evaluate(() => (window as unknown as { __ocrRelease: () => void }).__ocrRelease());

		const action = page.locator('[data-test-class="toast-action"]');
		await expect(action).toBeVisible({ timeout: 15_000 });
		await action.click();

		await expect(page).toHaveURL(/\/recipes$/);
		await expect(page.getByTestId('recipe-name')).toHaveValue(name);
	});

	test('dit clairement quand rien n est lisible', async ({ signedInPage: page }) => {
		await fakeDetector(page, [[]]);

		await page.goto('/recipes/new');
		await page.getByTestId('recipe-source-scan').click();
		await page.getByTestId('recipe-scan-gallery-input').setInputFiles([photo('vide.png')]);
		await page.getByTestId('recipe-scan-read').click();

		await expect(page.getByTestId('recipe-scan-error')).toHaveAttribute('data-test-state', 'empty');
	});
});
