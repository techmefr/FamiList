import { createHmac } from 'node:crypto';
import type { Page } from '@playwright/test';
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

/**
 * Retire le deuxième facteur et n'en revient qu'une fois le compte d'accord.
 *
 * L'interrupteur répond du geste : il passe à « éteint » dès le clic, avant même que la demande
 * soit partie. S'arrêter là, puis recharger ou fermer la page, coupait la requête en vol — le
 * facteur restait en base, et tout ce qui se connectait ensuite butait sur une demande de code.
 * La ligne d'état, elle, ne change qu'après relecture de la liste des facteurs : c'est le seul
 * signal qui réponde du compte, et c'est celui qu'on attend.
 */
async function retirerDeuxiemeEtape(page: Page) {
	await page.goto('/profile/security');

	const etat = page.getByTestId('totp-state');
	await expect(etat).toBeVisible({ timeout: 15_000 });

	if ((await etat.getAttribute('data-test-state')) === 'off') return;

	await page.getByTestId('totp-switch').click();
	await expect(etat).toHaveAttribute('data-test-state', 'off', { timeout: 15_000 });
}

/**
 * Le nettoyage doit tenir même si le test s'est arrêté en chemin, le carré à peine affiché ou le
 * code à peine confirmé : ce qu'il laisse derrière lui n'arrête pas seulement ce test-ci, mais
 * tout ce qui se connecte après. On repasse donc ici quoi qu'il arrive, et on n'en sort qu'une
 * fois le compte revenu au mot de passe seul.
 *
 * La reconnexion peut elle-même se heurter à la demande de code — c'est le cas quand l'échec est
 * survenu après l'activation. Le secret retenu par le test sert alors à la franchir.
 */
let secretEnCours: string | null = null;

test.afterEach(async ({ page }) => {
	if (!secretEnCours) return;

	const secret = secretEnCours;
	secretEnCours = null;

	// Le champ de courriel plutôt que le choix « se connecter » pour reconnaître le formulaire :
	// ce dernier est une case réservée aux lecteurs d'écran, d'un pixel de côté, dont la visibilité
	// ne veut pas dire grand-chose.
	const courriel = page.getByTestId('auth-email');
	const demandeCode = page.getByTestId('mfa-form');
	const ouverte = page.getByTestId('nav-create');

	await page.goto('/auth');

	// Trois états possibles en arrivant, et on attend qu'il s'en présente un plutôt que de deviner
	// lequel : le formulaire, la demande de code, ou l'application déjà ouverte.
	await expect(courriel.or(demandeCode).or(ouverte).first()).toBeVisible({ timeout: 15_000 });

	if (await courriel.isVisible()) {
		await page.getByTestId('mode-signin').check();
		await courriel.fill(FIXTURE_EMAIL);
		await page.getByTestId('auth-password').fill(FIXTURE_PASSWORD);
		await page.getByTestId('auth-submit').click();
		await expect(demandeCode.or(ouverte).first()).toBeVisible({ timeout: 15_000 });
	}

	if (await demandeCode.isVisible()) {
		await page.getByTestId('mfa-code').fill(codeTotp(secret));
		await page.getByTestId('mfa-submit').click();
	}

	await expect(ouverte).toBeVisible({ timeout: 15_000 });
	await retirerDeuxiemeEtape(page);
});

test('activer la 2FA, se reconnecter avec un code, puis la retirer', async ({
	signedInPage: page
}) => {
	await page.goto('/profile/security');

	await page.getByTestId('totp-switch').click();

	// Le carré à photographier, et la clé pour qui ne peut pas viser un carré : les deux doivent
	// être là, c'est le seul moment où le secret existe à l'écran.
	await expect(page.getByTestId('totp-qr')).toBeVisible({ timeout: 15_000 });
	const secret = (await page.getByTestId('totp-secret').innerText()).trim();
	expect(secret).not.toBe('');

	// À partir d'ici le compte peut se retrouver en 2FA : le filet de fin de test en a besoin.
	secretEnCours = secret;

	await page.getByTestId('totp-code').fill(codeTotp(secret));
	await page.getByTestId('totp-confirm').click();

	// Activer la deuxième étape sans codes de secours reviendrait à poser un verrou en jetant le
	// double de la clé : ils doivent arriver dans la foulée, sans qu'on les demande.
	await expect(page.getByTestId('backup-codes')).toBeVisible({ timeout: 15_000 });
	const secours = await page.locator('[data-test-id="backup-codes"] li').allInnerTexts();
	expect(secours.length).toBeGreaterThan(0);

	// L'interrupteur prend l'avance du geste pendant l'inscription : on le relit après rechargement,
	// pour qu'il réponde de l'état du compte et non de cette avance.
	await page.reload();
	await expect(page.getByTestId('totp-switch')).toHaveAttribute('aria-checked', 'true', {
		timeout: 15_000
	});

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
	await retirerDeuxiemeEtape(page);
	secretEnCours = null;
});
