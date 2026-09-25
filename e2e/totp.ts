import { createHmac } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { base32Decode, counterBytes, totpCounter, truncate } from '../src/lib/domain/totp';
import { FIXTURE_EMAIL, FIXTURE_PASSWORD } from './accounts';

/**
 * Where the secret of a second step still on the fixture account is kept, outside `test-results` which
 * Playwright empties at every run. A test that dies after enabling it leaves the account behind a code
 * prompt; with the secret on disk, the next sign-in gets through and removes it instead of failing every
 * test that follows.
 */
const SECRET_FILE = resolve('node_modules/.cache/familist-e2e/totp-secret');

export function codeTotp(secret: string, atMs = Date.now()): string {
	const digest = createHmac('sha1', Buffer.from(base32Decode(secret)))
		.update(Buffer.from(counterBytes(totpCounter(atMs))))
		.digest();

	return truncate(new Uint8Array(digest));
}

export function rememberSecret(secret: string) {
	mkdirSync(dirname(SECRET_FILE), { recursive: true });
	writeFileSync(SECRET_FILE, secret);
}

function rememberedSecret(): string | null {
	try {
		return readFileSync(SECRET_FILE, 'utf8').trim() || null;
	} catch {
		return null;
	}
}

function forgetSecret() {
	rmSync(SECRET_FILE, { force: true });
}

export async function enableSecondStep(page: Page): Promise<string> {
	await page.goto('/profile/security');
	await page.getByTestId('totp-switch').click();
	await expect(page.getByTestId('totp-qr')).toBeVisible({ timeout: 15_000 });

	const secret = (await page.getByTestId('totp-secret').innerText()).trim();
	rememberSecret(secret);
	await page.getByTestId('totp-code').fill(codeTotp(secret));
	await page.getByTestId('totp-confirm').click();
	await expect(page.getByTestId('backup-codes')).toBeVisible({ timeout: 15_000 });

	return secret;
}

export async function removeSecondStep(page: Page) {
	await page.goto('/profile/security');

	const status = page.getByTestId('totp-state');
	await expect(status).toBeVisible({ timeout: 15_000 });

	if ((await status.getAttribute('data-test-state')) !== 'off') {
		await page.getByTestId('totp-switch').click();
		await expect(status).toHaveAttribute('data-test-state', 'off', { timeout: 15_000 });
	}

	forgetSecret();
}

/** Called when a sign-in lands on the code prompt nobody asked for: a previous test left its second step. */
export async function clearLeftoverSecondStep(page: Page) {
	const secret = rememberedSecret();
	if (!secret) {
		throw new Error(
			'The fixture account still has a second step and its secret is lost. Remove it with: ' +
				"delete from auth.mfa_factors where user_id in (select id from auth.users where email = 'e2e@familist.test');"
		);
	}

	await page.getByTestId('mfa-code').fill(codeTotp(secret));
	await page.getByTestId('mfa-submit').click();
	await expect(page.getByTestId('nav-create')).toBeVisible({ timeout: 15_000 });
	await removeSecondStep(page);
}

/**
 * Heads for the security screen and lets the app redirect: a live aal2 session lands there, an aal1 one on
 * the code prompt, none on the sign-in form. Opening `/auth` instead raced the app, which shows the form
 * then leaves for `/` once it finds the session, and the click on the vanished form waited forever.
 */
export async function signBackInAndRemoveSecondStep(page: Page, secret: string) {
	const act = { timeout: 15_000 };
	const status = page.getByTestId('totp-state');
	const codeForm = page.getByTestId('mfa-form');
	const email = page.getByTestId('auth-email');

	await page.context().setOffline(false);
	await page.goto('/profile/security');
	await expect(status.or(codeForm).or(email).first()).toBeVisible({ timeout: 30_000 });

	if (await email.isVisible()) {
		await page.getByTestId('mode-signin').check(act);
		await email.fill(FIXTURE_EMAIL, act);
		await page.getByTestId('auth-password').fill(FIXTURE_PASSWORD, act);
		await page.getByTestId('auth-submit').click(act);
		await expect(codeForm.or(page.getByTestId('nav-create')).first()).toBeVisible(act);
	}

	if (await codeForm.isVisible()) {
		await page.getByTestId('mfa-code').fill(codeTotp(secret), act);
		await page.getByTestId('mfa-submit').click(act);
		await expect(codeForm).toBeHidden(act);
	}

	await removeSecondStep(page);
}
