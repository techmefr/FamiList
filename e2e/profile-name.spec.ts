import { test, expect } from './fixtures';

/**
 * Le nom se posait à l'inscription et n'en bougeait plus : une faute de frappe restait affichée à
 * tout le foyer. Les initiales, elles, venaient d'une colonne remplie par un trigger avec une
 * seule lettre — deux raisons de vérifier les deux ensemble.
 *
 * Le profil porte maintenant trois champs, et c'est le prénom et le nom qui font les initiales :
 * le nom affiché peut être un surnom. Le test le vérifie en posant justement un surnom d'un seul
 * mot, le cas où lire le nom affiché donnerait une seule lettre.
 *
 * Le test se nettoie derrière lui : il rend son nom d'origine au compte, sinon un second passage
 * repartirait d'un nom déjà changé.
 */
test('changer son nom, et voir les initiales suivre', async ({ signedInPage: page }) => {
	await page.goto('/profile');

	// Les champs ne sont ouverts qu'une fois le compte identifié : lire leur contenu avant
	// donnerait une chaîne vide, et la remise en état de fin de test écrirait un nom vide.
	const champ = page.getByTestId('name-input');
	await expect(champ).toBeEnabled({ timeout: 15_000 });
	const origine = await champ.inputValue();
	expect(origine).not.toBe('');

	const prenomOrigine = await page.getByTestId('first-name-input').inputValue();
	const nomOrigine = await page.getByTestId('last-name-input').inputValue();

	// Le nom visé est celui que le compte ne porte pas déjà : un passage précédent interrompu a pu
	// laisser le premier en place, et renommer vers le nom courant ne changerait rien.
	const premier = prenomOrigine === 'Amandine' ? 'Basile' : 'Amandine';
	const dernier = premier === 'Amandine' ? 'Ferrand' : 'Nguyen';
	const initiales = premier === 'Amandine' ? 'AF' : 'BN';

	// Un nom affiché déjà posé est un choix : la saisie du prénom ne l'écrase pas.
	await page.getByTestId('first-name-input').fill(premier);
	await expect(champ).toHaveValue(origine);

	// Vidé, il redevient un brouillon et suit « Prénom Nom » — c'est le cas courant, on ne fait
	// pas retaper trois fois la même chose.
	await champ.fill('');
	await page.getByTestId('last-name-input').fill(dernier);
	await expect(champ).toHaveValue(`${premier} ${dernier}`);

	// On y met enfin un surnom d'un seul mot : c'est le cas où lire le nom affiché ne donnerait
	// qu'une lettre, alors que le profil connaît un prénom et un nom.
	const surnom = premier === 'Amandine' ? 'Mamie' : 'Papi';
	await champ.fill(surnom);
	await page.getByTestId('first-name-input').fill(premier);
	await expect(champ).toHaveValue(surnom);

	await page.getByTestId('name-save').click();

	// Deux lettres, celles du prénom et du nom — pas l'unique lettre du surnom, ni celle stockée
	// en base.
	const pastille = page.locator('[data-test-class="avatar"]').first();
	await expect(pastille).toHaveText(initiales, { timeout: 15_000 });

	// Le témoin d'enregistrement dit que l'écriture est partie et revenue : recharger avant
	// couperait la requête en vol, et la page reviendrait à l'ancien nom.
	await expect(page.getByTestId('name-saved')).toBeVisible({ timeout: 15_000 });

	await page.reload();
	await expect(page.getByTestId('name-input')).toHaveValue(surnom, { timeout: 15_000 });
	await expect(page.getByTestId('first-name-input')).toHaveValue(premier);
	await expect(page.getByTestId('last-name-input')).toHaveValue(dernier);

	const retour = page.getByTestId('name-input');
	await expect(retour).toBeEnabled({ timeout: 15_000 });
	await page.getByTestId('first-name-input').fill(prenomOrigine);
	await page.getByTestId('last-name-input').fill(nomOrigine);
	await retour.fill(origine);
	await page.getByTestId('name-save').click();
	await expect(page.getByTestId('name-saved')).toBeVisible({ timeout: 15_000 });
	await expect(retour).toHaveValue(origine);
});
