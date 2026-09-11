import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * Un article n'était pas modifiable du tout après création — et la note, affichée sous son nom,
 * n'avait aucun écran pour l'écrire.
 *
 * La liste porte un nom daté, comme les autres tests de listes : elle reste derrière, sans jamais
 * rendre un sélecteur ambigu au passage suivant.
 */
async function nouvelleListe(page: Page, nom: string) {
	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(nom);
	await page.getByTestId('list-create').click();

	const carte = page.locator('[data-test-class="list-card"]').filter({ hasText: nom });
	await expect(carte).toBeVisible();
	await carte.getByRole('link').first().click();
	await expect(page).toHaveURL(/\/l\//);
}

test('modifier un article, au bouton comme à l appui long', async ({ signedInPage: page }) => {
	const nom = `Courses e2e ${Date.now()}`;
	await nouvelleListe(page, nom);

	await page.getByTestId('empty-add-item').click();
	await page.getByTestId('add-name').fill('Pommes');
	await page.getByTestId('add-submit').click();

	const ligne = page.locator('[data-test-class="item-row"]').filter({ hasText: 'Pommes' });
	await expect(ligne).toBeVisible();

	// Le bouton crayon : le chemin annoncé, celui du clavier et du lecteur d'écran.
	await ligne.locator('[data-test-class="item-edit"]').click();
	await expect(page.getByTestId('add-name')).toHaveValue('Pommes');

	await page.getByTestId('add-name').fill('Poires');
	await page.getByTestId('add-qty').fill('3');
	await page.getByTestId('add-note').fill('les bien mûres');
	await page.getByTestId('add-submit').click();

	const modifiee = page.locator('[data-test-class="item-row"]').filter({ hasText: 'Poires' });
	await expect(modifiee).toContainText('les bien mûres');
	await expect(modifiee).toContainText('3');

	// L'appui long, le geste du pouce : la même fiche, préremplie.
	const etiquette = modifiee.locator('label').first();
	const boite = await etiquette.boundingBox();
	await page.mouse.move(boite!.x + boite!.width / 2, boite!.y + boite!.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(700);
	await page.mouse.up();

	await expect(page.getByTestId('add-name')).toHaveValue('Poires');
	await expect(page.getByTestId('add-note')).toHaveValue('les bien mûres');

	// Le relâchement du doigt ne doit pas cocher l'article dont on vient d'ouvrir la fiche.
	await page.getByTestId('add-close').click();
	await expect(modifiee.locator('[data-test-class="item-check"]')).not.toBeChecked();

	await modifiee.locator('[data-test-class="item-remove"]').click();
	await expect(modifiee).toHaveCount(0);

});
