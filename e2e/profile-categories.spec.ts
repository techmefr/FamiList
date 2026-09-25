import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * The profile is a short list of categories, each opening the screen that holds its settings.
 *
 * Nothing here changes a setting: the account is shared by the whole suite, and every check is a
 * navigation, a search or a measurement. The one test that needs the largest text size blocks the push of
 * the appearance to the account, so it stays on this browser.
 */
test.use({ locale: 'fr-FR' });

const CATEGORIES = [
	['account', /\/profile\/account$/],
	['household', /\/household$/],
	['display', /\/profile\/display$/],
	['feedback', /\/profile\/feedback$/],
	['security', /\/profile\/security$/],
	['ai', /\/profile\/ai$/],
	['images', /\/profile\/images$/],
	['connection', /\/profile\/connection$/],
	['help', /\/profile\/help$/],
	['legal', /\/profile\/legal$/],
	['admin', /\/profile\/admin$/]
] as const;

async function openProfile(page: Page) {
	await page.goto('/profile');
	await expect(page.getByTestId('profile-categories')).toBeVisible({ timeout: 15_000 });
}

test('every category opens its screen, and both back buttons return to the list', async ({
	signedInPage: page
}) => {
	await openProfile(page);

	for (const [id, url] of CATEGORIES) {
		await page.getByTestId(`profile-category-${id}`).click();
		await expect(page).toHaveURL(url);
		await expect(page.locator('h1')).toBeVisible();

		// The system back button on half of them, the on-screen one on the other half: both must land on the
		// list, not on a second copy of it stacked in the history.
		if (id === 'household' || CATEGORIES.findIndex(([other]) => other === id) % 2 === 0) {
			await page.goBack();
		} else {
			await page.getByTestId('profile-back').click();
		}
		await expect(page).toHaveURL(/\/profile$/);
		await expect(page.getByTestId('profile-categories')).toBeVisible();
	}

	await page.goBack();
	await expect(page).not.toHaveURL(/\/profile/);
});

test('a sub-screen opened directly goes back to the profile list', async ({ signedInPage: page }) => {
	await page.goto('/profile/feedback');
	await page.getByTestId('profile-back').click();
	await expect(page).toHaveURL(/\/profile$/);
	await expect(page.getByTestId('profile-categories')).toBeVisible();
});

test('text size and font are one tap from the top of the profile', async ({ signedInPage: page }) => {
	await openProfile(page);

	const shortcut = page.getByTestId('profile-reading-shortcut');
	const categories = page.getByTestId('profile-categories');
	expect((await shortcut.boundingBox())!.y).toBeLessThan((await categories.boundingBox())!.y);

	await shortcut.click();
	await expect(page).toHaveURL(/\/profile\/display#setting-text-size$/);

	const block = page.locator('#setting-text-size');
	await expect(block).toHaveAttribute('data-highlight', '');
	await expect(block).toBeFocused();
	await expect(page.getByTestId('scale-comfort')).toBeAttached();
	await expect(page.locator('#setting-font')).toBeVisible();
});

test('the search jumps to the setting, on its screen', async ({ signedInPage: page }) => {
	await openProfile(page);
	const search = page.getByTestId('settings-search');

	await search.fill('vibration');
	await expect(page.getByTestId('profile-categories')).toBeHidden();
	const results = page.locator('[data-test-class="settings-result"]');
	await expect(results).toHaveCount(1);
	await results.first().click();

	await expect(page).toHaveURL(/\/profile\/feedback#setting-haptics$/);
	await expect(page.locator('#setting-haptics')).toHaveAttribute('data-highlight', '');
	await expect(page.getByTestId('haptics-toggle')).toBeInViewport();

	// A word nobody sees on the screen, only in the category's keywords, still leads somewhere.
	await openProfile(page);
	await search.fill('sombre');
	await expect(results.first()).toHaveAttribute('href', '/profile/display');

	// Accents and case do not matter.
	await search.fill('MOT DE PASSE');
	await expect(results.first()).toHaveAttribute('href', '/profile/security#setting-password');

	await search.fill(`zz${Date.now()}`);
	await expect(page.getByTestId('settings-no-result')).toBeVisible();
	await expect(results).toHaveCount(0);

	await search.fill('');
	await expect(page.getByTestId('profile-categories')).toBeVisible();
});

test('a setting outside the profile screens is reached the same way', async ({ signedInPage: page }) => {
	await openProfile(page);
	await page.getByTestId('settings-search').fill('inviter');
	await page.locator('[data-test-class="settings-result"]').first().click();

	await expect(page).toHaveURL(/\/household#setting-invite$/);
	await expect(page.locator('#setting-invite')).toHaveAttribute('data-highlight', '');
});

test.describe('in Arabic', () => {
	test.use({ locale: 'ar' });

	test('the list reads right to left and the chevrons point the other way', async ({
		signedInPage: page
	}) => {
		await openProfile(page);
		await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

		const row = page.getByTestId('profile-category-display');
		const chevron = row.locator('svg').last();
		const rotation = await chevron.evaluate((element) => getComputedStyle(element).rotate);
		expect(rotation).toBe('180deg');

		const rowBox = (await row.boundingBox())!;
		const chevronBox = (await chevron.boundingBox())!;
		expect(chevronBox.x).toBeLessThan(rowBox.x + rowBox.width / 2);
	});
});

test.describe('at the largest text size on a phone', () => {
	test.use({ viewport: { width: 360, height: 740 } });

	test('no screen of the profile spills sideways', async ({ signedInPage: page }) => {
		await page.route('**/rest/v1/profiles**', (route) =>
			route.request().method() === 'GET' ? route.continue() : route.fulfill({ status: 204 })
		);
		await page.addInitScript(() => {
			const raw = localStorage.getItem('familist:appearance');
			const saved = raw ? JSON.parse(raw) : {};
			localStorage.setItem(
				'familist:appearance',
				JSON.stringify({ ...saved, fontScaleId: 'comfort', fontId: 'atkinson', changedAt: Date.now() })
			);
		});

		for (const path of ['/profile', ...CATEGORIES.map(([, url]) => url.source.replace(/\\|\$/g, ''))]) {
			await page.goto(path);
			await expect(page.locator('html')).toHaveAttribute('data-scale', 'comfort');
			await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });

			// The screen's own content, not the navigation bar around it: the bar is shared by every screen and
			// has its own tests.
			const spill = await page.locator('main').evaluate((main) => main.scrollWidth - main.clientWidth);
			expect(spill, `${path} spills sideways`).toBeLessThanOrEqual(0);
		}
	});
});
