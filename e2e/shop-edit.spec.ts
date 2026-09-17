import { test, expect } from './fixtures';

/**
 * A shop could be created and read, but nothing more: name, brand, address and three-letter code were
 * frozen at creation, and there was no way to delete one.
 *
 * The test does the full round and cleans up behind itself — it deletes what it created, which is also the
 * most direct way of proving that deletion works.
 */
test('créer, modifier puis supprimer un magasin', async ({ signedInPage: page }) => {
	const nom = `Magasin e2e ${Date.now()}`;
	const renomme = `${nom} renommé`;

	// A three-letter code chosen here rather than derived: automatic deduplication works on the local cache,
	// which is not filled in the first second, and two runs of the test would end up with the same one — which
	// the form then refuses, rightly.
	//
	// In base 36 rather than in hundreds: `Date.now() % 100` only gave a hundred values, and an interrupted
	// run leaves its shop behind. The codes were therefore taken again after a few failures, the form refused
	// the creation — silently — and the test waited for a card that would never come.
	const court = Date.now().toString(36).slice(-3).toUpperCase();

	await page.goto('/shops');
	await page.getByTestId('shop-name').fill(nom);
	await page.getByTestId('shop-short').fill(court);
	await page.getByTestId('shop-create').click();

	// A code already taken makes the form leave without creating anything and without saying anything other
	// than an alert that may be off screen. Without this line, that refusal disguises itself as "card not
	// found" fifteen seconds later, and you look for the defect in the wrong place.
	await expect(page.getByTestId('shop-short-error')).toHaveCount(0);

	const carte = page.locator('[data-test-class="shop-card"]').filter({ hasText: nom });
	await expect(carte).toBeVisible();

	// The creation goes to the server and comes back: clicking while the list is being rewritten would detach
	// the button being aimed at.
	await page.waitForLoadState('networkidle');

	// Editing: the form opens filled with what the shop already carries.
	await carte.locator('[data-test-class="shop-edit"]').click();
	const champNom = carte.getByTestId('shop-name');
	await expect(champNom).toHaveValue(nom);

	await champNom.fill(renomme);
	await carte.getByTestId('shop-address').fill('12 rue des Tests');
	await page.waitForLoadState('networkidle');
	await carte.locator('[data-test-class="shop-save"]').click();

	const modifiee = page.locator('[data-test-class="shop-card"]').filter({ hasText: renomme });
	await expect(modifiee).toBeVisible();
	await expect(modifiee).toContainText('12 rue des Tests');

	// The form closes once saved.
	await expect(modifiee.locator('[data-test-class="shop-save"]')).toHaveCount(0);

	// Deleting, with a confirmation: the learned route goes with the shop, we do not erase it with an absent-
	// minded click.
	await modifiee.locator('[data-test-class="shop-delete"]').click();
	await expect(modifiee.locator('[data-test-class="shop-delete-confirm"]')).toBeVisible();
	await modifiee.locator('[data-test-class="shop-delete-yes"]').click();

	await expect(
		page.locator('[data-test-class="shop-card"]').filter({ hasText: renomme })
	).toHaveCount(0, { timeout: 15_000 });

	// And the deletion holds after a reload: it really went to the server.
	await page.reload();
	await expect(
		page.locator('[data-test-class="shop-card"]').filter({ hasText: renomme })
	).toHaveCount(0, { timeout: 15_000 });
});
