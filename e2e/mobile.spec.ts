import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * The only tests played on an emulated phone, and the `mobile` project of `playwright.config.ts` plays
 * only these. Replaying the whole suite twice would double the integration time to re-verify journeys that
 * do not depend on the screen size; what really does depend on it — the bottom bar, the thumb side, the
 * finger swipe — exists nowhere else and lives here.
 *
 * What stays out of reach: Capacitor's native plugins. The barcode reader, haptic feedback, the status bar
 * and the splash screen are native Android and iOS code; an emulated browser runs none of it, and driving
 * them would need a full system emulator. Playwright emulation gives the viewport, touch and the user
 * agent, not the phone.
 */

const MOBILE_BREAKPOINT = 768;

/**
 * A finger swipe, with real touch events.
 *
 * `page.touchscreen` can only tap, and `PointerEvent`s made in JavaScript do not pass: the row captures
 * the pointer, which an invented id does not allow. So we go down to the browser protocol, which produces
 * the same sequence as a real finger.
 */
async function swipe(page: Page, target: Locator, distance: number) {
	const box = await target.boundingBox();
	if (!box) throw new Error('La ligne à glisser n’est pas affichée.');

	const y = box.y + box.height / 2;
	const origin = box.x + box.width / 2;
	const session = await page.context().newCDPSession(page);

	await session.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [{ x: origin, y }]
	});

	// In steps, and not in one jump: the row only commits after recognising a horizontal direction, which a
	// single jump does not give it time to do.
	for (let pas = 1; pas <= 6; pas += 1) {
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [{ x: origin + (distance * pas) / 6, y }]
		});
	}

	await session.send('Input.dispatchTouchEvent', {
		type: 'touchEnd',
		touchPoints: []
	});

	await session.detach();
}

/**
 * The checkbox itself is only read by screen readers; what you touch is the label wrapping it, as in the
 * application.
 */
async function chooseHand(page: Page, main: 'left' | 'right') {
	await page.locator(`label:has([data-test-id="hand-${main}"])`).click();
	await expect(page.getByTestId(`hand-${main}`)).toBeChecked();
	await expect(page.locator('html')).toHaveAttribute('data-hand', main);
}

test('sur téléphone, la navigation est une barre en bas et non une colonne', async ({
	signedInPage: page
}) => {
	await page.goto('/');

	const bar = page.getByRole('navigation');
	const box = await bar.boundingBox();
	expect(box).not.toBeNull();

	const height = page.viewportSize()!.height;
	expect(height).toBeLessThan(MOBILE_BREAKPOINT * 2);

	// Stuck to the bottom of the screen: that is what tells it from the large screen's side column.
	expect(box!.y + box!.height).toBeGreaterThan(height - 2);
	expect(box!.height).toBeLessThan(height / 3);

	// The magnifier only has a tab on a phone, the household and the shops only on a large screen: five
	// targets is the most a thumb can hold.
	await expect(page.getByTestId('nav-/magnifier')).toBeVisible();
	await expect(page.getByTestId('nav-/household')).toBeHidden();
	await expect(page.getByTestId('nav-/shops')).toBeHidden();

	// What the bar no longer carries, the header carries: otherwise the profile would be unreachable.
	await expect(page.getByTestId('header-profile')).toBeVisible();
});

/**
 * Everything plays out without leaving the profile. The setting is pushed to the account with a delay, and
 * a navigation in between brings back the appearance still saved in the database: we would then measure
 * the button from before the gesture. The button being present on every page, staying here costs nothing.
 */
test('le bouton de création change de côté avec la main déclarée', async ({ signedInPage: page }) => {
	await page.goto('/profile');

	const middle = page.viewportSize()!.width / 2;
	const button = page.getByTestId('nav-create');

	await chooseHand(page, 'right');
	const droitier = await button.boundingBox();
	expect(droitier!.x).toBeGreaterThan(middle);

	await chooseHand(page, 'left');
	const leftHanded = await button.boundingBox();
	expect(leftHanded!.x + leftHanded!.width).toBeLessThan(middle);

	// Putting things back: the setting is saved on the fixed account, shared by the whole suite.
	await chooseHand(page, 'right');
});

test('la loupe rend sa place au bouton de création quand on la quitte', async ({
	signedInPage: page
}) => {
	await page.goto('/magnifier');

	// On a phone only: the disc would float in the middle of the label you are trying to read.
	await expect(page.getByTestId('nav-create')).toBeHidden();

	await page.getByTestId('nav-/').click();
	await expect(page.getByTestId('nav-create')).toBeVisible();
});

test('glisser une ligne du doigt la coche, sans passer par son bouton', async ({
	signedInPage: page
}) => {
	const name = `Tactile ${Date.now()}`;

	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(name);
	await page.getByTestId('list-create').click();

	await page
		.locator('[data-test-class="list-card"]')
		.filter({ hasText: name })
		.getByRole('link')
		.first()
		.click();

	await page.getByTestId('empty-add-item').click();
	await page.getByTestId('add-name').fill('Pain');
	await page.getByTestId('add-submit').click();

	const row = page.locator('[data-test-class="item-row"]').filter({ hasText: 'Pain' });
	await expect(row).toBeVisible();
	await expect(row.locator('[data-test-class="item-check"]')).not.toBeChecked();

	await swipe(page, row, 160);

	await expect(row.locator('[data-test-class="item-check"]')).toBeChecked({ timeout: 15_000 });
});
