import { test, expect } from './fixtures';

const nomMagasin = () => `Magasin e2e ${Date.now()}`;

test('créer un magasin et lui ajouter un rayon', async ({ signedInPage: page }) => {
	const nom = nomMagasin();

	await page.goto('/shops');
	await page.getByTestId('shop-name').fill(nom);
	await page.getByTestId('shop-create').click();

	const carte = page.locator('[data-test-class="shop-card"]').filter({ hasText: nom });
	await expect(carte).toBeVisible();

	// The aisle carries the time, like the shop above.
	//
	// Aisles belong to the household and nothing allows deleting one: this test therefore added one more on
	// every run, all named the same. On the second, `getByText` found two and Playwright refused to choose —
	// the test did not replay on an already used database.
	const rayon = `Surgelés e2e ${Date.now()}`;

	await page.getByTestId('aisle-name').fill(rayon);
	await page.getByTestId('aisle-create').click();

	// Aimed at inside the chip rather than in the whole page: it is the element this test has just created,
	// and not a text that could come from elsewhere.
	await expect(
		page.locator('[data-test-class="aisle-chip"]').filter({ hasText: rayon })
	).toBeVisible();
});
