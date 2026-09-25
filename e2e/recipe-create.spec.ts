import { test, expect, signIn, FIXTURE_EMAIL, FIXTURE_PASSWORD } from './fixtures';
import { expectNoNewViolations, presetAppearance } from './a11y';
import type { Page } from '@playwright/test';

/**
 * "Create a recipe" (#311): each source reaches the same editable recipe form, and only that form saves.
 *
 * The network and the AI are mocked the way `e2e/ai-recipe-request.spec.ts` already does: the link import's
 * edge function and the default provider's endpoint (`api.anthropic.com/v1/messages`) are answered by the
 * test. The free-text AI source is covered by that spec, so it is not repeated here.
 */

/** A 1x1 red pixel JPEG, small enough to inline, standing in for a photographed recipe page. */
const FAKE_JPEG = Buffer.from(
	'/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
	'base64'
);

function suggested(name: string) {
	return {
		name,
		emoji: '🥗',
		servings: 2,
		ingredients: [{ name: 'Tomates', qty: '3', unit: 'piece' }],
		steps: ['Couper les tomates.', 'Laisser mariner.'],
		stepMinutes: [0, 15],
		tags: ['cold_starter', 'summer']
	};
}

async function mockAnthropic(page: Page, recipe: unknown) {
	await page.route('https://api.anthropic.com/v1/messages', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ content: [{ text: JSON.stringify(recipe) }] })
		});
	});
}

async function setFakeKey(page: Page) {
	await page.goto('/profile/ai');
	await expect(page.getByTestId('ai-state')).toBeVisible();

	const remove = page.getByTestId('ai-clear');
	if ((await remove.count()) > 0) await remove.click();
	await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'off');

	await page.getByTestId('ai-key').fill('cle-de-test-sans-valeur');
	await page.getByTestId('ai-save').click();
	await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'on');
}

async function clearKey(page: Page) {
	await page.goto('/profile/ai');
	await expect(page.getByTestId('ai-state')).toBeVisible();
	const remove = page.getByTestId('ai-clear');
	if ((await remove.count()) > 0) await remove.click();
	await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'off');
}

/** The form is filled but nothing is saved yet: the three stages are walked through, then the card shows. */
async function saveFromForm(page: Page, name: string, minutes?: { step: number; value: string }) {
	await expect(page).toHaveURL(/\/recipes$/);
	await expect(page.getByTestId('recipe-name')).toHaveValue(name);
	await expect(page.locator('[data-test-class="recipe-card"]').filter({ hasText: name })).toHaveCount(0);

	await page.getByTestId('recipe-next').click();
	await page.getByTestId('recipe-next').click();
	if (minutes) {
		await expect(page.locator('[data-test-class="recipe-step-minutes"]').nth(minutes.step)).toHaveValue(
			minutes.value
		);
	}
	await page.getByTestId('recipe-next').click();

	await expect(page.locator('[data-test-class="recipe-card"]').filter({ hasText: name })).toBeVisible();
}

test.describe('creer une recette', () => {
	test('le bouton central mene aux sources, et la saisie manuelle ouvre le formulaire vide', async ({
		signedInPage: page
	}) => {
		const name = `Saisie manuelle e2e ${Date.now()}`;

		await page.goto('/recipes');
		await page.getByTestId('nav-create').click();
		await page.getByTestId('create-recipe').click();
		await expect(page).toHaveURL(/\/recipes\/new$/);

		await page.getByTestId('recipe-source-manual').click();
		await expect(page.getByTestId('recipe-form')).toBeVisible();
		await expect(page.getByTestId('recipe-name')).toHaveValue('');
		await expect(page.getByTestId('recipe-import-review')).toHaveCount(0);

		await page.getByTestId('recipe-name').fill(name);
		await saveFromForm(page, name);
	});

	test('un lien importe la recette dans le formulaire, a relire avant d enregistrer', async ({
		signedInPage: page
	}) => {
		const name = `Import de lien e2e ${Date.now()}`;
		await page.route('**/functions/v1/import-recipe', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					name,
					ingredients: ['250 g de farine', '3 oeufs'],
					steps: ['Cuire 20 minutes.'],
					servings: '6',
					image: null,
					categories: ['Dessert']
				})
			});
		});

		await page.goto('/recipes/new');
		await page.getByTestId('recipe-source-link').click();
		await expect(page.getByTestId('recipe-source-title')).toBeFocused();

		await page.getByTestId('recipe-import-url').fill('https://exemple.fr/ma-recette');
		await page.getByTestId('recipe-import-submit').click();

		await expect(page.getByTestId('recipe-import-review')).toBeVisible();
		await expect(page.getByTestId('recipe-servings')).toHaveValue('6');
		await expect(page.getByTestId('recipe-tag-dessert')).toBeChecked();
		await saveFromForm(page, name, { step: 0, value: '20' });
	});

	/**
	 * The largest text size, the Atkinson font and a left hand on a phone, in Arabic: the tiles must still
	 * fit the width. The language is only this browser's own choice, never the shared account's.
	 */
	test('les tuiles tiennent en police confort, pour un gaucher et de droite a gauche', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 780 });
		await presetAppearance(page, { fontScaleId: 'comfort', fontId: 'atkinson', hand: 'left' });
		await page.addInitScript(() => localStorage.setItem('familist:locale', 'ar'));
		await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);

		await page.goto('/recipes/new');
		await expect(page.getByTestId('recipe-sources')).toBeVisible();
		await expect(page.locator('html')).toHaveAttribute('data-hand', 'left');
		await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

		const tiles = await page.locator('[data-test-id^="recipe-source-"]').all();
		expect(tiles).toHaveLength(6);
		for (const tile of tiles) {
			const box = await tile.boundingBox();
			expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
			expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
			expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(360);
			expect(await tile.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
		}

		await expectNoNewViolations(page, 'creer-une-recette-confort');
	});

	test('le retour du telephone ramene d une source aux tuiles', async ({ signedInPage: page }) => {
		await page.goto('/recipes/new');
		await page.getByTestId('recipe-source-link').click();
		await expect(page.getByTestId('recipe-import-url')).toBeVisible();

		await page.goBack();
		await expect(page).toHaveURL(/\/recipes\/new$/);
		await expect(page.getByTestId('recipe-sources')).toBeVisible();
	});
});

