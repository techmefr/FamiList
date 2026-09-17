import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * An item was not editable at all after creation — and the note, shown under its name, had no screen to
 * write it on.
 *
 * The list carries a dated name, like the other list tests: it stays behind, without ever making a selector
 * ambiguous on the next run.
 */
async function nouvelleListe(page: Page, nom: string) {
	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(nom);
	await page.getByTestId('list-create').click();

	const carte = page.locator('[data-test-class="list-card"]').filter({ hasText: nom });
	await expect(carte).toBeVisible();
	await carte.getByRole('link').first().click();
	await expect(page).toHaveURL(/\/l\//);
}

test('modifier un article, au bouton comme à l appui long', async ({ signedInPage: page }) => {
	const nom = `Courses e2e ${Date.now()}`;
	await nouvelleListe(page, nom);

	await page.getByTestId('empty-add-item').click();
	await page.getByTestId('add-name').fill('Pommes');
	await page.getByTestId('add-submit').click();

	const ligne = page.locator('[data-test-class="item-row"]').filter({ hasText: 'Pommes' });
	await expect(ligne).toBeVisible();

	// The pencil button: the announced path, that of the keyboard and the screen reader.
	await ligne.locator('[data-test-class="item-edit"]').click();
	await expect(page.getByTestId('add-name')).toHaveValue('Pommes');

	await page.getByTestId('add-name').fill('Poires');
	await page.getByTestId('add-qty').fill('3');
	await page.getByTestId('add-note').fill('les bien mûres');
	await page.getByTestId('add-submit').click();

	const modifiee = page.locator('[data-test-class="item-row"]').filter({ hasText: 'Poires' });
	await expect(modifiee).toContainText('les bien mûres');
	await expect(modifiee).toContainText('3');

	// The long press, the thumb's gesture: the same sheet, prefilled.
	const etiquette = modifiee.locator('label').first();
	const boite = await etiquette.boundingBox();
	await page.mouse.move(boite!.x + boite!.width / 2, boite!.y + boite!.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(700);
	await page.mouse.up();

	await expect(page.getByTestId('add-name')).toHaveValue('Poires');
	await expect(page.getByTestId('add-note')).toHaveValue('les bien mûres');

	// Releasing the finger must not tick the item whose sheet has just been opened.
	await page.getByTestId('add-close').click();
	await expect(modifiee.locator('[data-test-class="item-check"]')).not.toBeChecked();

	await modifiee.locator('[data-test-class="item-remove"]').click();
	await expect(modifiee).toHaveCount(0);

});
