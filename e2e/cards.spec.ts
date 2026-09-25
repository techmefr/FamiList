import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { expectNoNewViolations } from './a11y';

const cardFace = (page: Page, name: string) =>
	page
		.locator('[data-test-class="card-open"]')
		.filter({ hasText: name })
		.locator('[data-test-class="loyalty-card"]');

async function saveCard(page: Page, name: string, code: string) {
	await page.getByTestId('card-add').click();
	await page.getByTestId('card-name').fill(name);
	await page.getByTestId('card-code').fill(code);
	await page.getByTestId('card-submit').click();
	await expect(cardFace(page, name)).toBeVisible();
}

test('enregistrer une carte de fidélité par saisie manuelle du code', async ({
	signedInPage: page
}) => {
	const name = `Carte e2e ${Date.now()}`;

	await page.goto('/cards');
	await page.getByTestId('card-add').click();
	await page.getByTestId('card-name').fill(name);
	await page.getByTestId('card-code').fill('1234567890128');
	await page.getByTestId('card-submit').click();

	await expect(cardFace(page, name)).toBeVisible();
});

test('le catalogue reconnait l enseigne tapee et propose sa couleur et son monogramme', async ({
	signedInPage: page
}) => {
	test.setTimeout(90_000);
	const name = `Leclerc Vienne e2e ${Date.now()}`;

	await page.goto('/cards');
	await page.getByTestId('card-add').click();
	await page.getByTestId('card-name').fill(name);

	await expect(page.getByTestId('card-brand-match')).toContainText('E.Leclerc');
	await expect(page.getByTestId('card-color-auto')).toBeChecked();
	const preview = page.getByTestId('card-preview');
	await expect(preview.locator('[data-test-class="brand-mark"]')).toHaveAttribute(
		'data-brand',
		'E.Leclerc'
	);
	await expect(preview.locator('[data-test-class="brand-mark"]')).toHaveText('EL');

	// Retried: a sync badge or a toast passing through mid-fade can be caught at half opacity.
	await expect(async () => {
		await page.waitForFunction(() =>
			document.getAnimations().every((animation) => animation.playState !== 'running')
		);
		await expectNoNewViolations(page, 'cartes-formulaire');
	}).toPass({ timeout: 60_000 });

	await page.getByTestId('card-code').fill('4006381333931');
	const saved = page.waitForResponse(
		(response) =>
			response.url().includes('/rest/v1/loyalty_cards') &&
			response.request().method() !== 'GET' &&
			response.ok(),
		{ timeout: 15_000 }
	);
	await page.getByTestId('card-submit').click();
	await saved;

	await page.reload();
	await expect(cardFace(page, name)).toHaveAttribute('data-tint', '#0066B3');

	await page.locator('[data-test-class="card-open"]').filter({ hasText: name }).click();
	await expect(
		page.getByTestId('card-fullscreen').locator('[data-test-class="brand-mark"]')
	).toHaveAttribute('data-brand', 'E.Leclerc');
});

test('la couleur choisie dans la palette est gardee et reproposee a la modification', async ({
	signedInPage: page
}) => {
	const name = `Couleur e2e ${Date.now()}`;

	await page.goto('/cards');
	await page.getByTestId('card-add').click();
	await page.getByTestId('card-name').fill(name);
	await page.getByTestId('card-code').fill('ABC123');
	await page.locator('label').filter({ has: page.getByTestId('card-color-teal') }).click();
	await expect(page.getByTestId('card-color-teal')).toBeChecked();
	await expect(page.getByTestId('card-preview').locator('[data-test-class="loyalty-card"]')).toHaveAttribute(
		'data-tint',
		'#0F766E'
	);
	await page.getByTestId('card-submit').click();

	await expect(cardFace(page, name)).toHaveAttribute('data-tint', '#0F766E');

	await page
		.locator('li')
		.filter({ has: cardFace(page, name) })
		.locator('[data-test-class="card-edit"]')
		.click();
	await expect(page.getByTestId('card-color-teal')).toBeChecked();
});

test('deux cartes par ligne en taille moyenne, une seule en taille confort', async ({
	signedInPage: page
}) => {
	const stamp = Date.now();
	const first = `Grille A e2e ${stamp}`;
	const second = `Grille B e2e ${stamp}`;

	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/cards');
	await saveCard(page, first, 'GRID1');
	await saveCard(page, second, 'GRID2');

	// The text size is set on the page only: saving it as a preference would sync it to the shared account.
	const useScale = (scale: string) =>
		page.evaluate((value) => {
			document.documentElement.dataset.scale = value;
			document.documentElement.dataset.font = 'atkinson';
		}, scale);
	const width = async (name: string) => (await cardFace(page, name).boundingBox())!.width;
	const wallet = async () => (await page.getByTestId('cards-wallet').boundingBox())!.width;

	await useScale('md');
	expect(await width(first)).toBeLessThan((await wallet()) / 2 + 1);
	expect(await width(second)).toBeLessThan((await wallet()) / 2 + 1);

	await useScale('comfort');
	expect(await width(first)).toBeGreaterThan((await wallet()) - 2);

	const right = async (testId: string) => {
		const box = (await page.getByTestId(testId).boundingBox())!;
		return box.x + box.width;
	};
	expect(await right('cards-wallet')).toBeLessThanOrEqual(390);
	const face = (await cardFace(page, first).boundingBox())!;
	expect(face.x + face.width).toBeLessThanOrEqual(390);
	await page.getByTestId('card-add').click();
	await expect(page.getByTestId('card-form')).toBeVisible();
	expect(await right('card-form')).toBeLessThanOrEqual(390);
	expect(await right('card-color-list')).toBeLessThanOrEqual(390);
});
