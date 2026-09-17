import { expectNoNewViolations, presetAppearance } from './a11y';
import { test, expect, signIn, FIXTURE_EMAIL, FIXTURE_PASSWORD } from './fixtures';

/**
 * The screens reachable directly once signed in. The rest (list detail, emoji palette) needs a journey and
 * has its own test.
 */
const ROUTES: Array<{ screen: string; path: string; ready: string }> = [
	{ screen: 'accueil', path: '/', ready: 'nav-create' },
	{ screen: 'magasins', path: '/shops', ready: 'nav-create' },
	{ screen: 'cartes', path: '/cards', ready: 'nav-create' },
	{ screen: 'recettes', path: '/recipes', ready: 'nav-create' },
	{ screen: 'prix', path: '/prices', ready: 'nav-create' },
	{ screen: 'foyer', path: '/household', ready: 'nav-create' },
	{ screen: 'discussion', path: '/chat', ready: 'nav-create' },
	{ screen: 'profil', path: '/profile', ready: 'sign-out' },
	{ screen: 'securite', path: '/profile/security', ready: 'nav-create' },
	{ screen: 'intelligence-artificielle', path: '/profile/ai', ready: 'ai-form' },
	{ screen: 'signalement', path: '/report', ready: 'nav-create' },
	// The fixed account is the first created, therefore an administrator: the screen really opens and carries
	// its three sections, including the crashes one.
	{ screen: 'administration', path: '/admin', ready: 'nav-create' }
];

test.describe('accessibilite', () => {
	// Without this, axe sometimes analyses a screen in the middle of its entry animation: an element still
	// transparent is ignored, and the same screen reports sometimes two violations, sometimes none.
	test.use({ reducedMotion: 'reduce' });

	test('connexion', async ({ page }) => {
		await presetAppearance(page);
		await page.goto('/auth');
		await expect(page.getByTestId('auth-submit')).toBeVisible({ timeout: 15_000 });

		await expectNoNewViolations(page, 'connexion');
	});

	for (const { screen, path, ready } of ROUTES) {
		test(screen, async ({ signedInPage: page }) => {
			await page.goto(path);
			await expect(page.getByTestId(ready)).toBeVisible({ timeout: 15_000 });

			await expectNoNewViolations(page, screen);
		});
	}

	/**
	 * The account deletion form only exists after a first gesture: the folded screen would say nothing about
	 * the confirmation field or the warning that comes with it. We open it, and stop there — the fixture
	 * account serves every other test.
	 */
	test('suppression de compte', async ({ signedInPage: page }) => {
		await page.goto('/profile/security');
		await page.getByTestId('delete-start').click();
		await expect(page.getByTestId('delete-confirm')).toBeVisible();

		await expectNoNewViolations(page, 'suppression-de-compte');
	});

	/**
	 * The choice of who to write to only exists once the panel is open: the folded screen would say nothing
	 * about the list's buttons or the heading announcing them.
	 */
	test('messages prives', async ({ signedInPage: page }) => {
		await page.goto('/chat');
		await page.getByTestId('new-direct').click();
		await expect(page.getByTestId('direct-picker')).toBeVisible();

		await expectNoNewViolations(page, 'messages-prives');
	});

	test('detail de liste et palette d emojis', async ({ signedInPage: page }) => {
		const name = `A11y ${Date.now()}`;

		await page.goto('/');
		await page.getByTestId('nav-create').click();
		await page.getByTestId('create-list').click();
		await page.getByTestId('list-name').fill(name);

		// The emoji palette carries the translated labels read by screen readers: it is analysed open, on the
		// creation form, where it lives.
		await expectNoNewViolations(page, 'creation-de-liste');

		await page.getByTestId('list-create').click();
		await page
			.locator('[data-test-class="list-card"]')
			.filter({ hasText: name })
			.getByRole('link')
			.first()
			.click();
		await expect(page).toHaveURL(/\/l\//);
		await expect(page.getByTestId('list-empty')).toBeVisible();

		await expectNoNewViolations(page, 'detail-de-liste');
	});

	/**
	 * The recipe form is typed in three stages, and each shows fields the other two hide: analysing the
	 * folded screen would say nothing about the ingredient rows or the steps text area. So we go through all
	 * three.
	 */
	test('formulaire de recette', async ({ signedInPage: page }) => {
		await page.goto('/recipes');
		await page.getByTestId('recipe-new').click();
		await expect(page.getByTestId('recipe-name')).toBeVisible();

		await page.getByTestId('recipe-name').fill(`A11y ${Date.now()}`);
		await page.getByTestId('recipe-next').click();
		await expect(page.getByTestId('recipe-ingredients')).toBeVisible();
		await page.getByTestId('recipe-add-ingredient').click();

		await page.getByTestId('recipe-next').click();
		await expect(page.getByTestId('recipe-steps')).toBeVisible();

		await expectNoNewViolations(page, 'creation-de-recette');
	});

	/**
	 * The install offer, banner then explanation.
	 *
	 * Two things are simulated, for want of being able to get them from a driven browser: the opening
	 * counter, set before loading, and `beforeinstallprompt`, which Chromium only emits on a real installable
	 * origin. The event is replayed by hand once the page is open — which is exactly what the store listens
	 * to.
	 */
	test('proposition d installation', async ({ page }) => {
		await presetAppearance(page);
		await page.addInitScript(() => {
			localStorage.setItem(
				'familist:install',
				JSON.stringify({ openings: 5, refusedAt: null })
			);
		});

		await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);

		await page.evaluate(() => {
			const event = Object.assign(new Event('beforeinstallprompt'), {
				prompt: () => Promise.resolve(),
				userChoice: Promise.resolve({ outcome: 'dismissed' })
			});
			window.dispatchEvent(event);
		});

		await expect(page.getByTestId('install-banner')).toBeVisible();
		await expectNoNewViolations(page, 'installation');

		// The explanation is a modal dialog: it closes with Escape and gives focus back to the banner, which axe
		// does not check — hence the keyboard close, exercised here.
		await page.getByTestId('install-more').click();
		await expect(page.getByTestId('install-details')).toBeVisible();
		await expectNoNewViolations(page, 'installation-explication');

		await page.keyboard.press('Escape');
		await expect(page.getByTestId('install-details')).toBeHidden();
		await expect(page.getByTestId('install-banner')).toBeVisible();
	});

	/**
	 * Dark theme and the largest font step: that is where contrast regressions come from, and enlarged text
	 * can also make two elements overlap. One screen each — the rest of the pages share the same colour
	 * tokens.
	 */
	test('accueil en theme sombre', async ({ page }) => {
		await presetAppearance(page, { theme: 'dark' });
		await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);

		await expectNoNewViolations(page, 'accueil-sombre');
	});

	test('accueil en police confort', async ({ page }) => {
		await presetAppearance(page, { fontScaleId: 'comfort', fontId: 'atkinson' });
		await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);

		await expectNoNewViolations(page, 'accueil-confort');
	});
});
