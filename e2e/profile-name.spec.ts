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
	await page.goto('/profile/account');

	// The fields are only filled once the account is identified: reading their content before would give an
	// empty string, and the end-of-test restore would write an empty name.
	const field = page.getByTestId('name-input');
	await expect(field).toBeEnabled({ timeout: 15_000 });
	const originalValue = await field.inputValue();
	expect(originalValue).not.toBe('');

	const originalFirstName = await page.getByTestId('first-name-input').inputValue();
	const originalName = await page.getByTestId('last-name-input').inputValue();

	// The name aimed at is the one the account does not already carry: an interrupted previous run may have
	// left the first in place, and renaming to the current name would change nothing.
	const first = originalFirstName === 'Amandine' ? 'Basile' : 'Amandine';
	const last = first === 'Amandine' ? 'Ferrand' : 'Nguyen';
	const initials = first === 'Amandine' ? 'AF' : 'BN';

	// A display name already set is a choice: typing the first name does not overwrite it.
	await page.getByTestId('first-name-input').fill(first);
	await expect(field).toHaveValue(originalValue);

	// Cleared, it becomes a draft again and follows "First Last" — that is the common case, we do not make
	// people type the same thing three times.
	await field.fill('');
	await page.getByTestId('last-name-input').fill(last);
	await expect(field).toHaveValue(`${first} ${last}`);

	// Finally we put a one-word nickname in it: that is the case where reading the display name would give
	// only one letter, while the profile knows a first and a last name.
	const nickname = first === 'Amandine' ? 'Mamie' : 'Papi';
	await field.fill(nickname);
	await page.getByTestId('first-name-input').fill(first);
	await expect(field).toHaveValue(nickname);

	await page.getByTestId('name-save').click();

	// Two letters, those of the first and last name — not the single letter of the nickname, nor the one
	// stored in the database.
	const avatar = page.locator('[data-test-class="avatar"]').first();
	await expect(avatar).toHaveText(initials, { timeout: 15_000 });

	// The save marker says the write left and came back: reloading before would cut the request in flight,
	// and the page would come back to the old name.
	await expect(page.getByTestId('name-saved')).toBeVisible({ timeout: 15_000 });

	await page.reload();
	await expect(page.getByTestId('name-input')).toHaveValue(nickname, { timeout: 15_000 });
	await expect(page.getByTestId('first-name-input')).toHaveValue(first);
	await expect(page.getByTestId('last-name-input')).toHaveValue(last);

	const back = page.getByTestId('name-input');
	await expect(back).toBeEnabled({ timeout: 15_000 });
	await page.getByTestId('first-name-input').fill(originalFirstName);
	await page.getByTestId('last-name-input').fill(originalName);
	await back.fill(originalValue);
	await page.getByTestId('name-save').click();
	await expect(page.getByTestId('name-saved')).toBeVisible({ timeout: 15_000 });
	await expect(back).toHaveValue(originalValue);
});
