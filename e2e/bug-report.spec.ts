import { test, expect } from './fixtures';

/**
 * Le signalement demande une capture de ce qui ne va pas. Tant qu'il remplaçait l'écran par une
 * page, il demandait donc de photographier quelque chose qui n'était plus affiché. Ces tests
 * vérifient l'inverse : le panneau s'ouvre par-dessus, se réduit sans rien perdre, et l'écran
 * reste là derrière.
 */
test("le signalement s'ouvre par-dessus l'écran, sans le quitter", async ({
	signedInPage: page
}) => {
	await page.goto('/shops');
	const avant = page.url();

	await page.getByTestId('help').click();
	await page.getByTestId('help-menu-bug').click();

	await expect(page.getByTestId('report-panel')).toBeVisible();
	expect(page.url()).toBe(avant);

	// Ce qu'on veut montrer est toujours à l'écran : c'est toute la raison d'être du panneau.
	await expect(page.getByTestId('add-aisle')).toBeVisible();

	await page.getByTestId('bug-description').fill('Le bouton ajouter un rayon ne répond pas.');
	await page.getByTestId('bug-submit').click();

	await expect(page.getByTestId('bug-success')).toBeVisible();
});

test('réduire le panneau rend l’écran, et ne perd pas ce qui est écrit', async ({
	signedInPage: page
}) => {
	await page.goto('/shops');

	await page.getByTestId('help').click();
	await page.getByTestId('help-menu-bug').click();

	const texte = 'La liste se vide quand je coche le dernier article.';
	await page.getByTestId('bug-description').fill(texte);

	await page.getByTestId('report-minimize').click();

	// Réduit : le formulaire n'est plus affiché — c'est le moment où l'on prend sa capture — mais
	// le panneau reste là pour dire qu'un signalement est en cours.
	await expect(page.getByTestId('bug-description')).toBeHidden();
	await expect(page.getByTestId('report-minimized-hint')).toBeVisible();

	await page.getByTestId('report-restore').click();

	// Rouvrir revient exactement dans l'état laissé : c'est la propriété qui distingue « réduire »
	// de « fermer », et la seule qui rende le geste utilisable.
	await expect(page.getByTestId('bug-description')).toHaveValue(texte);
});

test('le brouillon survit à un changement d’écran', async ({ signedInPage: page }) => {
	await page.goto('/shops');

	await page.getByTestId('help').click();
	await page.getByTestId('help-menu-suggestion').click();

	const texte = 'Pouvoir trier les magasins par distance.';
	await page.getByTestId('bug-description').fill(texte);
	await page.getByTestId('report-minimize').click();

	// On va reproduire le problème ailleurs, puis on reprend : le panneau vit hors des pages.
	await page.getByTestId('nav-/cards').click();
	await expect(page.getByTestId('report-panel')).toBeVisible();

	await page.getByTestId('report-restore').click();
	await expect(page.getByTestId('bug-description')).toHaveValue(texte);

	// Fermer est le seul geste qui jette : sans ça le brouillon suivrait toute la session.
	await page.getByTestId('report-close').click();
	await expect(page.getByTestId('report-panel')).toBeHidden();
});

test('le formulaire refuse un envoi sans description', async ({ signedInPage: page }) => {
	await page.goto('/report?kind=bug');

	await expect(page.getByTestId('bug-description')).toHaveAttribute('required', '');
});
