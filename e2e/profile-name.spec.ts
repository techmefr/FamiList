import { test, expect } from './fixtures';

/**
 * Le nom se posait à l'inscription et n'en bougeait plus : une faute de frappe restait affichée à
 * tout le foyer. Les initiales, elles, venaient d'une colonne remplie par un trigger avec une
 * seule lettre — deux raisons de vérifier les deux ensemble.
 *
 * Le test se nettoie derrière lui : il rend son nom d'origine au compte, sinon un second passage
 * repartirait d'un nom déjà changé.
 */
test('changer son nom, et voir les initiales suivre', async ({ signedInPage: page }) => {
	await page.goto('/profile');

	// Le champ n'est ouvert qu'une fois le compte identifié : lire son contenu avant donnerait une
	// chaîne vide, et la remise en état de fin de test écrirait un nom vide.
	const champ = page.getByTestId('name-input');
	await expect(champ).toBeEnabled({ timeout: 15_000 });
	const origine = await champ.inputValue();
	expect(origine).not.toBe('');

	// Le nom visé est celui que le compte ne porte pas déjà : un passage précédent interrompu a pu
	// laisser le premier en place, et renommer vers le nom courant ne changerait rien.
	const vise = origine === 'Amandine Ferrand' ? 'Basile Nguyen' : 'Amandine Ferrand';
	const initiales = vise === 'Amandine Ferrand' ? 'AF' : 'BN';

	await champ.fill(vise);
	await page.getByTestId('name-save').click();

	// Deux lettres, celles du nom qu'on vient de taper — pas la seule lettre stockée en base.
	const pastille = page.locator('[data-test-class="avatar"]').first();
	await expect(pastille).toHaveText(initiales, { timeout: 15_000 });

	// Le témoin d'enregistrement dit que l'écriture est partie et revenue : recharger avant
	// couperait la requête en vol, et la page reviendrait à l'ancien nom.
	await expect(page.getByTestId('name-saved')).toBeVisible({ timeout: 15_000 });

	await page.reload();
	await expect(page.getByTestId('name-input')).toHaveValue(vise, { timeout: 15_000 });

	const retour = page.getByTestId('name-input');
	await expect(retour).toBeEnabled({ timeout: 15_000 });
	await retour.fill(origine);
	await page.getByTestId('name-save').click();
	await expect(page.getByTestId('name-saved')).toBeVisible({ timeout: 15_000 });
	await expect(retour).toHaveValue(origine);
});
