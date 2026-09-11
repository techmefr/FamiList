import { test, expect } from './fixtures';

const nomListe = () => `Discussion ${Date.now()}`;

/**
 * Le chat existait sans y mener : on ne l'atteignait qu'en ouvrant une liste et en trouvant son
 * bouton. Ce parcours vérifie l'entrée qui manquait — l'onglet, l'index des listes, et l'aller
 * jusqu'à la conversation elle-même.
 */
test('rejoindre une discussion depuis la navigation', async ({ signedInPage: page }) => {
	const nom = nomListe();

	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(nom);
	await page.getByTestId('list-create').click();

	await page.getByTestId('nav-/chat').click();
	await expect(page).toHaveURL(/\/chat$/);

	const entree = page.locator('[data-test-class="chat-entry"]').filter({ hasText: nom });
	await expect(entree).toBeVisible();

	await entree.click();
	await expect(page).toHaveURL(/\/l\/[^/]+\/chat$/);
	await expect(page.getByTestId('chat-input')).toBeVisible();
});
