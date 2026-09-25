import type { CDPSession, Page } from '@playwright/test';
import { expectNoNewViolations, presetAppearance } from './a11y';
import { test, expect, FIXTURE_EMAIL, FIXTURE_PASSWORD } from './fixtures';

/**
 * The phone's own unlock as a second factor (#328), played by Chromium's virtual authenticator: an
 * "internal" one, with user verification and PRF, which is what a fingerprint reader looks like to a page.
 *
 * A passkey belongs to a domain name, never to an IP address: these tests leave the configured
 * `127.0.0.1` for `localhost`, the same server under a name WebAuthn accepts.
 */

const onLocalhost = (path: string) => {
	const base = new URL(test.info().project.use.baseURL ?? 'http://127.0.0.1:4173');
	base.hostname = 'localhost';
	return new URL(path, base).toString();
};

async function signInOnLocalhost(
	page: Page,
	email: string,
	password: string,
	appearance: Record<string, string> = {}
) {
	await presetAppearance(page, appearance);
	await page.goto(onLocalhost('/auth'));
	await page.getByTestId('mode-signin').check();
	await page.getByTestId('auth-email').fill(email);
	await page.getByTestId('auth-password').fill(password);
	await page.getByTestId('auth-submit').click();
}

async function addPlatformAuthenticator(page: Page): Promise<{ cdp: CDPSession; id: string }> {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			transport: 'internal',
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true,
			hasPrf: true
		}
	});
	return { cdp, id: authenticatorId };
}

test.describe('déverrouillage de l’appareil, sans rien activer', () => {
	test('propose le déverrouillage quand le téléphone sait le faire', async ({ page }) => {
		await addPlatformAuthenticator(page);
		await signInOnLocalhost(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);
		await expect(page.getByTestId('nav-create')).toBeVisible({ timeout: 15_000 });

		await page.goto(onLocalhost('/profile/security'));
		await expect(page.getByTestId('device-unlock')).toBeVisible();
		await expect(page.getByTestId('device-unlock-add')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId('device-unlock-unavailable')).toHaveCount(0);

		await expectNoNewViolations(page, 'securite');
	});

	test('tient en arabe, en police confort et pour un gaucher, sur un téléphone', async ({ page }) => {
		await page.setViewportSize({ width: 412, height: 915 });
		await page.addInitScript(() => localStorage.setItem('familist:locale', 'ar'));
		await addPlatformAuthenticator(page);
		await signInOnLocalhost(page, FIXTURE_EMAIL, FIXTURE_PASSWORD, {
			fontScaleId: 'comfort',
			fontId: 'atkinson',
			hand: 'left'
		});
		await expect(page.getByTestId('nav-create').first()).toBeAttached({ timeout: 15_000 });

		await page.goto(onLocalhost('/profile/security'));
		const add = page.getByTestId('device-unlock-add');
		await expect(add).toBeVisible({ timeout: 15_000 });
		await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

		const outside = await page.getByTestId('device-unlock').evaluate((card) => {
			const width = document.documentElement.clientWidth;
			return [card, ...card.querySelectorAll('*')].filter((element) => {
				const { left, right } = element.getBoundingClientRect();
				return left < -1 || right > width + 1;
			}).length;
		});
		expect(outside).toBe(0);
		const box = await add.boundingBox();
		expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
	});

	test('garde l’application d’authentification quand le navigateur ne sait pas', async ({ page }) => {
		await page.addInitScript(() => {
			Reflect.deleteProperty(window, 'PublicKeyCredential');
		});
		await signInOnLocalhost(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);
		await expect(page.getByTestId('nav-create')).toBeVisible({ timeout: 15_000 });

		await page.goto(onLocalhost('/profile/security'));
		await expect(page.getByTestId('device-unlock-unavailable')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId('device-unlock-add')).toHaveCount(0);
		await expect(page.getByTestId('totp-switch')).toBeVisible();
	});
});

