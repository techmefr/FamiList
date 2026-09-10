import { createHmac } from 'node:crypto';
import { test, expect, signIn, signOut, FIXTURE_EMAIL, FIXTURE_PASSWORD } from './fixtures';
import { base32Decode, counterBytes, totpCounter, truncate } from '../src/lib/domain/totp';

/**
 * La deuxième étape était entièrement écrite — QR, clé en clair, codes de secours, écran de
 * demande à la connexion — et vérifiée par un seul test : que le bouton « Activer » s'affiche.
 * Autant dire rien. Ce test-ci joue le rôle de l'authentificateur : il lit la clé affichée à
 * l'écran, calcule le code à six chiffres comme le ferait le téléphone, et va jusqu'au bout —
 * activation, déconnexion, reconnexion à travers la demande de code.
 *
 * Il se nettoie derrière lui : le compte fixe est partagé par toute la suite, et le laisser en
 * 2FA bloquerait tous les autres tests à la connexion.
 */
function codeTotp(secret: string, atMs = Date.now()): string {
	const digest = createHmac('sha1', Buffer.from(base32Decode(secret)))
		.update(Buffer.from(counterBytes(totpCounter(atMs))))
		.digest();

	return truncate(new Uint8Array(digest));
}

test('activer la 2FA, se reconnecter avec un code, puis la retirer', async ({
	signedInPage: page
}) => {
	await page.goto('/profile/security');

	await page.getByTestId('totp-enable').click();

	// Le carré à photographier, et la clé pour qui ne peut pas viser un carré : les deux doivent
	// être là, c'est le seul moment où le secret existe à l'écran.
	await expect(page.getByTestId('totp-qr')).toBeVisible({ timeout: 15_000 });
	const secret = (await page.getByTestId('totp-secret').innerText()).trim();
	expect(secret).not.toBe('');

	await page.getByTestId('totp-code').fill(codeTotp(secret));
	await page.getByTestId('totp-confirm').click();

	// Activer la deuxième étape sans codes de secours reviendrait à poser un verrou en jetant le
	// double de la clé : ils doivent arriver dans la foulée, sans qu'on les demande.
	await expect(page.getByTestId('backup-codes')).toBeVisible({ timeout: 15_000 });
	const secours = await page.locator('[data-test-id="backup-codes"] li').allInnerTexts();
	expect(secours.length).toBeGreaterThan(0);

	await expect(page.getByTestId('totp-active')).toBeVisible();

	// La vraie question : est-ce que la porte se referme ? On se déconnecte et on revient.
	await signOut(page);

	await page.goto('/auth');
	await page.getByTestId('mode-signin').check();
	await page.getByTestId('auth-email').fill(FIXTURE_EMAIL);
	await page.getByTestId('auth-password').fill(FIXTURE_PASSWORD);
	await page.getByTestId('auth-submit').click();

	// Le mot de passe seul ne suffit plus : la demande de code s'interpose.
	await expect(page).toHaveURL(/\/auth\/mfa/, { timeout: 15_000 });
	await expect(page.getByTestId('mfa-form')).toBeVisible();

	await page.getByTestId('mfa-code').fill(codeTotp(secret));
	await page.getByTestId('mfa-submit').click();
	await expect(page.getByTestId('nav-create')).toBeVisible({ timeout: 15_000 });

	// Remise en état : le compte fixe est partagé par toute la suite, et le laisser en 2FA
	// arrêterait tous les autres tests à la connexion.
	await page.goto('/profile/security');
	await page.getByTestId('totp-disable').click();
	await expect(page.getByTestId('totp-enable')).toBeVisible({ timeout: 15_000 });
});
