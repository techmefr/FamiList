import {
	test,
	expect,
	FIXTURE_EMAIL,
	FIXTURE_PASSWORD,
	SECOND_EMAIL,
	signIn,
	signOut
} from './fixtures';

test('un code inconnu est refusé en toutes lettres, pas en jargon de base', async ({
	signedInPage: page
}) => {
	await page.goto('/household');
	await page.getByTestId('join-code').fill('ZZZZZZ');
	await page.getByTestId('join-submit').click();

	const refus = page.getByTestId('household-error');
	await expect(refus).toBeVisible();

	// Le message de la base — « code invalide ou expire », sans accents et jamais traduit —
	// n'arrive plus jusqu'à l'écran.
	await expect(refus).toContainText(/invalid or has expired/i);
	await expect(refus).not.toContainText('code invalide ou expire');

	// Ce refus-là n'a pas de sortie « saisir mon code » : il ne s'agit pas du deuxième facteur.
	await expect(page.getByTestId('household-second-factor')).toHaveCount(0);
});

/**
 * Le parcours qui faisait défaut : créer un code dans un foyer, le consommer depuis un autre
 * compte, se retrouver ensemble. Il échouait pour tout le monde — le foyer créé à l'inscription
 * reçoit un magasin par défaut dès la première ouverture, et sa présence suffisait à faire
 * refuser l'invitation, sans aucune sortie possible.
 *
 * Le test se nettoie derrière lui : le second compte quitte le foyer à la fin, sinon un second
 * passage sur la même base repartirait d'un état où les deux comptes sont déjà réunis.
 */
test('rejoindre un foyer avec un code, puis le quitter', async ({ signedInPage: page }) => {
	await page.goto('/household');
	await page.getByTestId('invite-create').click();

	const code = await page.getByTestId('invite-code').innerText();
	expect(code).toMatch(/^[A-Z2-9]{6}$/);

	await signOut(page);
	await signIn(page, SECOND_EMAIL, FIXTURE_PASSWORD);

	await page.goto('/household');
	await page.getByTestId('join-code').fill(code);
	await page.getByTestId('join-submit').click();

	// Deux personnes dans le foyer, et surtout pas de « quittez d abord votre foyer actuel ».
	await expect(page.getByTestId('household-error')).toHaveCount(0);
	await expect(page.locator('[data-test-class="household-member"]')).toHaveCount(2, {
		timeout: 15_000
	});

	await page.getByTestId('household-leave').click();
	await expect(page.locator('[data-test-class="household-member"]')).toHaveCount(1, {
		timeout: 15_000
	});

	// Le compte principal se retrouve seul, comme avant le test.
	await signOut(page);
	await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);
	await page.goto('/household');
	await expect(page.locator('[data-test-class="household-member"]')).toHaveCount(1, {
		timeout: 15_000
	});
});
