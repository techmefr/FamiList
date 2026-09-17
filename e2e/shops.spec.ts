import { test, expect } from './fixtures';

const shopName = () => `Magasin e2e ${Date.now()}`;

test('créer un magasin et lui ajouter un rayon', async ({ signedInPage: page }) => {
	const name = shopName();

	await page.goto('/shops');
	await page.getByTestId('shop-name').fill(name);
	await page.getByTestId('shop-create').click();

	const card = page.locator('[data-test-class="shop-card"]').filter({ hasText: name });
	await expect(card).toBeVisible();

	// The aisle carries the time, like the shop above.
	//
	// Aisles belong to the household and nothing allows deleting one: this test therefore added one more on
	// every run, all named the same. On the second, `getByText` found two and Playwright refused to choose —
	// the test did not replay on an already used database.
	const aisle = `Surgelés e2e ${Date.now()}`;

	await page.getByTestId('aisle-name').fill(aisle);
	await page.getByTestId('aisle-create').click();

	// Aimed at inside the chip rather than in the whole page: it is the element this test has just created,
	// and not a text that could come from elsewhere.
	await expect(
		page.locator('[data-test-class="aisle-chip"]').filter({ hasText: aisle })
	).toBeVisible();
});
