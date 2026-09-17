import { test as base, expect, type Page } from '@playwright/test';

/** The accounts set by `supabase/seed.sql`, confirmed and approved from `supabase db reset` onwards. */
export const FIXTURE_EMAIL = 'e2e@familist.test';
export const SECOND_EMAIL = 'e2e-second@familist.test';
export const FIXTURE_PASSWORD = 'familist-e2e-test';

/** Signing in through the form, until the application is really open. */
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
 * A page already signed in with the fixed account.
 *
 * Going through the form on every test rather than reusing a stored session state: storage shared between
 * tests running in parallel locally would tread on itself, and signing in is itself a path we want every
 * suite to exercise, not to bypass.
 */
export const test = base.extend<{ signedInPage: Page }>({
	signedInPage: async ({ page }, use) => {
		// Without this, the guided tour opens on its own (first visit = empty storage) and its overlay
		// intercepts the clicks of the following tests — we are not testing the tour here, we neutralise it.
		// `changedAt` must be set: without it `localWins` is false, and the appearance sync that follows
		// signing in immediately overwrites this setting with the blank one left in the database for this
		// fixed account.
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
