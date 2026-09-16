import { expectNoNewViolations, presetAppearance } from './a11y';
import { test, expect, signIn, FIXTURE_EMAIL, FIXTURE_PASSWORD } from './fixtures';

/**
 * Les écrans atteignables directement une fois connecté. Le reste (détail de liste, palette
 * d'émojis) demande un parcours et a son propre test.
 */
const ROUTES: Array<{ screen: string; path: string; ready: string }> = [
	{ screen: 'accueil', path: '/', ready: 'nav-create' },
	{ screen: 'magasins', path: '/shops', ready: 'nav-create' },
	{ screen: 'cartes', path: '/cards', ready: 'nav-create' },
	{ screen: 'recettes', path: '/recipes', ready: 'nav-create' },
	{ screen: 'prix', path: '/prices', ready: 'nav-create' },
	{ screen: 'foyer', path: '/household', ready: 'nav-create' },
	{ screen: 'discussion', path: '/chat', ready: 'nav-create' },
	{ screen: 'profil', path: '/profile', ready: 'sign-out' },
	{ screen: 'securite', path: '/profile/security', ready: 'nav-create' },
	{ screen: 'signalement', path: '/report', ready: 'nav-create' },
	// Le compte fixe est le premier créé, donc administrateur : l'écran s'ouvre pour de bon et
	// porte ses trois sections, dont celle des plantages.
	{ screen: 'administration', path: '/admin', ready: 'nav-create' }
];

test.describe('accessibilite', () => {
	// Sans ça, axe analyse parfois un écran au milieu de son animation d'entrée : un élément encore
	// transparent est ignoré, et le même écran remonte tantôt deux violations, tantôt aucune.
	test.use({ reducedMotion: 'reduce' });

	test('connexion', async ({ page }) => {
		await presetAppearance(page);
		await page.goto('/auth');
		await expect(page.getByTestId('auth-submit')).toBeVisible({ timeout: 15_000 });

		await expectNoNewViolations(page, 'connexion');
	});

	for (const { screen, path, ready } of ROUTES) {
		test(screen, async ({ signedInPage: page }) => {
			await page.goto(path);
			await expect(page.getByTestId(ready)).toBeVisible({ timeout: 15_000 });

			await expectNoNewViolations(page, screen);
		});
	}

	test('detail de liste et palette d emojis', async ({ signedInPage: page }) => {
		const nom = `A11y ${Date.now()}`;

		await page.goto('/');
		await page.getByTestId('nav-create').click();
		await page.getByTestId('create-list').click();
		await page.getByTestId('list-name').fill(nom);

		// La palette d'émojis porte les libellés traduits lus par les lecteurs d'écran : elle est
		// analysée ouverte, sur le formulaire de création, là où elle vit.
		await expectNoNewViolations(page, 'creation-de-liste');

		await page.getByTestId('list-create').click();
		await page
			.locator('[data-test-class="list-card"]')
			.filter({ hasText: nom })
			.getByRole('link')
			.first()
			.click();
		await expect(page).toHaveURL(/\/l\//);
		await expect(page.getByTestId('list-empty')).toBeVisible();

		await expectNoNewViolations(page, 'detail-de-liste');
	});

	/**
	 * Le formulaire de recette se saisit en trois temps, et chacun montre des champs que les deux
	 * autres cachent : analyser l'écran replié ne dirait rien des rangées d'ingrédients ni de la
	 * zone de texte des étapes. On les traverse donc tous les trois.
	 */
	test('formulaire de recette', async ({ signedInPage: page }) => {
		await page.goto('/recipes');
		await page.getByTestId('recipe-new').click();
		await expect(page.getByTestId('recipe-name')).toBeVisible();

		await page.getByTestId('recipe-name').fill(`A11y ${Date.now()}`);
		await page.getByTestId('recipe-next').click();
		await expect(page.getByTestId('recipe-ingredients')).toBeVisible();
		await page.getByTestId('recipe-add-ingredient').click();

		await page.getByTestId('recipe-next').click();
		await expect(page.getByTestId('recipe-steps')).toBeVisible();

		await expectNoNewViolations(page, 'creation-de-recette');
	});

	/**
	 * La proposition d'installation, bandeau puis explication.
	 *
	 * Deux choses sont simulées, faute de pouvoir les obtenir d'un navigateur piloté : le compteur
	 * d'ouvertures, posé avant le chargement, et `beforeinstallprompt`, que Chromium n'émet que sur
	 * une vraie origine installable. L'événement est rejoué à la main une fois la page ouverte —
	 * c'est exactement ce que le magasin écoute.
	 */
	test('proposition d installation', async ({ page }) => {
		await presetAppearance(page);
		await page.addInitScript(() => {
			localStorage.setItem(
				'familist:install',
				JSON.stringify({ openings: 5, refusedAt: null })
			);
		});

		await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);

		await page.evaluate(() => {
			const event = Object.assign(new Event('beforeinstallprompt'), {
				prompt: () => Promise.resolve(),
				userChoice: Promise.resolve({ outcome: 'dismissed' })
			});
			window.dispatchEvent(event);
		});

		await expect(page.getByTestId('install-banner')).toBeVisible();
		await expectNoNewViolations(page, 'installation');

		// L'explication est un dialogue modal : elle se ferme par Échap et rend le focus au bandeau,
		// ce qu'axe ne vérifie pas — d'où la fermeture au clavier, exercée ici.
		await page.getByTestId('install-more').click();
		await expect(page.getByTestId('install-details')).toBeVisible();
		await expectNoNewViolations(page, 'installation-explication');

		await page.keyboard.press('Escape');
		await expect(page.getByTestId('install-details')).toBeHidden();
		await expect(page.getByTestId('install-banner')).toBeVisible();
	});

	/**
	 * Thème sombre et plus grand cran de police : c'est là que partent les régressions de contraste,
	 * et un texte agrandi peut aussi faire se recouvrir deux éléments. Un seul écran chacun — le
	 * reste des pages partage les mêmes jetons de couleur.
	 */
	test('accueil en theme sombre', async ({ page }) => {
		await presetAppearance(page, { theme: 'dark' });
		await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);

		await expectNoNewViolations(page, 'accueil-sombre');
	});

	test('accueil en police confort', async ({ page }) => {
		await presetAppearance(page, { fontScaleId: 'comfort', fontId: 'atkinson' });
		await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);

		await expectNoNewViolations(page, 'accueil-confort');
	});
});
