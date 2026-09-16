import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * Les seuls tests joués sur un téléphone émulé, et le projet `mobile` de `playwright.config.ts` ne
 * joue qu'eux. Rejouer toute la suite deux fois doublerait la durée du travail d'intégration pour
 * revérifier des parcours qui ne dépendent pas de la taille de l'écran ; ce qui en dépend
 * vraiment — la barre du bas, le côté du pouce, le glissement au doigt — n'existe nulle part
 * ailleurs et tient ici.
 *
 * Ce qui reste hors de portée : les greffons natifs de Capacitor. Le lecteur de code-barres, le
 * retour haptique, la barre d'état et l'écran d'accueil sont du code natif Android et iOS ; un
 * navigateur émulé n'en exécute pas une ligne, et les piloter demanderait un émulateur de
 * système complet. L'émulation Playwright donne le gabarit, le tactile et l'agent utilisateur,
 * pas le téléphone.
 */

const MOBILE_BREAKPOINT = 768;

/**
 * Un glissement au doigt, en vrais évènements tactiles.
 *
 * `page.touchscreen` ne sait que taper, et des `PointerEvent` fabriqués en JavaScript ne passent
 * pas : la ligne capture le pointeur, ce qu'un identifiant inventé ne permet pas. On descend donc
 * au protocole du navigateur, qui produit la même séquence qu'un vrai doigt.
 */
async function glisser(page: Page, cible: Locator, distance: number) {
	const boite = await cible.boundingBox();
	if (!boite) throw new Error('La ligne à glisser n’est pas affichée.');

	const y = boite.y + boite.height / 2;
	const depart = boite.x + boite.width / 2;
	const session = await page.context().newCDPSession(page);

	await session.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [{ x: depart, y }]
	});

	// Par paliers, et non d'un bond : la ligne ne s'engage qu'après avoir reconnu une direction
	// horizontale, ce qu'un seul saut ne lui laisse pas le temps de faire.
	for (let pas = 1; pas <= 6; pas += 1) {
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [{ x: depart + (distance * pas) / 6, y }]
		});
	}

	await session.send('Input.dispatchTouchEvent', {
		type: 'touchEnd',
		touchPoints: []
	});

	await session.detach();
}

/**
 * La case elle-même n'est lue que par les lecteurs d'écran ; ce qu'on touche, c'est l'étiquette
 * qui l'enveloppe, comme dans l'application.
 */
async function choisirMain(page: Page, main: 'left' | 'right') {
	await page.locator(`label:has([data-test-id="hand-${main}"])`).click();
	await expect(page.getByTestId(`hand-${main}`)).toBeChecked();
	await expect(page.locator('html')).toHaveAttribute('data-hand', main);
}

test('sur téléphone, la navigation est une barre en bas et non une colonne', async ({
	signedInPage: page
}) => {
	await page.goto('/');

	const barre = page.getByRole('navigation');
	const boite = await barre.boundingBox();
	expect(boite).not.toBeNull();

	const hauteur = page.viewportSize()!.height;
	expect(hauteur).toBeLessThan(MOBILE_BREAKPOINT * 2);

	// Collée au bas de l'écran : c'est ce qui la distingue de la colonne latérale du grand écran.
	expect(boite!.y + boite!.height).toBeGreaterThan(hauteur - 2);
	expect(boite!.height).toBeLessThan(hauteur / 3);

	// La loupe n'a d'onglet que sur téléphone, le foyer et les magasins n'en ont que sur grand
	// écran : cinq cibles est le maximum tenable pour un pouce.
	await expect(page.getByTestId('nav-/magnifier')).toBeVisible();
	await expect(page.getByTestId('nav-/household')).toBeHidden();
	await expect(page.getByTestId('nav-/shops')).toBeHidden();

	// Ce que la barre ne porte plus, l'en-tête le porte : sans quoi le profil serait inatteignable.
	await expect(page.getByTestId('header-profile')).toBeVisible();
});

/**
 * Tout se joue sans quitter le profil. Le réglage est poussé sur le compte avec un délai, et une
 * navigation entre-temps ramène l'apparence encore enregistrée en base : on mesurerait alors le
 * bouton d'avant le geste. Le bouton étant présent sur toutes les pages, rester ici ne coûte rien.
 */
test('le bouton de création change de côté avec la main déclarée', async ({ signedInPage: page }) => {
	await page.goto('/profile');

	const milieu = page.viewportSize()!.width / 2;
	const bouton = page.getByTestId('nav-create');

	await choisirMain(page, 'right');
	const droitier = await bouton.boundingBox();
	expect(droitier!.x).toBeGreaterThan(milieu);

	await choisirMain(page, 'left');
	const gaucher = await bouton.boundingBox();
	expect(gaucher!.x + gaucher!.width).toBeLessThan(milieu);

	// Remise en état : le réglage est enregistré sur le compte fixe, partagé par toute la suite.
	await choisirMain(page, 'right');
});

test('la loupe rend sa place au bouton de création quand on la quitte', async ({
	signedInPage: page
}) => {
	await page.goto('/magnifier');

	// Sur téléphone seulement : le disque flotterait au milieu de l'étiquette qu'on essaie de lire.
	await expect(page.getByTestId('nav-create')).toBeHidden();

	await page.getByTestId('nav-/').click();
	await expect(page.getByTestId('nav-create')).toBeVisible();
});

test('glisser une ligne du doigt la coche, sans passer par son bouton', async ({
	signedInPage: page
}) => {
	const nom = `Tactile ${Date.now()}`;

	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(nom);
	await page.getByTestId('list-create').click();

	await page
		.locator('[data-test-class="list-card"]')
		.filter({ hasText: nom })
		.getByRole('link')
		.first()
		.click();

	await page.getByTestId('empty-add-item').click();
	await page.getByTestId('add-name').fill('Pain');
	await page.getByTestId('add-submit').click();

	const ligne = page.locator('[data-test-class="item-row"]').filter({ hasText: 'Pain' });
	await expect(ligne).toBeVisible();
	await expect(ligne.locator('[data-test-class="item-check"]')).not.toBeChecked();

	await glisser(page, ligne, 160);

	await expect(ligne.locator('[data-test-class="item-check"]')).toBeChecked({ timeout: 15_000 });
});
