import { test, expect } from './fixtures';

const DOCUMENTS = ['notice', 'terms', 'privacy', 'sales'];

test.describe('legal pages', () => {
	for (const doc of DOCUMENTS) {
		test(`${doc} opens without an account`, async ({ page }) => {
			await page.goto(`/legal/${doc}`);

			await expect(page).toHaveURL(new RegExp(`/legal/${doc}$`));
			await expect(page.getByTestId(`legal-${doc}`)).toBeVisible();
			await expect(page.getByTestId('legal-title')).not.toBeEmpty();
		});
	}
});
