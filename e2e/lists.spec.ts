import { test, expect } from './fixtures';

/**
 * A unique name per run: the tests run against a database shared between local runs (`supabase db reset`
 * only happens explicitly), and two lists both named "Courses e2e" would make the by-text selectors
 * ambiguous.
 */
const listName = () => `Courses e2e ${Date.now()}`;

test('créer une liste, y ajouter un article, le cocher, puis tout supprimer', async ({
	signedInPage: page
}) => {
	const name = listName();

	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(name);
	await page.getByTestId('list-create').click();

	const card = page.locator('[data-test-class="list-card"]').filter({ hasText: name });
	await expect(card).toBeVisible();

	await card.getByRole('link').first().click();
	await expect(page).toHaveURL(/\/l\//);
	await expect(page.getByRole('heading', { name: name })).toBeVisible();

	await page.getByTestId('empty-add-item').click();
	await page.getByTestId('add-name').fill('Pommes');
	await page.getByTestId('add-submit').click();

	const row = page.locator('[data-test-class="item-row"]').filter({ hasText: 'Pommes' });
	await expect(row).toBeVisible();

	await row.locator('[data-test-class="item-check"]').check();
	await expect(row.locator('[data-test-class="item-check"]')).toBeChecked();

	await row.locator('[data-test-class="item-remove"]').click();
	await expect(row).toHaveCount(0);
});

test('une liste sans article affiche un état vide illustré', async ({ signedInPage: page }) => {
	const name = listName();

	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(name);
	await page.getByTestId('list-create').click();

	await page
		.locator('[data-test-class="list-card"]')
		.filter({ hasText: name })
		.getByRole('link')
		.first()
		.click();

	await expect(page.getByTestId('list-empty')).toBeVisible();
});