/**
 * The whole journey enrols a factor, so it never runs on the shared fixture account: enabling a second
 * factor there would stop every other test at sign-in. It needs an approved account of its own and an
 * instance with `[auth.mfa.web_authn]` enabled (see `supabase/config.toml`).
 */
const OWN_EMAIL = process.env.E2E_WEBAUTHN_EMAIL;
const OWN_PASSWORD = process.env.E2E_WEBAUTHN_PASSWORD;

test.describe('déverrouillage de l’appareil, parcours complet', () => {
	test.skip(!OWN_EMAIL || !OWN_PASSWORD, 'needs E2E_WEBAUTHN_EMAIL / E2E_WEBAUTHN_PASSWORD, an account of its own');

	test.afterEach(async ({ page }) => {
		await page.context().setOffline(false);
		await page.goto(onLocalhost('/profile/security'));
		const confirm = page.getByTestId('mfa-device-confirm');
		const card = page.getByTestId('device-unlock');
		await expect(confirm.or(card).first()).toBeVisible({ timeout: 15_000 });
		if (await confirm.isVisible()) {
			await confirm.click();
			await page.goto(onLocalhost('/profile/security'));
		}
		await expect(card).toBeVisible({ timeout: 15_000 });

		const remove = page.locator('[data-test-class="device-unlock-remove"]');
		for (let left = await remove.count(); left > 0; left--) {
			await remove.first().click();
			await expect(remove).toHaveCount(left - 1, { timeout: 15_000 });
		}
	});

	test('enrôler, se reconnecter, révéler puis rouvrir hors ligne avec l’empreinte', async ({ page }) => {
		test.setTimeout(180_000);
		await addPlatformAuthenticator(page);
		await signInOnLocalhost(page, OWN_EMAIL!, OWN_PASSWORD!);
		await expect(page.getByTestId('nav-create')).toBeVisible({ timeout: 15_000 });

		await page.goto(onLocalhost('/profile/security'));
		await page.getByTestId('device-unlock-add').click();
		await expect(page.getByTestId('device-unlock-added')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId('backup-codes')).toBeVisible();
		await page.getByTestId('backup-done').click();

		await page.goto(onLocalhost('/profile'));
		await page.getByTestId('sign-out').click();
		await signInOnLocalhost(page, OWN_EMAIL!, OWN_PASSWORD!);
		await page.getByTestId('mfa-device-confirm').click();
		await expect(page.getByTestId('nav-create')).toBeVisible({ timeout: 15_000 });

		const name = `Empreinte e2e ${Date.now()}`;
		const password = `Mdp-${Date.now()}`;
		await page.goto(onLocalhost('/cards'));
		await page.getByTestId('card-add').click();
		await page.getByTestId('card-name').fill(name);
		await page.getByTestId('card-code').fill('DEVICE42');
		await page.getByTestId('card-submit').click();
		await page.locator('[data-test-class="card-open"]').filter({ hasText: name }).click();
		await page.getByTestId('card-tab-account').click();
		await page.getByTestId('card-account-open').click();
		await expect(page).toHaveURL(/\/cards\/[0-9a-f-]+\/account/);

		await page.getByTestId('card-account-password-input').fill(password);
		await page.getByTestId('card-account-save').click();
		await expect(page.getByTestId('card-account-notice')).toBeVisible({ timeout: 15_000 });

		await expect(page.getByTestId('card-account-device-hint')).toBeVisible();
		await page.getByTestId('card-account-reveal').click();
		await expect(page.getByTestId('card-account-password')).toHaveText(password, { timeout: 15_000 });

		await page.getByTestId('card-offline-enable-device').click();
		await expect(page.getByTestId('card-offline-setup')).toHaveCount(0, { timeout: 15_000 });
		await page.getByTestId('card-account-hide').click();

		await page.context().setOffline(true);
		await page.getByTestId('card-offline-unlock-device').click();
		await expect(page.getByTestId('card-account-password')).toHaveText(password, { timeout: 15_000 });
		await page.context().setOffline(false);
	});
});
