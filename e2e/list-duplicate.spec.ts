import { test, expect } from './fixtures';

/**
 * The same standard list comes back every week: duplicating it saves typing it again. The test checks what
 * the user sees — a second card, numbered, next to the original which stays intact.
 *
 * The list carries a dated name, like the other list tests: it stays behind without ever making a selector
 * ambiguous on the next run.
 */
test('dupliquer une liste depuis sa carte', async ({ signedInPage: page }) => {
	const nom = `Courses e2e ${Date.now()}`;

	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(nom);
	await page.getByTestId('list-create').click();

	const carte = page.locator('[data-test-class="list-card"]').filter({ hasText: nom });
	await expect(carte).toBeVisible();

	await carte.locator('[data-test-class="list-duplicate"]').click();

	const copie = page.locator('[data-test-class="list-card"]').filter({ hasText: `${nom} (2)` });
	await expect(copie).toBeVisible();

	// The original stays: duplicating is not renaming.
	await expect(carte).toHaveCount(2);
});
