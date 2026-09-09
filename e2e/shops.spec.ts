import { test, expect } from './fixtures';

const nomMagasin = () => `Magasin e2e ${Date.now()}`;

test('créer un magasin et lui ajouter un rayon', async ({ signedInPage: page }) => {
	const nom = nomMagasin();

	await page.goto('/shops');
	await page.getByTestId('shop-name').fill(nom);
	await page.getByTestId('shop-create').click();

	const carte = page.locator('[data-test-class="shop-card"]').filter({ hasText: nom });
	await expect(carte).toBeVisible();

	await page.getByTestId('aisle-name').fill('Surgelés e2e');
	await page.getByTestId('aisle-create').click();

	await expect(page.getByText('Surgelés e2e')).toBeVisible();
});
