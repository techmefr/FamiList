import {
	test,
	expect,
	FIXTURE_EMAIL,
	FIXTURE_PASSWORD,
	SECOND_EMAIL,
	signIn,
	signOut
} from './fixtures';

test('un code inconnu est refusé en toutes lettres, pas en jargon de base', async ({
	signedInPage: page
}) => {
	await page.goto('/household');
	await page.getByTestId('join-code').fill('ZZZZZZ');
	await page.getByTestId('join-submit').click();

	const refusal = page.getByTestId('household-error');
	await expect(refusal).toBeVisible();

	// The database message — "code invalide ou expire", without accents and never translated — no longer
	// reaches the screen.
	await expect(refusal).toContainText(/invalid or has expired/i);
	await expect(refusal).not.toContainText('code invalide ou expire');

	// This refusal has no "enter my code" way out: it is not about the second factor.
	await expect(page.getByTestId('household-second-factor')).toHaveCount(0);
});

/**
 * The journey that was missing: create a code in a household, use it from another account, end up together.
 * It failed for everybody — the household created at sign-up receives a default shop on first opening, and
 * its presence alone was enough to get the invitation refused, with no way out at all.
 *
 * The test cleans up after itself: the second account leaves the household at the end, otherwise a second
 * run on the same database would start from a state where both accounts are already together.
 */
test('rejoindre un foyer avec un code, puis le quitter', async ({ signedInPage: page }) => {
	await page.goto('/household');
	await page.getByTestId('invite-create').click();

	const code = await page.getByTestId('invite-code').innerText();
	expect(code).toMatch(/^[A-Z2-9]{6}$/);

	await signOut(page);
	await signIn(page, SECOND_EMAIL, FIXTURE_PASSWORD);

	await page.goto('/household');
	await page.getByTestId('join-code').fill(code);
	await page.getByTestId('join-submit').click();

	// Two people in the household, and above all no "quittez d abord votre foyer actuel".
	await expect(page.getByTestId('household-error')).toHaveCount(0);
	await expect(page.locator('[data-test-class="household-member"]')).toHaveCount(2, {
		timeout: 15_000
	});

	await page.getByTestId('household-leave').click();
	await expect(page.locator('[data-test-class="household-member"]')).toHaveCount(1, {
		timeout: 15_000
	});

	// The main account ends up alone, as before the test.
	await signOut(page);
	await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);
	await page.goto('/household');
	await expect(page.locator('[data-test-class="household-member"]')).toHaveCount(1, {
		timeout: 15_000
	});
});
