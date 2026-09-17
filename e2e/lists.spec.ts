import { test, expect } from './fixtures';

/**
 * A unique name per run: the tests run against a database shared between local runs (`supabase db reset`
 * only happens explicitly), and two lists both named "Courses e2e" would make the by-text selectors
 * ambiguous.
 */
const nomListe = () => `Courses e2e ${Date.now()}`;

test('créer une liste, y ajouter un article, le cocher, puis tout supprimer', async ({
	signedInPage: page
}) => {
	const nom = nomListe();

	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(nom);
	await page.getByTestId('list-create').click();

	const carte = page.locator('[data-test-class="list-card"]').filter({ hasText: nom });
	await expect(carte).toBeVisible();

	await carte.getByRole('link').first().click();
	await expect(page).toHaveURL(/\/l\//);
	await expect(page.getByRole('heading', { name: nom })).toBeVisible();

	await page.getByTestId('empty-add-item').click();
	await page.getByTestId('add-name').fill('Pommes');
	await page.getByTestId('add-submit').click();

	const ligne = page.locator('[data-test-class="item-row"]').filter({ hasText: 'Pommes' });
	await expect(ligne).toBeVisible();

	await ligne.locator('[data-test-class="item-check"]').check();
	await expect(ligne.locator('[data-test-class="item-check"]')).toBeChecked();

	await ligne.locator('[data-test-class="item-remove"]').click();
	await expect(ligne).toHaveCount(0);
});

test('une liste sans article affiche un état vide illustré', async ({ signedInPage: page }) => {
	const nom = nomListe();

	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(nom);
	await page.getByTestId('list-create').click();

	await page
		.locator('[data-test-class="list-card"]')
		.filter({ hasText: nom })
		.getByRole('link')
		.first()
		.click();

	await expect(page.getByTestId('list-empty')).toBeVisible();
});
