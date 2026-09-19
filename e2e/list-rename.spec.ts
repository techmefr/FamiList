import { test, expect } from './fixtures';

/**
 * A list's name and emoji were frozen at creation: neither could be corrected, even though they are exactly
 * the two things set in a hurry while creating the list.
 *
 * The list carries a dated name, like the other list tests: it stays behind without ever making a selector
 * ambiguous on the next run.
 */
test('renommer une liste, au bouton comme à l appui long', async ({ signedInPage: page }) => {
	const name = `Courses e2e ${Date.now()}`;
	const renamed = `${name} corrigé`;

	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(name);
	await page.getByTestId('list-create').click();

	const card = page.locator('[data-test-class="list-card"]').filter({ hasText: name });
	await expect(card).toBeVisible();

	// The pencil: the path of the keyboard and the screen reader.
	await card.locator('[data-test-class="list-rename"]').click();
	await expect(page.getByTestId('list-name')).toHaveValue(name);

	await page.getByTestId('list-name').fill(renamed);
	await page.getByTestId('list-create').click();

	const corrected = page.locator('[data-test-class="list-card"]').filter({ hasText: renamed });
	await expect(corrected).toBeVisible();

	// The form closes again, and does not stay in renaming mode.
	await expect(page.getByTestId('list-rename-cancel')).toHaveCount(0);

	// The long press on the card: the same sheet, prefilled — and it does not follow the link.
	//
	// The app's own threshold is 500ms (`LONGPRESS_MS`, `$domain/longpress.ts`). 1500ms keeps the
	// gesture realistic while leaving three times the threshold as slack against CI scheduling delays.
	//
	// Scrolled into view first: the fixture household accumulates a list per past run of this and other
	// specs, and a card past the fold has real viewport coordinates that a stationary mouse never reaches
	// — mouse.down() at an off-screen point never fires the app's own pointerdown, so the long press never
	// starts, whatever margin the hold time is given.
	const link = corrected.getByRole('link').first();
	await link.scrollIntoViewIfNeeded();
	const box = await link.boundingBox();
	await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(1500);
	await page.mouse.up();

	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByTestId('list-name')).toHaveValue(renamed, { timeout: 10_000 });

	// Giving up leaves the list as it is.
	await page.getByTestId('list-rename-cancel').click();
	await expect(corrected).toBeVisible();
});
