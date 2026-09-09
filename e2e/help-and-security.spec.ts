import { test, expect } from './fixtures';

test('le bouton d’aide ouvre un tour guidé propre à l’écran ouvert', async ({
	signedInPage: page
}) => {
	await page.goto('/shops');
	await page.getByTestId('help').click();
	await page.getByTestId('help-menu-tutorial').click();

	await expect(page.locator('.driver-popover')).toBeVisible();
	// Sur /shops, la cible est le formulaire de rayon : le tour d'ensemble ne doit pas s'y substituer.
	await expect(page.locator('.driver-active-element')).toHaveAttribute(
		'data-test-id',
		'add-aisle'
	);
});

test("l'écran Sécurité liste le mot de passe, la 2FA et les appareils connectés", async ({
	signedInPage: page
}) => {
	await page.goto('/profile/security');

	await expect(page.getByTestId('password-form')).toBeVisible();
	await expect(page.getByTestId('totp-enable')).toBeVisible();
	await expect(page.getByTestId('sessions')).toBeVisible();

	// La session courante, ouverte à l'instant par ce test, doit apparaître dans sa propre liste.
	await expect(page.locator('[data-test-class="session-device"]').first()).toBeVisible();
});

test('un mot de passe actuel erroné refuse le changement', async ({ signedInPage: page }) => {
	await page.goto('/profile/security');

	await page.getByTestId('password-current').fill('ce-nest-pas-le-bon-mot-de-passe');
	await page.getByTestId('password-next').fill('un-nouveau-mot-de-passe-assez-long');
	await page.getByTestId('password-submit').click();

	await expect(page.getByTestId('password-error')).toBeVisible();
});
