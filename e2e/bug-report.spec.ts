import { test, expect } from './fixtures';

/**
 * A report asks for a capture of what is wrong. While it replaced the screen with a page, it was therefore
 * asking to photograph something no longer displayed. These tests check the opposite: the panel opens over
 * it, shrinks without losing anything, and the screen stays there behind.
 */
test("le signalement s'ouvre par-dessus l'écran, sans le quitter", async ({
	signedInPage: page
}) => {
	await page.goto('/shops');
	const before = page.url();

	await page.getByTestId('help').click();
	await page.getByTestId('help-menu-bug').click();

	await expect(page.getByTestId('report-panel')).toBeVisible();
	expect(page.url()).toBe(before);

	// What we want to show is still on screen: that is the whole point of the panel.
	await expect(page.getByTestId('add-aisle')).toBeVisible();

	await page.getByTestId('bug-description').fill('Le bouton ajouter un rayon ne répond pas.');
	await page.getByTestId('bug-submit').click();

	await expect(page.getByTestId('bug-success')).toBeVisible();
});

test('réduire le panneau rend l’écran, et ne perd pas ce qui est écrit', async ({
	signedInPage: page
}) => {
	await page.goto('/shops');

	await page.getByTestId('help').click();
	await page.getByTestId('help-menu-bug').click();

	const text = 'La liste se vide quand je coche le dernier article.';
	await page.getByTestId('bug-description').fill(text);

	await page.getByTestId('report-minimize').click();

	// Shrunk: the form is no longer shown — that is when you take your capture — but the panel stays there to
	// say a report is in progress.
	await expect(page.getByTestId('bug-description')).toBeHidden();
	await expect(page.getByTestId('report-minimized-hint')).toBeVisible();

	await page.getByTestId('report-restore').click();

	// Reopening comes back exactly to the state left: it is the property that tells "shrink" from "close",
	// and the only one that makes the gesture usable.
	await expect(page.getByTestId('bug-description')).toHaveValue(text);
});

test('le brouillon survit à un changement d’écran', async ({ signedInPage: page }) => {
	await page.goto('/shops');

	await page.getByTestId('help').click();
	await page.getByTestId('help-menu-suggestion').click();

	const text = 'Pouvoir trier les magasins par distance.';
	await page.getByTestId('bug-description').fill(text);
	await page.getByTestId('report-minimize').click();

	// We are going to reproduce the problem elsewhere, then resume: the panel lives outside the pages.
	await page.getByTestId('nav-/cards').click();
	await expect(page.getByTestId('report-panel')).toBeVisible();

	await page.getByTestId('report-restore').click();
	await expect(page.getByTestId('bug-description')).toHaveValue(text);

	// Closing is the only gesture that throws away: without it the draft would follow the whole session.
	await page.getByTestId('report-close').click();
	await expect(page.getByTestId('report-panel')).toBeHidden();
});

test('le formulaire refuse un envoi sans description', async ({ signedInPage: page }) => {
	await page.goto('/report?kind=bug');

	await expect(page.getByTestId('bug-description')).toHaveAttribute('required', '');
});
