import { test, expect } from './fixtures';

/**
 * La même liste type revient chaque semaine : la dupliquer évite de la retaper. Le test vérifie ce
 * que l'utilisateur voit — une deuxième carte, numérotée, à côté de l'originale qui reste intacte.
 *
 * La liste porte un nom daté, comme les autres tests de listes : elle reste derrière sans jamais
 * rendre un sélecteur ambigu au passage suivant.
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

	// L'originale reste : dupliquer n'est pas renommer.
	await expect(carte).toHaveCount(2);
});
