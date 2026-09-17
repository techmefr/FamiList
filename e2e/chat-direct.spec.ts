import { test, expect, FIXTURE_EMAIL, FIXTURE_PASSWORD, SECOND_EMAIL, signIn, signOut } from './fixtures';

/**
 * A private message goes through no circle — but you have to have met somewhere to write to each other,
 * and the circle is what serves as the directory. The journey therefore goes through a shared household,
 * opens the conversation from one of the two accounts, and goes to read the message from the other.
 *
 * The household is left at the end, as in the invitation journey: both fixture accounts are shared by the
 * whole suite and must be given back as they were borrowed.
 */
test('écrire en privé à quelqu’un d’un cercle commun', async ({ signedInPage: page }) => {
	await page.goto('/household');
	await page.getByTestId('invite-create').click();

	const code = (await page.getByTestId('invite-code').innerText()).trim();
	expect(code).toMatch(/^[A-Z2-9]{6}$/);

	await signOut(page);
	await signIn(page, SECOND_EMAIL, FIXTURE_PASSWORD);

	await page.goto('/household');
	await page.getByTestId('join-code').fill(code);
	await page.getByTestId('join-submit').click();
	await expect(page.locator('[data-test-class="household-member"]')).toHaveCount(2, {
		timeout: 15_000
	});

	const body = `Entre nous ${Date.now()}`;

	await page.goto('/chat');
	await page.getByTestId('new-direct').click();
	await page.locator('[data-test-class="direct-candidate"]').first().click();
	await expect(page).toHaveURL(/\/chat\/d\//, { timeout: 15_000 });

	await page.getByTestId('direct-input').fill(body);

	/**
	 * The screen shows the message before the server knows it: sending goes through the write queue, and that
	 * is what makes the application usable with no network. Signing out in that interval cuts the request in
	 * flight — the message did leave on the screen side, never on the database side, and reading it back from
	 * the other account finds nothing.
	 *
	 * The promise is armed BEFORE the click: armed after, the response would already have gone by. So we wait
	 * for the real round trip, with its own time limit, rather than for a fixed delay that would be either
	 * too short on a slow machine or wasted time on every other.
	 */
	const saved = page.waitForResponse(
		(response) =>
			response.url().includes('/rest/v1/messages') &&
			response.request().method() === 'POST' &&
			response.ok(),
		{ timeout: 15_000 }
	);

	await page.getByTestId('direct-send').click();
	await expect(page.locator('[data-test-class="direct-message"]')).toContainText(body);
	await saved;

	// The other end of the conversation: the message must be there, and the entry must carry their name.
	await signOut(page);
	await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);

	await page.goto('/chat');
	const entry = page.locator('[data-test-class="direct-entry"]').filter({ hasText: body });
	await expect(entry).toBeVisible({ timeout: 15_000 });

	await entry.click();
	await expect(page.locator('[data-test-class="direct-message"]')).toContainText(body);

	// We give the accounts back as we found them: the second leaves the shared household.
	await signOut(page);
	await signIn(page, SECOND_EMAIL, FIXTURE_PASSWORD);
	await page.goto('/household');
	await page.getByTestId('household-leave').click();
	await expect(page.locator('[data-test-class="household-member"]')).toHaveCount(1, {
		timeout: 15_000
	});
});
