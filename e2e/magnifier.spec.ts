import { test, expect } from './fixtures';

/**
 * Ce que ce fichier ne teste pas, et pourquoi.
 *
 * La loupe est un appareil photo : grossissement optique, torche, image figée, pincement à deux
 * doigts. Un navigateur sans tête n'a pas de caméra, et la fausse caméra de Chromium ne rend
 * qu'une mire animée, sans capacité de zoom ni de torche — un test qui la pilote vérifierait le
 * décor, pas l'outil. Le grossissement et le découpage dans la trame sont, eux, déjà couverts par
 * les tests unitaires de `$domain/magnifier`, où ils sont du calcul pur.
 *
 * Reste ce qu'un test de bout en bout peut seul dire : quand la caméra manque, l'écran l'annonce
 * au lieu de rester noir, et on peut en repartir. C'est le cas le plus fréquent chez l'utilisateur
 * — autorisation refusée — et le seul qu'un écran muet rendrait incompréhensible.
 */
test('sans autorisation de caméra, la loupe le dit au lieu de rester noire', async ({
	signedInPage: page
}) => {
	await page.goto('/magnifier');

	await expect(page.getByTestId('magnifier')).toBeVisible();
	await expect(page.getByTestId('magnifier-unavailable')).toBeVisible({ timeout: 15_000 });

	// Pas de flux, donc pas d'élément vidéo : l'afficher vide laisserait un rectangle noir sous le
	// message, et on ne saurait plus lequel des deux dit la vérité.
	await expect(page.getByTestId('magnifier-video')).toHaveCount(0);
	await expect(page.getByTestId('magnifier-hint')).toHaveCount(0);
});

/**
 * L'autre façon d'échouer : un navigateur qui n'expose pas du tout la caméra. Le message n'est
 * pas le même — on ne demande pas de revoir une autorisation qui n'existe pas — et le chemin est
 * distinct dans le code, donc il se vérifie à part.
 */
test('un navigateur sans caméra du tout aboutit au même écran lisible', async ({
	signedInPage: page
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
	});

	await page.goto('/magnifier');

	await expect(page.getByTestId('magnifier-unavailable')).toBeVisible({ timeout: 15_000 });
	await expect(page.getByTestId('magnifier-video')).toHaveCount(0);
});

/**
 * On doit pouvoir repartir de la loupe. Elle est posée en plein écran, au-dessus du contenu : si
 * elle recouvrait la barre de navigation, il n'y aurait plus aucune sortie.
 */
test('on quitte la loupe par la navigation', async ({ signedInPage: page }) => {
	await page.goto('/magnifier');
	await expect(page.getByTestId('magnifier')).toBeVisible();

	await page.getByTestId('nav-/cards').click();
	await expect(page).toHaveURL(/\/cards$/);
	await expect(page.getByTestId('magnifier')).toHaveCount(0);
});
