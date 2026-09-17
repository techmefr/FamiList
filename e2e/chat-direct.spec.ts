import { test, expect, FIXTURE_EMAIL, FIXTURE_PASSWORD, SECOND_EMAIL, signIn, signOut } from './fixtures';

/**
 * Un message privé ne passe par aucun cercle — mais il faut bien s'être rencontré quelque part pour
 * s'écrire, et c'est le cercle qui sert d'annuaire. Le parcours passe donc par un foyer commun,
 * ouvre la conversation depuis l'un des deux comptes, et va relire le message depuis l'autre.
 *
 * Le foyer est quitté à la fin, comme dans le parcours d'invitation : les deux comptes de fixture
 * sont partagés par toute la suite et doivent être rendus tels qu'ils ont été empruntés.
 */
test('écrire en privé à quelqu’un d’un cercle commun', async ({ signedInPage: page }) => {
	await page.goto('/household');
	await page.getByTestId('invite-create').click();

	const code = (await page.getByTestId('invite-code').innerText()).trim();
	expect(code).toMatch(/^[A-Z2-9]{6}$/);

	await signOut(page);
	await signIn(page, SECOND_EMAIL, FIXTURE_PASSWORD);

	await page.goto('/household');
	await page.getByTestId('join-code').fill(code);
	await page.getByTestId('join-submit').click();
	await expect(page.locator('[data-test-class="household-member"]')).toHaveCount(2, {
		timeout: 15_000
	});

	const corps = `Entre nous ${Date.now()}`;

	await page.goto('/chat');
	await page.getByTestId('new-direct').click();
	await page.locator('[data-test-class="direct-candidate"]').first().click();
	await expect(page).toHaveURL(/\/chat\/d\//, { timeout: 15_000 });

	await page.getByTestId('direct-input').fill(corps);

	/**
	 * L'écran affiche le message avant que le serveur ne le connaisse : l'envoi passe par la file
	 * d'écritures, et c'est ce qui rend l'application utilisable sans réseau. Se déconnecter dans
	 * cet intervalle coupe la requête en vol — le message est bien parti côté écran, jamais côté
	 * base, et la relecture depuis l'autre compte ne trouve rien.
	 *
	 * La promesse est armée AVANT le clic : armée après, la réponse serait déjà passée. On attend
	 * donc le vrai aller-retour, avec sa propre limite de temps, plutôt qu'une temporisation fixe
	 * qui serait soit trop courte sur une machine lente, soit du temps perdu sur toutes les autres.
	 */
	const enregistre = page.waitForResponse(
		(reponse) =>
			reponse.url().includes('/rest/v1/messages') &&
			reponse.request().method() === 'POST' &&
			reponse.ok(),
		{ timeout: 15_000 }
	);

	await page.getByTestId('direct-send').click();
	await expect(page.locator('[data-test-class="direct-message"]')).toContainText(corps);
	await enregistre;

	// L'autre bout de la conversation : le message doit être là, et l'entrée doit porter son nom.
	await signOut(page);
	await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);

	await page.goto('/chat');
	const entree = page.locator('[data-test-class="direct-entry"]').filter({ hasText: corps });
	await expect(entree).toBeVisible({ timeout: 15_000 });

	await entree.click();
	await expect(page.locator('[data-test-class="direct-message"]')).toContainText(corps);

	// On rend les comptes tels qu'on les a trouvés : le second quitte le foyer commun.
	await signOut(page);
	await signIn(page, SECOND_EMAIL, FIXTURE_PASSWORD);
	await page.goto('/household');
	await page.getByTestId('household-leave').click();
	await expect(page.locator('[data-test-class="household-member"]')).toHaveCount(1, {
		timeout: 15_000
	});
});
