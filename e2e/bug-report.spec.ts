import { test, expect } from './fixtures';

test("signaler un problème depuis n'importe quel écran envoie la description", async ({
	signedInPage: page
}) => {
	await page.goto('/shops');
	await page.getByTestId('report-bug').click();

	await expect(page).toHaveURL(/\/report\?from=/);

	await page.getByTestId('bug-description').fill('Le bouton ajouter un rayon ne répond pas.');
	await page.getByTestId('bug-submit').click();

	await expect(page.getByTestId('bug-success')).toBeVisible();
});

test('le formulaire refuse un envoi sans description', async ({ signedInPage: page }) => {
	await page.goto('/report');

	await expect(page.getByTestId('bug-description')).toHaveAttribute('required', '');
});