test.describe('creer une recette avec l IA', () => {
	test.beforeEach(async ({ signedInPage: page }) => {
		await setFakeKey(page);
	});

	test.afterEach(async ({ signedInPage: page }) => {
		await clearKey(page);
	});

	test('une photo lue par l IA arrive dans le formulaire', async ({ signedInPage: page }) => {
		const name = `Recette photo e2e ${Date.now()}`;
		await mockAnthropic(page, suggested(name));

		await page.goto('/recipes/new');
		await page.getByTestId('recipe-source-photo').click();
		await page.getByTestId('ai-photo-input').setInputFiles({
			name: 'recette.jpg',
			mimeType: 'image/jpeg',
			buffer: FAKE_JPEG
		});

		const proposal = page.getByTestId('ai-proposal');
		await expect(proposal).toBeVisible({ timeout: 15_000 });
		await expect(proposal).toContainText(name);
		await page.getByTestId('ai-proposal-accept').click();

		await expect(page.getByTestId('recipe-import-review')).toBeVisible();
		await expect(page.getByTestId('recipe-tag-cold_starter')).toBeChecked();
		await expect(page.getByTestId('recipe-tag-summer')).toBeChecked();
		await saveFromForm(page, name, { step: 1, value: '15' });
	});

	/**
	 * The navigation after ticking goes through the application and not through `page.goto`: a full reload
	 * restarts `data.load()`, which would take the ticked item with it if it has not been synced yet.
	 */
	test('une idee a partir des achats arrive dans le formulaire', async ({ signedInPage: page }) => {
		const name = `Idee achats e2e ${Date.now()}`;
		const product = `Tomates ${Date.now()}`;
		const listName = `Achats recette e2e ${Date.now()}`;
		await mockAnthropic(page, suggested(name));

		await page.goto('/');
		await page.getByTestId('nav-create').click();
		await page.getByTestId('create-list').click();
		await page.getByTestId('list-name').fill(listName);
		await page.getByTestId('list-create').click();

		const card = page.locator('[data-test-class="list-card"]').filter({ hasText: listName });
		await card.getByRole('link').first().click();
		await expect(page).toHaveURL(/\/l\//);

		await page.getByTestId('empty-add-item').click();
		await page.getByTestId('add-name').fill(product);
		await page.getByTestId('add-submit').click();

		const row = page.locator('[data-test-class="item-row"]').filter({ hasText: product });
		await expect(row).toBeVisible();
		await row.locator('[data-test-class="item-check"]').check();

		await page.getByTestId('nav-create').click();
		await page.getByTestId('create-recipe').click();
		await page.getByTestId('recipe-source-purchases').click();
		await expect(page.getByTestId('ai-products')).toContainText(product);

		await page.getByTestId('ai-suggest-send').click();
		await expect(page.getByTestId('ai-proposal')).toBeVisible({ timeout: 15_000 });
		await page.getByTestId('ai-proposal-accept').click();

		await expect(page.getByTestId('recipe-import-review')).toBeVisible();
		await saveFromForm(page, name);
	});
});
