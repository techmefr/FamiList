import { test, expect, FIXTURE_PASSWORD, SECOND_EMAIL, signIn, signOut } from './fixtures';

/**
 * The administration screen was covered by nothing. Yet it is the only place from which the door is opened
 * to a new account and from which a report is filed away: a silent regression would leave people outside
 * with nobody noticing.
 *
 * The journey chosen is the one that cleans up after itself — file a report, find it again, resolve it.
 * Approving or refusing an account is not played: the only two accounts in the test database are already
 * approved, and refusing one would leave the whole suite unable to sign in on the next pass.
 */
test('un signalement remonte à l’administration, et s’y résout', async ({ signedInPage: page }) => {
	const description = `Le bouton reste gris ${Date.now()}`;

	await page.goto('/report?kind=bug');
	await page.getByTestId('bug-description').fill(description);
	await page.getByTestId('bug-submit').click();
	await expect(page.getByTestId('bug-success')).toBeVisible();

	await page.goto('/admin');

	// The fixed account is the first created: it is the administrator, and the screen must open.
	await expect(page.getByTestId('admin-denied')).toHaveCount(0);
	await expect(page.getByTestId('admin-errors')).toHaveCount(0);

	const fiche = page.locator('[data-test-class="bug-report"]').filter({ hasText: description });
	await expect(fiche).toBeVisible({ timeout: 15_000 });

	await fiche.locator('[data-test-class="resolve-bug"]').click();

	// The button disappears along with the "open" state: it is the only visible sign that the resolution
	// really left for the database and did not stay in the screen.
	await expect(fiche.locator('[data-test-class="resolve-bug"]')).toHaveCount(0, {
		timeout: 15_000
	});

	await page.reload();
	await expect(
		page
			.locator('[data-test-class="bug-report"]')
			.filter({ hasText: description })
			.locator('[data-test-class="resolve-bug"]')
	).toHaveCount(0, { timeout: 15_000 });
});

/**
 * The other half of the screen: what it refuses. The second account is not an administrator, it must
 * neither see the tab nor get the list by typing the address by hand.
 */
test('un compte ordinaire ne voit ni l’onglet comptes ni son contenu', async ({
	signedInPage: page
}) => {
	await signOut(page);
	await signIn(page, SECOND_EMAIL, FIXTURE_PASSWORD);

	await expect(page.getByTestId('nav-/admin')).toHaveCount(0);

	await page.goto('/admin');
	await expect(page.getByTestId('admin-denied')).toBeVisible({ timeout: 15_000 });
	await expect(page.locator('[data-test-class="bug-report"]')).toHaveCount(0);
	await expect(page.locator('[data-test-class="admin-pending-account"]')).toHaveCount(0);
});
