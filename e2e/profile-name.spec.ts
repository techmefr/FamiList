import { test, expect } from './fixtures';

/**
 * The name was set at sign-up and never moved again: a typo stayed on display for the whole household. The
 * initials, for their part, came from a column filled by a trigger with a single letter — two reasons to
 * check both together.
 *
 * The profile now carries three fields, and it is the first and last name that make the initials: the
 * display name can be a nickname. The test checks this by setting precisely a one-word nickname, the case
 * where reading the display name would give a single letter.
 *
 * The test cleans up behind itself: it gives the account its original name back, otherwise a second run
 * would start from an already changed name.
 */
test('changer son nom, et voir les initiales suivre', async ({ signedInPage: page }) => {
	await page.goto('/profile');

	// The fields are only filled once the account is identified: reading their content before would give an
	// empty string, and the end-of-test restore would write an empty name.
	const champ = page.getByTestId('name-input');
	await expect(champ).toBeEnabled({ timeout: 15_000 });
	const origine = await champ.inputValue();
	expect(origine).not.toBe('');

	const prenomOrigine = await page.getByTestId('first-name-input').inputValue();
	const nomOrigine = await page.getByTestId('last-name-input').inputValue();

	// The name aimed at is the one the account does not already carry: an interrupted previous run may have
	// left the first in place, and renaming to the current name would change nothing.
	const premier = prenomOrigine === 'Amandine' ? 'Basile' : 'Amandine';
	const dernier = premier === 'Amandine' ? 'Ferrand' : 'Nguyen';
	const initiales = premier === 'Amandine' ? 'AF' : 'BN';

	// A display name already set is a choice: typing the first name does not overwrite it.
	await page.getByTestId('first-name-input').fill(premier);
	await expect(champ).toHaveValue(origine);

	// Cleared, it becomes a draft again and follows "First Last" — that is the common case, we do not make
	// people type the same thing three times.
	await champ.fill('');
	await page.getByTestId('last-name-input').fill(dernier);
	await expect(champ).toHaveValue(`${premier} ${dernier}`);

	// Finally we put a one-word nickname in it: that is the case where reading the display name would give
	// only one letter, while the profile knows a first and a last name.
	const surnom = premier === 'Amandine' ? 'Mamie' : 'Papi';
	await champ.fill(surnom);
	await page.getByTestId('first-name-input').fill(premier);
	await expect(champ).toHaveValue(surnom);

	await page.getByTestId('name-save').click();

	// Two letters, those of the first and last name — not the single letter of the nickname, nor the one
	// stored in the database.
	const pastille = page.locator('[data-test-class="avatar"]').first();
	await expect(pastille).toHaveText(initiales, { timeout: 15_000 });

	// The save marker says the write left and came back: reloading before would cut the request in flight,
	// and the page would come back to the old name.
	await expect(page.getByTestId('name-saved')).toBeVisible({ timeout: 15_000 });

	await page.reload();
	await expect(page.getByTestId('name-input')).toHaveValue(surnom, { timeout: 15_000 });
	await expect(page.getByTestId('first-name-input')).toHaveValue(premier);
	await expect(page.getByTestId('last-name-input')).toHaveValue(dernier);

	const retour = page.getByTestId('name-input');
	await expect(retour).toBeEnabled({ timeout: 15_000 });
	await page.getByTestId('first-name-input').fill(prenomOrigine);
	await page.getByTestId('last-name-input').fill(nomOrigine);
	await retour.fill(origine);
	await page.getByTestId('name-save').click();
	await expect(page.getByTestId('name-saved')).toBeVisible({ timeout: 15_000 });
	await expect(retour).toHaveValue(origine);
});
