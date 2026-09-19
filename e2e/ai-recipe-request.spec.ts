import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * The free-text "+" AI recipe request (#211): asking a fixed, fake key like `e2e/ai.spec.ts` already does,
 * then intercepting the provider call itself — `DEFAULT_PROVIDER` is `anthropic`
 * (`src/lib/domain/ai.ts`), so the mocked endpoint is `api.anthropic.com/v1/messages`, answered in
 * Anthropic's own envelope (`content: [{ text }]`, read by `parseReply`).
 *
 * The suite is not allowed to leave the fixture account with a key behind it, same rule and same
 * `beforeEach`/cleanup as `e2e/ai.spec.ts`.
 */
const FAKE_RECIPE = {
	name: 'Curry de poulet e2e',
	emoji: '🍛',
	servings: 4,
	ingredients: [
		{ name: 'Poulet', qty: '500', unit: 'g' },
		{ name: 'Lait de coco', qty: '400', unit: 'ml' }
	],
	steps: ['Faire revenir le poulet.', 'Ajouter le lait de coco et laisser mijoter.']
};

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
	const remove = page.getByTestId('ai-clear');
	if ((await remove.count()) > 0) await remove.click();
	await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'off');
}

test.describe('demande de recette en texte libre', () => {
	test.beforeEach(async ({ signedInPage: page }) => {
		await setFakeKey(page);
	});

	test.afterEach(async ({ signedInPage: page }) => {
		await clearKey(page);
	});

	test('demander, obtenir une proposition et l accepter cree la recette', async ({
		signedInPage: page
	}) => {
		await mockAnthropic(page, FAKE_RECIPE);

		await page.goto('/recipes');
		await page.getByTestId('ai-request-open').click();
		await page.getByTestId('ai-request-input').fill('un curry de poulet pour 4');
		await page.getByTestId('ai-request-submit').click();

		const proposal = page.getByTestId('ai-proposal');
		await expect(proposal).toBeVisible({ timeout: 15_000 });
		await expect(proposal).toContainText(FAKE_RECIPE.name);
		await expect(page.getByTestId('ai-proposal-accept')).toBeVisible();
		await expect(page.getByTestId('ai-proposal-retry')).toBeVisible();
		await expect(page.getByTestId('ai-proposal-discard')).toBeVisible();

		await page.getByTestId('ai-proposal-accept').click();
		await expect(page.getByTestId('ai-request-added')).toBeVisible();

		const card = page.locator('[data-test-class="recipe-card"]').filter({ hasText: FAKE_RECIPE.name });
		await expect(card).toBeVisible();
	});

	test('discard efface la proposition sans creer de recette', async ({ signedInPage: page }) => {
		await mockAnthropic(page, FAKE_RECIPE);

		await page.goto('/recipes');
		await page.getByTestId('ai-request-open').click();
		await page.getByTestId('ai-request-input').fill('un dessert rapide');
		await page.getByTestId('ai-request-submit').click();

		await expect(page.getByTestId('ai-proposal')).toBeVisible({ timeout: 15_000 });
		await page.getByTestId('ai-proposal-discard').click();
		await expect(page.getByTestId('ai-proposal')).toHaveCount(0);

		const card = page.locator('[data-test-class="recipe-card"]').filter({ hasText: FAKE_RECIPE.name });
		await expect(card).toHaveCount(0);
	});

	/**
	 * Only the entry point, on the list chat screen: the full ask/accept round trip is already covered above,
	 * and repeating it per screen would only recheck the same `AiRecipeRequest.svelte` component.
	 */
	test('le declencheur apparait aussi depuis la discussion d une liste', async ({
		signedInPage: page
	}) => {
		const listName = `Discussion recette e2e ${Date.now()}`;

		await page.goto('/');
		await page.getByTestId('nav-create').click();
		await page.getByTestId('create-list').click();
		await page.getByTestId('list-name').fill(listName);
		await page.getByTestId('list-create').click();

		const card = page.locator('[data-test-class="list-card"]').filter({ hasText: listName });
		await card.getByRole('link').first().click();
		await expect(page).toHaveURL(/\/l\//);

		await page.getByTestId('open-chat').click();
		await expect(page).toHaveURL(/\/l\/[^/]+\/chat$/);

		await expect(page.getByTestId('ai-request-open')).toBeVisible();
	});
});
