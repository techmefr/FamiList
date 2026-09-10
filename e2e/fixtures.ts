import { test as base, expect, type Page } from '@playwright/test';

/** Les comptes posés par `supabase/seed.sql`, confirmés et approuvés dès `supabase db reset`. */
export const FIXTURE_EMAIL = 'e2e@familist.test';
export const SECOND_EMAIL = 'e2e-second@familist.test';
export const FIXTURE_PASSWORD = 'familist-e2e-test';

/** Connexion par le formulaire, jusqu'à ce que l'application soit vraiment ouverte. */
export async function signIn(page: Page, email: string, password: string) {
	await page.goto('/auth');
	await page.getByTestId('mode-signin').check();
	await page.getByTestId('auth-email').fill(email);
	await page.getByTestId('auth-password').fill(password);
	await page.getByTestId('auth-submit').click();
	await expect(page.getByTestId('nav-create')).toBeVisible({ timeout: 15_000 });
}

export async function signOut(page: Page) {
	await page.goto('/profile');
	await page.getByTestId('sign-out').click();
	await expect(page).toHaveURL(/\/auth|\/welcome/);
}

/**
 * Une page déjà connectée avec le compte fixe.
 *
 * En passant par le formulaire à chaque test plutôt qu'en réutilisant un état de session stocké :
 * un stockage partagé entre tests qui tournent en parallèle localement se marcherait dessus, et la
 * connexion elle-même est un chemin qu'on veut voir exercé par chaque suite, pas contourné.
 */
export const test = base.extend<{ signedInPage: Page }>({
	signedInPage: async ({ page }, use) => {
		// Sans ça, le tour guidé s'ouvre tout seul (première visite = stockage vide) et son overlay
		// intercepte les clics des tests suivants — on ne teste pas le tour ici, on le neutralise.
		// `changedAt` doit être posé : sans lui `localWins` est faux, et la synchronisation
		// d'apparence qui suit la connexion réécrase aussitôt ce réglage avec celui, vierge, resté
		// en base pour ce compte fixe.
		await page.addInitScript(() => {
			localStorage.setItem(
				'familist:appearance',
				JSON.stringify({ hasSeenTour: true, hasSeenWelcome: true, changedAt: Date.now() })
			);
		});

		await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);

		await use(page);
	}
});

export { expect };
