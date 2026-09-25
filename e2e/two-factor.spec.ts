import { test, expect, signOut, FIXTURE_EMAIL, FIXTURE_PASSWORD } from './fixtures';
import { codeTotp, rememberSecret, removeSecondStep } from './totp';

/**
 * The second step was entirely written — QR, key in plain text, backup codes, prompt screen at sign-in —
 * and verified by a single test: that the "Enable" button was shown. Next to nothing, in other words.
 * This test plays the part of the authenticator: it reads the key shown on screen, computes the six-digit
 * code as the phone would, and goes all the way — enabling, signing out, signing back in through the code
 * prompt.
 *
 * It cleans up behind itself: the fixed account is shared by the whole suite, and leaving it in 2FA would
 * block every other test at sign-in.
 */

/**
 * The cleanup must hold even if the test stopped mid-way, with the square barely shown or the code barely
 * confirmed: what it leaves behind stops not only this test, but everything signing in after it. So we
 * come through here whatever happens, and only leave once the account is back to the password alone.
 *
 * Signing back in can itself hit the code prompt — that is the case when the failure happened after
 * enabling. The secret kept by the test then serves to get through it.
 */
let secretEnCours: string | null = null;

test.afterEach(async ({ page }) => {
	if (!secretEnCours) return;

	const secret = secretEnCours;
	secretEnCours = null;

	// The email field rather than the "sign in" choice to recognise the form: the latter is a box reserved
	// for screen readers, one pixel across, whose visibility does not mean much.
	const email = page.getByTestId('auth-email');
	const codeForm = page.getByTestId('mfa-form');
	const visible = page.getByTestId('nav-create');

	await page.goto('/auth');

	// Three possible states on arrival, and we wait for one of them to appear rather than guess which: the
	// form, the code prompt, or the application already open.
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
});

test('activer la 2FA, se reconnecter avec un code, puis la retirer', async ({
	signedInPage: page
}) => {
	await page.goto('/profile/security');

	await page.getByTestId('totp-switch').click();

	// The square to photograph, and the key for anyone who cannot aim at a square: both must be there, it is
	// the only moment the secret exists on screen.
	await expect(page.getByTestId('totp-qr')).toBeVisible({ timeout: 15_000 });
	const secret = (await page.getByTestId('totp-secret').innerText()).trim();
	expect(secret).not.toBe('');

	// From here on the account may end up in 2FA: the end-of-test net needs to know.
	secretEnCours = secret;
	rememberSecret(secret);

	await page.getByTestId('totp-code').fill(codeTotp(secret));
	await page.getByTestId('totp-confirm').click();

	// Enabling the second step with no backup codes would amount to putting up a lock and throwing away the
	// spare key: they must arrive straight away, without being asked for.
	await expect(page.getByTestId('backup-codes')).toBeVisible({ timeout: 15_000 });
	const backup = await page.locator('[data-test-id="backup-codes"] li').allInnerTexts();
	expect(backup.length).toBeGreaterThan(0);

	// The switch takes the lead from the gesture during enrolment: we read it again after a reload, so that
	// it answers for the account's state and not for that lead.
	await page.reload();
	await expect(page.getByTestId('totp-switch')).toHaveAttribute('aria-checked', 'true', {
		timeout: 15_000
	});

	// The real question: does the door close? We sign out and come back.
	await signOut(page);

	await page.goto('/auth');
	await page.getByTestId('mode-signin').check();
	await page.getByTestId('auth-email').fill(FIXTURE_EMAIL);
	await page.getByTestId('auth-password').fill(FIXTURE_PASSWORD);
	await page.getByTestId('auth-submit').click();

	// The password alone is no longer enough: the code prompt stands in the way.
	await expect(page).toHaveURL(/\/auth\/mfa/, { timeout: 15_000 });
	await expect(page.getByTestId('mfa-form')).toBeVisible();

	await page.getByTestId('mfa-code').fill(codeTotp(secret));
	await page.getByTestId('mfa-submit').click();
	await expect(page.getByTestId('nav-create')).toBeVisible({ timeout: 15_000 });

	// Putting things back: the fixed account is shared by the whole suite, and leaving it in 2FA would stop
	// every other test at sign-in.
	await removeSecondStep(page);
	secretEnCours = null;
});
