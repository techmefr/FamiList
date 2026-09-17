import { test, expect } from './fixtures';

/**
 * The AI key, and the only thing it governs: the appearance of the recipe suggestion.
 *
 * No call is made to a provider here. The key set is a fake one, and that is intended — what is checked
 * does not need the network: with no key the feature does not exist, with a key it appears, and before any
 * sending the screen shows exactly what would leave.
 *
 * The fixed account is shared by the whole suite: each test removes the key it set, otherwise it would
 * leave the suggestion visible for the others.
 */
test.describe('intelligence artificielle', () => {
	/**
	 * The fixed account is shared, and an interrupted run may leave a key behind. So we start again from an
	 * account with no key rather than assume it: without that, the first test would fail for the state left
	 * by the previous one and not for what it checks.
	 */
	test.beforeEach(async ({ signedInPage: page }) => {
		await page.goto('/profile/ai');
		await expect(page.getByTestId('ai-state')).toBeVisible();

		const retirer = page.getByTestId('ai-clear');
		if ((await retirer.count()) > 0) await retirer.click();

		await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'off');
	});

	test('sans clé, la suggestion de recette n existe pas', async ({ signedInPage: page }) => {
		await page.goto('/profile/ai');
		await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'off');

		await page.goto('/recipes');
		await expect(page.getByTestId('recipe-new')).toBeVisible();
		await expect(page.getByTestId('ai-suggest-block')).toHaveCount(0);
	});

	test('une clé posée fait apparaître la suggestion, la retirer la fait disparaître', async ({
		signedInPage: page
	}) => {
		await page.goto('/profile/ai');
		await expect(page.getByTestId('ai-form')).toBeVisible();

		await page.getByTestId('ai-key').fill('cle-de-test-sans-valeur');
		await page.getByTestId('ai-save').click();

		await expect(page.getByTestId('ai-saved')).toBeVisible();
		await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'on');

		// The key leaves the screen as soon as it is saved: it has no business in a field any more.
		await expect(page.getByTestId('ai-key')).toHaveValue('');

		await page.goto('/recipes');
		await expect(page.getByTestId('ai-suggest-open')).toBeVisible();

		// Unfolding sends nothing: it shows what would leave, and waits for a second gesture.
		await page.getByTestId('ai-suggest-open').click();
		await expect(page.getByTestId('ai-suggest-open')).toBeVisible();

		await page.goto('/profile/ai');
		await page.getByTestId('ai-clear').click();
		await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'off');

		await page.goto('/recipes');
		await expect(page.getByTestId('ai-suggest-block')).toHaveCount(0);
	});

	/**
	 * What is shown before sending is what leaves. The test ticks an item, then checks that its name is in
	 * the displayed text — and that a list name is not.
	 *
	 * The key is set first, and the navigation then goes through the application's links and not through
	 * `page.goto`: a full reload restarts `data.load()`, which empties the local cache before filling it from
	 * the server, and would take the ticked item with it if it has not been synced yet.
	 */
	test('avant l envoi, l écran montre le texte exact et rien de plus', async ({
		signedInPage: page
	}) => {
		const produit = `Courgettes ${Date.now()}`;
		const nomDeListe = `SecretDeListe ${Date.now()}`;

		await page.goto('/profile/ai');
		await page.getByTestId('ai-key').fill('cle-de-test-sans-valeur');
		await page.getByTestId('ai-save').click();
		await expect(page.getByTestId('ai-saved')).toBeVisible();

		await page.goto('/');
		await page.getByTestId('nav-create').click();
		await page.getByTestId('create-list').click();
		await page.getByTestId('list-name').fill(nomDeListe);
		await page.getByTestId('list-create').click();

		const carte = page.locator('[data-test-class="list-card"]').filter({ hasText: nomDeListe });
		await expect(carte).toBeVisible();
		await carte.getByRole('link').first().click();
		await expect(page).toHaveURL(/\/l\//);

		await page.getByTestId('empty-add-item').click();
		await page.getByTestId('add-name').fill(produit);
		await page.getByTestId('add-submit').click();

		const ligne = page.locator('[data-test-class="item-row"]').filter({ hasText: produit });
		await expect(ligne).toBeVisible();
		await ligne.locator('[data-test-class="item-check"]').check();

		await page.locator('a[href="/recipes"]').first().click();
		await expect(page).toHaveURL(/\/recipes$/);

		await page.getByTestId('ai-suggest-open').click();
		await expect(page.getByTestId('ai-products')).toContainText(produit);

		await page.getByTestId('ai-prompt-toggle').click();
		const consigne = page.getByTestId('ai-prompt');
		await expect(consigne).toContainText(produit);
		await expect(consigne).not.toContainText(nomDeListe);

		await page.goto('/profile/ai');
		await page.getByTestId('ai-clear').click();
		await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'off');
	});
});
