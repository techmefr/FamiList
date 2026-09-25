import { test, expect, FIXTURE_EMAIL } from './fixtures';

test.describe('privacy request form', () => {
	test('an anonymous visitor sends a request', async ({ page }) => {
		await page.goto('/legal/privacy-request');

		await expect(page).toHaveURL(/\/legal\/privacy-request$/);
		await expect(page.getByTestId('privacy-request-deadline')).toBeVisible();

		await page.getByTestId('privacy-request-email').fill(`visitor-${Date.now()}@familist.test`);
		await page.getByTestId('privacy-request-kind').selectOption('erasure');
		await page.getByTestId('privacy-request-message').fill('Please erase the data linked to this address.');
		await page.getByTestId('privacy-request-submit').click();

		await expect(page.getByTestId('privacy-request-error')).toBeVisible();

		await page.getByTestId('privacy-request-confirm').check();
		await page.getByTestId('privacy-request-submit').click();

		await expect(page.getByTestId('privacy-request-success')).toBeVisible();
	});

	test('a signed-in person finds their email filled in and sends a request', async ({
		signedInPage: page
	}) => {
		await page.goto('/profile');
		await page.getByTestId('profile-category-legal').click();
		await page.getByTestId('go-privacy-request').click();

		await expect(page).toHaveURL(/\/legal\/privacy-request$/);
		await expect(page.getByTestId('privacy-request-email')).toHaveValue(FIXTURE_EMAIL);

		await page.getByTestId('privacy-request-kind').selectOption('access');
		await page.getByTestId('privacy-request-message').fill('Please send me a copy of my data.');
		await page.getByTestId('privacy-request-confirm').check();
		await page.getByTestId('privacy-request-submit').click();

		await expect(page.getByTestId('privacy-request-success')).toBeVisible();
	});

	test('the privacy policy links to the form', async ({ page }) => {
		await page.goto('/legal/privacy');
		await page.getByTestId('legal-section-link').click();

		await expect(page).toHaveURL(/\/legal\/privacy-request$/);
	});
});
