import { createHmac } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { base32Decode, counterBytes, totpCounter, truncate } from '../src/lib/domain/totp';
import { FIXTURE_EMAIL, FIXTURE_PASSWORD } from './fixtures';

export function codeTotp(secret: string, atMs = Date.now()): string {
	const digest = createHmac('sha1', Buffer.from(base32Decode(secret)))
		.update(Buffer.from(counterBytes(totpCounter(atMs))))
		.digest();

	return truncate(new Uint8Array(digest));
}

export async function enableSecondStep(page: Page): Promise<string> {
	await page.goto('/profile/security');
	await page.getByTestId('totp-switch').click();
	await expect(page.getByTestId('totp-qr')).toBeVisible({ timeout: 15_000 });

	const secret = (await page.getByTestId('totp-secret').innerText()).trim();
	await page.getByTestId('totp-code').fill(codeTotp(secret));
	await page.getByTestId('totp-confirm').click();
	await expect(page.getByTestId('backup-codes')).toBeVisible({ timeout: 15_000 });

	return secret;
}

export async function removeSecondStep(page: Page) {
	await page.goto('/profile/security');

	const status = page.getByTestId('totp-state');
	await expect(status).toBeVisible({ timeout: 15_000 });

	if ((await status.getAttribute('data-test-state')) === 'off') return;

	await page.getByTestId('totp-switch').click();
	await expect(status).toHaveAttribute('data-test-state', 'off', { timeout: 15_000 });
}

export async function signBackInAndRemoveSecondStep(page: Page, secret: string) {
	const email = page.getByTestId('auth-email');
	const codeForm = page.getByTestId('mfa-form');
	const visible = page.getByTestId('nav-create');

	await page.context().setOffline(false);
	await page.goto('/auth');
	await expect(email.or(codeForm).or(visible).first()).toBeVisible({ timeout: 15_000 });

	if (await email.isVisible()) {
		await page.getByTestId('mode-signin').check();
		await email.fill(FIXTURE_EMAIL);
		await page.getByTestId('auth-password').fill(FIXTURE_PASSWORD);
		await page.getByTestId('auth-submit').click();
		await expect(codeForm.or(visible).first()).toBeVisible({ timeout: 15_000 });
	}

	if (await codeForm.isVisible()) {
		await page.getByTestId('mfa-code').fill(codeTotp(secret));
		await page.getByTestId('mfa-submit').click();
	}

	await expect(visible).toBeVisible({ timeout: 15_000 });
	await removeSecondStep(page);
}
