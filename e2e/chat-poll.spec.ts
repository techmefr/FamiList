import { test, expect } from './fixtures';

const nomListe = () => `Repas ${Date.now()}`;

async function creerListe(page: import('@playwright/test').Page, nom: string) {
	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(nom);
	await page.getByTestId('list-create').click();

	await page.getByTestId('nav-/chat').click();
	await page.locator('[data-test-class="chat-entry"]').filter({ hasText: nom }).click();
	await expect(page.getByTestId('chat-input')).toBeVisible();
}

/**
 * On savait arriver sur la conversation ; on ne savait pas qu'on pouvait y parler. Ce test suit
 * le message de bout en bout : écrit, envoyé, affiché, et toujours là après un rechargement —
 * c'est le rechargement qui distingue un message parti en base d'un message resté à l'écran.
 */
test('écrire un message dans la conversation d’une liste', async ({ signedInPage: page }) => {
	const nom = nomListe();
	await creerListe(page, nom);

	const texte = `On se retrouve samedi ${Date.now()}`;
	await page.getByTestId('chat-input').fill(texte);
	await page.getByTestId('chat-send').click();

	await expect(page.locator('[data-test-class="chat-message"]').filter({ hasText: texte })).toBeVisible({
		timeout: 15_000
	});

	// Vide après l'envoi : sinon le message suivant repart avec le précédent collé devant.
	await expect(page.getByTestId('chat-input')).toHaveValue('');

	await page.reload();
	await expect(page.locator('[data-test-class="chat-message"]').filter({ hasText: texte })).toBeVisible({
		timeout: 15_000
	});
});

/**
 * Le sondage de date, jusqu'à sa conclusion. Voter ne suffit pas : ce qui compte, c'est que le
 * choix majoritaire devienne la date de la liste, visible en haut de l'écran, parce que c'est la
 * seule trace qui survive à la conversation.
 */
test('proposer des dates, voter, et fixer la date retenue', async ({ signedInPage: page }) => {
	const nom = nomListe();
	await creerListe(page, nom);

	await page.getByTestId('new-poll-date').click();
	await page.getByTestId('poll-question').fill('Quel soir ?');
	await page.getByTestId('poll-choices').fill('Vendredi\nSamedi');
	await page.getByTestId('poll-create').click();

	const sondage = page.locator('[data-test-class="poll-card"]').last();
	await expect(sondage).toBeVisible({ timeout: 15_000 });

	const choix = sondage.locator('[data-test-class="poll-vote"]');
	await expect(choix).toHaveCount(2);

	await choix.filter({ hasText: 'Samedi' }).click();
	await expect(choix.filter({ hasText: 'Samedi' })).toHaveAttribute('aria-pressed', 'true', {
		timeout: 15_000
	});

	// Le bouton n'apparaît qu'une fois qu'un choix mène : sans voix, il n'y a rien à retenir.
	const retenir = sondage.locator('[data-test-class="poll-set-date"]');
	await expect(retenir).toBeVisible({ timeout: 15_000 });
	await expect(retenir).toContainText('Samedi');
	await retenir.click();

	await expect(page.getByTestId('event-date')).toContainText('Samedi', { timeout: 15_000 });
});

/**
 * Un sondage sans choix n'est pas un sondage. Le refus doit se voir sur place, sans fermer le
 * formulaire : refermé, il emporterait la question déjà tapée.
 */
test('un sondage sans choix est refusé sans fermer le formulaire', async ({
	signedInPage: page
}) => {
	const nom = nomListe();
	await creerListe(page, nom);

	await page.getByTestId('new-poll-date').click();
	await page.getByTestId('poll-question').fill('Quel soir ?');
	await page.getByTestId('poll-choices').fill('   \n  ');
	await page.getByTestId('poll-create').click();

	await expect(page.getByTestId('poll-error')).toBeVisible();
	await expect(page.getByTestId('poll-form')).toBeVisible();
	await expect(page.getByTestId('poll-question')).toHaveValue('Quel soir ?');
	await expect(page.locator('[data-test-class="poll-card"]')).toHaveCount(0);
});
