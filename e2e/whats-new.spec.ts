import AxeBuilder from '@axe-core/playwright';
import pkg from '../package.json' with { type: 'json' };
import releases from '../src/lib/changelog/releases.json' with { type: 'json' };
import { presetAppearance } from './a11y';
import { test, expect, signIn, FIXTURE_EMAIL, FIXTURE_PASSWORD } from './fixtures';

const appVersion: string = pkg.version;

test('« ? » → Quoi de neuf montre la version et tout l’historique, du plus récent au plus ancien', async ({
	signedInPage: page
}) => {
	await page.getByTestId('help').click();
	await expect(page.getByTestId('help-menu-version')).toContainText(appVersion);
	await page.getByTestId('help-menu-whatsNew').click();

	const modal = page.getByTestId('changelog-modal');
	await expect(modal).toBeVisible();
	await expect(page.getByTestId('help-menu')).toBeHidden();
	await expect(page.getByTestId('changelog-current-version')).toContainText(appVersion);
	await expect(modal.getByRole('heading', { level: 2 })).toBeFocused();

	const shown = modal.locator('[data-test-class="changelog-release"]');
	await expect(shown).toHaveCount(releases.length);
	await expect(shown.first()).toHaveAttribute('data-version', releases[0].version);
	const lang = (await page.locator('html').getAttribute('lang')) as keyof (typeof releases)[0]['notes'];
	await expect(shown.first().locator('[data-test-class="changelog-new"] li').first()).toHaveText(
		(releases[0].notes[lang] ?? releases[0].notes.en).new[0]
	);

	await page.keyboard.press('Escape');
	await expect(modal).toBeHidden();
	await expect(page.getByTestId('help')).toBeFocused();

	// Having read the history counts as having seen this version: nothing pops up on the next launch.
	await page.reload();
	await expect(page.getByTestId('nav-create')).toBeVisible();
	await expect(modal).toBeHidden();
});

test('« ? » → Quoi de neuf propose aussi de revoir le guide', async ({ signedInPage: page }) => {
	await page.getByTestId('help').click();
	await page.getByTestId('help-menu-whatsNew').click();
	await page.getByTestId('changelog-replay-tour').click();

	await expect(page.getByTestId('changelog-modal')).toBeHidden();
	await expect(page.locator('.driver-popover')).toBeVisible();
});

test('« ? » → le tutoriel reste à côté des nouveautés', async ({ signedInPage: page }) => {
	await page.getByTestId('help').click();
	await expect(page.getByTestId('help-menu-whatsNew')).toBeVisible();
	await page.getByTestId('help-menu-tutorial').click();

	await expect(page.locator('.driver-popover')).toBeVisible();
});

test('après une mise à jour, les nouveautés manquées s’ouvrent une seule fois', async ({ page }) => {
	await presetAppearance(page, { lastSeenChangelogVersion: releases[1].version });
	await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);

	const modal = page.getByTestId('changelog-modal');
	await expect(modal).toBeVisible();
	await expect(modal.locator('[data-test-class="changelog-release"]')).toHaveCount(1);
	await expect(modal.locator('[data-test-class="changelog-release"]')).toHaveAttribute(
		'data-version',
		appVersion
	);

	await page.getByTestId('changelog-acknowledge').click();
	await expect(modal).toBeHidden();
});

test('sur téléphone, en arabe, en taille confort et pour gaucher : lisible, sans débordement ni violation', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.addInitScript(() => localStorage.setItem('familist:locale', 'ar'));
	await presetAppearance(page, { fontScaleId: 'comfort', hand: 'left' });
	await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);

	await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
	await page.getByTestId('help').click();
	await page.getByTestId('help-menu-whatsNew').click();

	const modal = page.getByTestId('changelog-modal');
	await expect(modal).toBeVisible();
	await expect(modal.locator('[data-test-class="changelog-new"] li').first()).toHaveText(
		releases[0].notes.ar.new[0]
	);

	// The sheet itself, not the page behind it: the dialog must fit the phone and wrap its notes.
	await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
	const fit = await page.evaluate(() => {
		const sheet = document.querySelector('[data-test-id="changelog-modal"] > div') as HTMLElement;
		const box = sheet.getBoundingClientRect();
		return {
			left: Math.round(box.left) >= 0,
			right: Math.round(box.right) <= window.innerWidth,
			bottom: Math.round(box.bottom) <= window.innerHeight,
			horizontalOverflow: sheet.scrollWidth - sheet.clientWidth
		};
	});
	expect(fit).toEqual({ left: true, right: true, bottom: true, horizontalOverflow: 0 });

	// The oldest release is reachable by scrolling, and the buttons stay in reach the whole way.
	await modal.locator('[data-test-class="changelog-release"]').last().scrollIntoViewIfNeeded();
	await expect(modal.locator('[data-test-class="changelog-release"]').last()).toBeInViewport();
	await expect(page.getByTestId('changelog-done')).toBeInViewport();

	const { violations } = await new AxeBuilder({ page })
		.include('[data-test-id="changelog-modal"]')
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
		.analyze();
	expect(violations.map((violation) => violation.id)).toEqual([]);
});
