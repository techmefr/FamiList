import { test, expect } from './fixtures';

/**
 * Le nom et l'emoji d'une liste étaient figés à la création : ni l'un ni l'autre ne se corrigeait,
 * alors que ce sont justement les deux choses qu'on pose à la va-vite en créant la liste.
 *
 * La liste porte un nom daté, comme les autres tests de listes : elle reste derrière sans jamais
 * rendre un sélecteur ambigu au passage suivant.
 */
test('renommer une liste, au bouton comme à l appui long', async ({ signedInPage: page }) => {
	const nom = `Courses e2e ${Date.now()}`;
	const renomme = `${nom} corrigé`;

	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(nom);
	await page.getByTestId('list-create').click();

	const carte = page.locator('[data-test-class="list-card"]').filter({ hasText: nom });
	await expect(carte).toBeVisible();

	// Le crayon : le chemin du clavier et du lecteur d'écran.
	await carte.locator('[data-test-class="list-rename"]').click();
	await expect(page.getByTestId('list-name')).toHaveValue(nom);

	await page.getByTestId('list-name').fill(renomme);
	await page.getByTestId('list-create').click();

	const corrigee = page.locator('[data-test-class="list-card"]').filter({ hasText: renomme });
	await expect(corrigee).toBeVisible();

	// Le formulaire se referme, et il ne reste pas en mode renommage.
	await expect(page.getByTestId('list-rename-cancel')).toHaveCount(0);

	// L'appui long sur la carte : la même fiche, préremplie — et il ne suit pas le lien.
	const lien = corrigee.getByRole('link').first();
	const boite = await lien.boundingBox();
	await page.mouse.move(boite!.x + boite!.width / 2, boite!.y + boite!.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(700);
	await page.mouse.up();

	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByTestId('list-name')).toHaveValue(renomme);

	// Renoncer laisse la liste telle quelle.
	await page.getByTestId('list-rename-cancel').click();
	await expect(corrigee).toBeVisible();
});
