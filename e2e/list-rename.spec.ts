import { test, expect } from './fixtures';

/**
 * A list's name and emoji were frozen at creation: neither could be corrected, even though they are exactly
 * the two things set in a hurry while creating the list.
 *
 * The list carries a dated name, like the other list tests: it stays behind without ever making a selector
 * ambiguous on the next run.
 */
test('renommer une liste, au bouton comme à l appui long', async ({ signedInPage: page }) => {
	const nom = `Courses e2e ${Date.now()}`;
	const renomme = `${nom} corrigé`;

	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(nom);
	await page.getByTestId('list-create').click();

	const carte = page.locator('[data-test-class="list-card"]').filter({ hasText: nom });
	await expect(carte).toBeVisible();

	// The pencil: the path of the keyboard and the screen reader.
	await carte.locator('[data-test-class="list-rename"]').click();
	await expect(page.getByTestId('list-name')).toHaveValue(nom);

	await page.getByTestId('list-name').fill(renomme);
	await page.getByTestId('list-create').click();

	const corrigee = page.locator('[data-test-class="list-card"]').filter({ hasText: renomme });
	await expect(corrigee).toBeVisible();

	// The form closes again, and does not stay in renaming mode.
	await expect(page.getByTestId('list-rename-cancel')).toHaveCount(0);

	// The long press on the card: the same sheet, prefilled — and it does not follow the link.
	const lien = corrigee.getByRole('link').first();
	const boite = await lien.boundingBox();
	await page.mouse.move(boite!.x + boite!.width / 2, boite!.y + boite!.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(700);
	await page.mouse.up();

	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByTestId('list-name')).toHaveValue(renomme);

	// Giving up leaves the list as it is.
	await page.getByTestId('list-rename-cancel').click();
	await expect(corrigee).toBeVisible();
});
