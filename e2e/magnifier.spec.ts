import { test, expect } from './fixtures';

/**
 * What this file does not test, and why.
 *
 * The magnifier is a camera: optical magnification, torch, frozen image, two-finger pinch. A headless
 * browser has no camera, and Chromium's fake camera only returns an animated test pattern, with no zoom or
 * torch capability — a test driving it would verify the scenery, not the tool. The magnification and the
 * cropping from the frame are, for their part, already covered by the unit tests of `$domain/magnifier`,
 * where they are pure computation.
 *
 * What is left is what only an end-to-end test can say: when the camera is missing, the screen announces it
 * instead of staying black, and you can leave. It is the most frequent case for users — permission refused
 * — and the only one a mute screen would make incomprehensible.
 */
test('sans autorisation de caméra, la loupe le dit au lieu de rester noire', async ({
	signedInPage: page
}) => {
	await page.goto('/magnifier');

	await expect(page.getByTestId('magnifier')).toBeVisible();
	await expect(page.getByTestId('magnifier-unavailable')).toBeVisible({ timeout: 15_000 });

	// No stream, so no video element: showing it empty would leave a black rectangle under the message, and
	// you would no longer know which of the two tells the truth.
	await expect(page.getByTestId('magnifier-video')).toHaveCount(0);
	await expect(page.getByTestId('magnifier-hint')).toHaveCount(0);
});

/**
 * The other way to fail: a browser that does not expose the camera at all. The message is not the same — we
 * do not ask to review a permission that does not exist — and the path is distinct in the code, so it is
 * checked separately.
 */
test('un navigateur sans caméra du tout aboutit au même écran lisible', async ({
	signedInPage: page
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
	});

	await page.goto('/magnifier');

	await expect(page.getByTestId('magnifier-unavailable')).toBeVisible({ timeout: 15_000 });
	await expect(page.getByTestId('magnifier-video')).toHaveCount(0);
});

/**
 * You must be able to leave the magnifier. It is laid out full screen, above the content: if it covered the
 * navigation bar, there would be no way out.
 */
test('on quitte la loupe par la navigation', async ({ signedInPage: page }) => {
	await page.goto('/magnifier');
	await expect(page.getByTestId('magnifier')).toBeVisible();

	await page.getByTestId('nav-/cards').click();
	await expect(page).toHaveURL(/\/cards$/);
	await expect(page.getByTestId('magnifier')).toHaveCount(0);
});
