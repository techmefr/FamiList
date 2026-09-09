import { test, expect, FIXTURE_EMAIL, FIXTURE_PASSWORD } from './fixtures';

test.describe('connexion', () => {
	test('un mot de passe erroné affiche une erreur et ne connecte pas', async ({ page }) => {
		await page.goto('/auth');
		await page.getByTestId('mode-signin').check();
		await page.getByTestId('auth-email').fill(FIXTURE_EMAIL);
		await page.getByTestId('auth-password').fill('un-mot-de-passe-qui-ne-marche-pas');
		await page.getByTestId('auth-submit').click();

		await expect(page.getByTestId('auth-error')).toBeVisible();
		await expect(page).toHaveURL(/\/auth/);
	});

	test('un compte valide arrive sur ses listes', async ({ page }) => {
		await page.goto('/auth');
		await page.getByTestId('mode-signin').check();
		await page.getByTestId('auth-email').fill(FIXTURE_EMAIL);
		await page.getByTestId('auth-password').fill(FIXTURE_PASSWORD);
		await page.getByTestId('auth-submit').click();

		await expect(page.getByTestId('nav-create')).toBeVisible({ timeout: 15_000 });
		await expect(page).toHaveURL('/');
	});

	test('le chemin sans mot de passe demande un code plutôt que le mot de passe', async ({ page }) => {
		await page.goto('/auth');
		await page.getByTestId('mode-signin').check();
		await page.getByTestId('auth-passwordless').click();

		await expect(page.getByTestId('auth-code-form')).toBeVisible();
		await expect(page.getByTestId('auth-password')).toHaveCount(0);
	});
});

test.describe('session', () => {
	test('se déconnecter renvoie vers un écran public', async ({ signedInPage: page }) => {
		await page.goto('/profile');
		await page.getByTestId('sign-out').click();

		// /welcome sur un navigateur qui n'a encore rien vu, /auth sinon : les deux sont publics,
		// et c'est justement ce détour par l'accueil qu'on veut voir se produire ici.
		await expect(page).toHaveURL(/\/auth|\/welcome/);
	});

	test('une session déconnectée est renvoyée depuis une page protégée', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL(/\/auth|\/welcome/);
	});
});
