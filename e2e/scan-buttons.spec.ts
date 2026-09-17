import { test, expect } from './fixtures';

/**
 * Both paths to a code — the camera, an image already on the device — sit side by side. One carried a top
 * margin the other did not have, and icons of another size: on a narrow screen, the offset showed at once.
 *
 * The test measures the real geometry rather than the classes: it is the offset that shows, not the
 * stylesheet.
 */
test('les deux boutons de code sont alignés sur mobile', async ({ signedInPage: page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/cards');
	await page.getByTestId('card-add').click();

	const scan = page.getByTestId('scan-start');
	const image = page.getByTestId('import-code');

	// With no camera, the scan button does not exist: there is then nothing to align.
	await expect(image).toBeVisible();
	if ((await scan.count()) === 0) test.skip();

	// The fonts decide how the labels wrap, and therefore the height of the buttons: measuring before they
	// are loaded gives a geometry that is nobody's.
	await page.evaluate(() => document.fonts.ready);

	/**
	 * The form opens by sliding: measured in the middle of the animation, everything is offset. We read again
	 * until the geometry holds — a real misalignment, for its part, does not settle.
	 *
	 * Depending on the language and the text size, the row fits on one line or wraps. Both cases are fine;
	 * what is not is the few-pixel offset we had — side by side, same height and same top; one under the
	 * other, same left edge.
	 */
	await expect
		.poll(
			async () => {
				const a = await scan.boundingBox();
				const b = await image.boundingBox();
				if (!a || !b) return 'boîtes absentes';

				const side = Math.abs(a.y - b.y) < 4;
				if (side) {
					return Math.abs(a.height - b.height) < 1 ? 'aligné' : `hauteurs ${a.height}/${b.height}`;
				}

				return Math.abs(a.x - b.x) < 1 ? 'aligné' : `bords gauches ${a.x}/${b.x}`;
			},
			{ timeout: 10_000 }
		)
		.toBe('aligné');
});
