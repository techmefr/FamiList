import { test, expect } from './fixtures';

const nomListe = () => `Discussion ${Date.now()}`;

/**
 * The chat existed with no way to it: you only reached it by opening a list and finding its button. This
 * journey checks the entrance that was missing — the tab, the list index, and going through to the
 * conversation itself.
 */
test('rejoindre une discussion depuis la navigation', async ({ signedInPage: page }) => {
	const nom = nomListe();

	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(nom);
	await page.getByTestId('list-create').click();

	await page.getByTestId('nav-/chat').click();
	await expect(page).toHaveURL(/\/chat$/);

	const entree = page.locator('[data-test-class="chat-entry"]').filter({ hasText: nom });
	await expect(entree).toBeVisible();

	await entree.click();
	await expect(page).toHaveURL(/\/l\/[^/]+\/chat$/);
	await expect(page.getByTestId('chat-input')).toBeVisible();
});
