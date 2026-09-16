import { test, expect, FIXTURE_PASSWORD, SECOND_EMAIL, signIn, signOut } from './fixtures';

/**
 * L'écran d'administration n'était couvert par rien. C'est pourtant le seul endroit d'où l'on
 * ouvre la porte à un nouveau compte et d'où l'on classe un signalement : une régression
 * silencieuse y laisserait des gens dehors sans que personne s'en aperçoive.
 *
 * Le parcours choisi est celui qui se nettoie tout seul — déposer un signalement, le retrouver,
 * le résoudre. Approuver ou refuser un compte n'est pas joué : les deux seuls comptes de la base
 * de test sont déjà approuvés, et en refuser un rendrait toute la suite incapable de se
 * connecter au passage suivant.
 */
test('un signalement remonte à l’administration, et s’y résout', async ({ signedInPage: page }) => {
	const description = `Le bouton reste gris ${Date.now()}`;

	await page.goto('/report?kind=bug');
	await page.getByTestId('bug-description').fill(description);
	await page.getByTestId('bug-submit').click();
	await expect(page.getByTestId('bug-success')).toBeVisible();

	await page.goto('/admin');

	// Le compte fixe est le premier créé : c'est lui l'administrateur, et l'écran doit s'ouvrir.
	await expect(page.getByTestId('admin-denied')).toHaveCount(0);
	await expect(page.getByTestId('admin-errors')).toHaveCount(0);

	const fiche = page.locator('[data-test-class="bug-report"]').filter({ hasText: description });
	await expect(fiche).toBeVisible({ timeout: 15_000 });

	await fiche.locator('[data-test-class="resolve-bug"]').click();

	// Le bouton disparaît avec l'état « ouvert » : c'est la seule marque visible que la résolution
	// est bien partie en base et non restée dans l'écran.
	await expect(fiche.locator('[data-test-class="resolve-bug"]')).toHaveCount(0, {
		timeout: 15_000
	});

	await page.reload();
	await expect(
		page
			.locator('[data-test-class="bug-report"]')
			.filter({ hasText: description })
			.locator('[data-test-class="resolve-bug"]')
	).toHaveCount(0, { timeout: 15_000 });
});

/**
 * L'autre moitié de l'écran : ce qu'il refuse. Le second compte n'est pas administrateur, il ne
 * doit ni voir l'onglet ni obtenir la liste en tapant l'adresse à la main.
 */
test('un compte ordinaire ne voit ni l’onglet comptes ni son contenu', async ({
	signedInPage: page
}) => {
	await signOut(page);
	await signIn(page, SECOND_EMAIL, FIXTURE_PASSWORD);

	await expect(page.getByTestId('nav-/admin')).toHaveCount(0);

	await page.goto('/admin');
	await expect(page.getByTestId('admin-denied')).toBeVisible({ timeout: 15_000 });
	await expect(page.locator('[data-test-class="bug-report"]')).toHaveCount(0);
	await expect(page.locator('[data-test-class="admin-pending-account"]')).toHaveCount(0);
});
