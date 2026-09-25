import { test as base, expect, type Page } from '@playwright/test';
import pkg from '../package.json' with { type: 'json' };
import { FIXTURE_EMAIL, FIXTURE_PASSWORD } from './accounts';
import { clearLeftoverSecondStep } from './totp';

const appVersion: string = pkg.version;

export { FIXTURE_EMAIL, SECOND_EMAIL, FIXTURE_PASSWORD } from './accounts';

/** Signing in through the form, until the application is really open. */
export async function signIn(page: Page, email: string, password: string) {
	await page.goto('/auth');
	await page.getByTestId('mode-signin').check();
	await page.getByTestId('auth-email').fill(email);
	await page.getByTestId('auth-password').fill(password);
	await page.getByTestId('auth-submit').click();

	const home = page.getByTestId('nav-create');
	const codeForm = page.getByTestId('mfa-form');
	await expect(home.or(codeForm).first()).toBeVisible({ timeout: 15_000 });
	if (await codeForm.isVisible()) await clearLeftoverSecondStep(page);
	await expect(home).toBeVisible({ timeout: 15_000 });
}

export async function signOut(page: Page) {
	await page.goto('/profile/account');
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
		// The changelog modal is the same story: an unseen version pops a native `<dialog>` that steals every
		// click behind it, hanging most of the suite rather than failing fast. `lastSeenChangelogVersion` is
		// pre-set to the app's own current version for the same reason `hasSeenTour`/`hasSeenWelcome` are.
		// `changedAt` must be set: without it `localWins` is false, and the appearance sync that follows
		// signing in immediately overwrites this setting with the blank one left in the database for this
		// fixed account.
		await page.addInitScript((version: string) => {
			localStorage.setItem(
				'familist:appearance',
				JSON.stringify({
					hasSeenTour: true,
					hasSeenWelcome: true,
					lastSeenChangelogVersion: version,
					changedAt: Date.now()
				})
			);
		}, appVersion);

		await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);

		await use(page);
	}
});

export { expect };
