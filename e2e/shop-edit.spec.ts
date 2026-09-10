import { test, expect } from './fixtures';

/**
 * Un magasin se créait et se lisait, mais rien de plus : nom, enseigne, adresse et trigramme
 * étaient figés dès la création, et rien ne permettait d'en supprimer un.
 *
 * Le test fait le tour complet et se nettoie derrière lui — il supprime ce qu'il a créé, ce qui
 * est aussi la façon la plus directe de prouver que la suppression marche.
 */
test('créer, modifier puis supprimer un magasin', async ({ signedInPage: page }) => {
	const nom = `Magasin e2e ${Date.now()}`;
	const renomme = `${nom} renommé`;

	// Un trigramme choisi ici plutôt que déduit : la déduplication automatique travaille sur le
	// cache local, qui n'est pas encore rempli à la première seconde, et deux passages du test se
	// retrouveraient avec le même — ce que le formulaire refuse ensuite, à juste titre.
	//
	// En base 36 plutôt qu'en centaines : `Date.now() % 100` ne donnait que cent valeurs, et un
	// passage interrompu laisse son magasin derrière lui. Les trigrammes se reprenaient donc au
	// bout de quelques échecs, le formulaire refusait la création — en silence — et le test
	// attendait une carte qui n'arriverait jamais.
	const court = Date.now().toString(36).slice(-3).toUpperCase();

	await page.goto('/shops');
	await page.getByTestId('shop-name').fill(nom);
	await page.getByTestId('shop-short').fill(court);
	await page.getByTestId('shop-create').click();

	// Un trigramme déjà pris fait sortir le formulaire sans rien créer et sans rien dire d'autre
	// qu'une alerte qui peut être hors écran. Sans cette ligne, ce refus se déguise en « carte
	// introuvable » quinze secondes plus tard, et on cherche le défaut au mauvais endroit.
	await expect(page.getByTestId('shop-short-error')).toHaveCount(0);

	const carte = page.locator('[data-test-class="shop-card"]').filter({ hasText: nom });
	await expect(carte).toBeVisible();

	// La création part au serveur et revient : cliquer pendant que la liste se réécrit détacherait
	// le bouton visé.
	await page.waitForLoadState('networkidle');

	// Modifier : le formulaire s'ouvre rempli de ce que le magasin porte déjà.
	await carte.locator('[data-test-class="shop-edit"]').click();
	const champNom = carte.getByTestId('shop-name');
	await expect(champNom).toHaveValue(nom);

	await champNom.fill(renomme);
	await carte.getByTestId('shop-address').fill('12 rue des Tests');
	await page.waitForLoadState('networkidle');
	await carte.locator('[data-test-class="shop-save"]').click();

	const modifiee = page.locator('[data-test-class="shop-card"]').filter({ hasText: renomme });
	await expect(modifiee).toBeVisible();
	await expect(modifiee).toContainText('12 rue des Tests');

	// Le formulaire se referme une fois enregistré.
	await expect(modifiee.locator('[data-test-class="shop-save"]')).toHaveCount(0);

	// Supprimer, en confirmant : le parcours appris part avec le magasin, on ne l'efface pas d'un
	// clic distrait.
	await modifiee.locator('[data-test-class="shop-delete"]').click();
	await expect(modifiee.locator('[data-test-class="shop-delete-confirm"]')).toBeVisible();
	await modifiee.locator('[data-test-class="shop-delete-yes"]').click();

	await expect(
		page.locator('[data-test-class="shop-card"]').filter({ hasText: renomme })
	).toHaveCount(0, { timeout: 15_000 });

	// Et la suppression tient après un rechargement : elle est bien partie au serveur.
	await page.reload();
	await expect(
		page.locator('[data-test-class="shop-card"]').filter({ hasText: renomme })
	).toHaveCount(0, { timeout: 15_000 });
});
