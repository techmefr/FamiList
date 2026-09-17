import { test, expect } from './fixtures';

/**
 * The same standard list comes back every week: duplicating it saves typing it again. The test checks what
 * the user sees — a second card, numbered, next to the original which stays intact.
 *
 * The list carries a dated name, like the other list tests: it stays behind without ever making a selector
 * ambiguous on the next run.
 */
test('dupliquer une liste depuis sa carte', async ({ signedInPage: page }) => {
	const name = `Courses e2e ${Date.now()}`;

	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(name);
	await page.getByTestId('list-create').click();

	const card = page.locator('[data-test-class="list-card"]').filter({ hasText: name });
	await expect(card).toBeVisible();

	await card.locator('[data-test-class="list-duplicate"]').click();

	const copied = page.locator('[data-test-class="list-card"]').filter({ hasText: `${name} (2)` });
	await expect(copied).toBeVisible();

	// The original stays: duplicating is not renaming.
	await expect(card).toHaveCount(2);
});
