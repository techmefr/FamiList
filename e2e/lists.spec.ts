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

/**
 * The local cache shows a list the instant it is created, before the server has said anything. So every
 * assertion above passes on a write the database refused — which is exactly how a creation silently lost
 * to an RLS policy went unnoticed. Emptying the cache and reloading is what separates the two: what comes
 * back is what the server really holds.
 */
test('une liste créée survit à un cache local vidé', async ({ signedInPage: page }) => {
	const name = listName();

	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(name);
	await page.getByTestId('list-create').click();

	const card = page.locator('[data-test-class="list-card"]').filter({ hasText: name });
	await expect(card).toBeVisible();

	// Laisse la file partir : la carte est déjà là quand l'écriture n'a pas encore quitté le navigateur.
	await expect(page.getByTestId('sync-error')).toHaveCount(0);
	await page.waitForTimeout(2000);

	await page.evaluate(async () => {
		const names = await indexedDB.databases();
		await Promise.all(
			names.map(
				(entry) =>
					new Promise((resolve) => {
						const request = indexedDB.deleteDatabase(entry.name as string);
						request.onsuccess = resolve;
						request.onerror = resolve;
						request.onblocked = resolve;
					})
			)
		);
	});

	await page.reload();

	await expect(page.locator('[data-test-class="list-card"]').filter({ hasText: name })).toBeVisible({
		timeout: 20_000
	});
});
