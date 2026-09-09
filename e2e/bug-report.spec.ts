import { test, expect } from './fixtures';

test("le menu d'aide propose de signaler un bug depuis n'importe quel écran", async ({
	signedInPage: page
}) => {
	await page.goto('/shops');
	await page.getByTestId('help').click();
	await page.getByTestId('help-menu-bug').click();

	await expect(page).toHaveURL(/\/report\?from=.*&kind=bug/);

	await page.getByTestId('bug-description').fill('Le bouton ajouter un rayon ne répond pas.');
	await page.getByTestId('bug-submit').click();

	await expect(page.getByTestId('bug-success')).toBeVisible();
});

test('le menu d’aide propose de proposer une amélioration', async ({ signedInPage: page }) => {
	await page.goto('/');
	await page.getByTestId('help').click();
	await page.getByTestId('help-menu-suggestion').click();

	await expect(page).toHaveURL(/\/report\?from=.*&kind=suggestion/);
	await expect(page.getByTestId('bug-form')).toBeVisible();
});

test('le formulaire refuse un envoi sans description', async ({ signedInPage: page }) => {
	await page.goto('/report?kind=bug');

	await expect(page.getByTestId('bug-description')).toHaveAttribute('required', '');
});
