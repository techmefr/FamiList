import { test, expect } from './fixtures';

test('enregistrer une carte de fidélité par saisie manuelle du code', async ({
	signedInPage: page
}) => {
	const nom = `Carte e2e ${Date.now()}`;

	await page.goto('/cards');
	await page.getByTestId('card-add').click();
	await page.getByTestId('card-name').fill(nom);
	await page.getByTestId('card-code').fill('1234567890128');
	await page.getByTestId('card-submit').click();

	await expect(page.getByText(nom)).toBeVisible();
});
