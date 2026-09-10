import { test, expect } from './fixtures';

const nomMagasin = () => `Magasin e2e ${Date.now()}`;

test('créer un magasin et lui ajouter un rayon', async ({ signedInPage: page }) => {
	const nom = nomMagasin();

	await page.goto('/shops');
	await page.getByTestId('shop-name').fill(nom);
	await page.getByTestId('shop-create').click();

	const carte = page.locator('[data-test-class="shop-card"]').filter({ hasText: nom });
	await expect(carte).toBeVisible();

	// Le rayon porte l'heure, comme le magasin au-dessus.
	//
	// Les rayons appartiennent au foyer et rien ne permet d'en supprimer un : ce test en ajoutait
	// donc un de plus à chaque passage, tous nommés pareil. Au deuxième, `getByText` en trouvait
	// deux et Playwright refusait de choisir — le test ne se rejouait pas sur une base déjà servie.
	const rayon = `Surgelés e2e ${Date.now()}`;

	await page.getByTestId('aisle-name').fill(rayon);
	await page.getByTestId('aisle-create').click();

	// Visé dans la puce plutôt que dans la page entière : c'est l'élément que ce test vient de
	// créer, et non un texte qui pourrait venir d'ailleurs.
	await expect(
		page.locator('[data-test-class="aisle-chip"]').filter({ hasText: rayon })
	).toBeVisible();
});
