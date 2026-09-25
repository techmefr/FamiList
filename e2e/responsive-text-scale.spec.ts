import { test, expect } from './fixtures';

/**
 * A sweep across the app's main screens, every combination of viewport and text size the person picks in
 * `/profile/display`. Nothing here changes what a screen does — it only measures whether the screen still
 * fits, and whether it renders at all, at sizes a real household member's phone or eyesight actually uses.
 *
 * `sm` is the default scale nobody has to choose. `xl` and `comfort` are the two largest steps — `comfort`
 * already has its own single-page check in profile-categories.spec.ts; this file widens that same idea to
 * every top-level screen, not only the profile's own.
 */

const VIEWPORTS = [
	{ id: 'mobile', width: 375, height: 812 },
	{ id: 'tablet', width: 768, height: 1024 },
	{ id: 'desktop', width: 1280, height: 800 }
] as const;

const SCALES = ['sm', 'xl', 'comfort'] as const;

/** Every top-level screen reachable from the main navigation, in the order it appears there. */
const PAGES = [
	'/',
	'/chat',
	'/cards',
	'/recipes',
	'/shops',
	'/prices',
	'/household',
	'/meal-plan',
	'/admin',
	'/profile'
] as const;

test.describe('responsive layout and text scale sweep', () => {
	for (const viewport of VIEWPORTS) {
		for (const scale of SCALES) {
			test.describe(`${viewport.id} at ${scale}`, () => {
				test.use({ viewport: { width: viewport.width, height: viewport.height } });

				test(`every screen fits, with no console error`, async ({ signedInPage: page }) => {
					await page.addInitScript((scaleId) => {
						const raw = localStorage.getItem('familist:appearance');
						const saved = raw ? JSON.parse(raw) : {};
						localStorage.setItem(
							'familist:appearance',
							JSON.stringify({ ...saved, fontScaleId: scaleId, changedAt: Date.now() })
						);
					}, scale);

					const consoleErrors: string[] = [];
					page.on('console', (message) => {
						if (message.type() === 'error') consoleErrors.push(message.text());
					});
					page.on('pageerror', (error) => consoleErrors.push(error.message));

					for (const path of PAGES) {
						consoleErrors.length = 0;

						await page.goto(path);
						await expect(page.locator('html')).toHaveAttribute('data-scale', scale);
						await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });

						// The screen's own content, not the navigation bar shared by every screen.
						const spill = await page
							.locator('main')
							.first()
							.evaluate((main) => main.scrollWidth - main.clientWidth);
						expect(spill, `${path} spills sideways at ${viewport.id}/${scale}`).toBeLessThanOrEqual(1);

						expect(
							consoleErrors,
							`${path} logged console errors at ${viewport.id}/${scale}: ${consoleErrors.join('; ')}`
						).toHaveLength(0);
					}
				});
			});
		}
	}
});
