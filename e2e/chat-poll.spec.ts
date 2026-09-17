import { test, expect } from './fixtures';

const listName = () => `Repas ${Date.now()}`;

async function createList(page: import('@playwright/test').Page, name: string) {
	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(name);
	await page.getByTestId('list-create').click();

	await page.getByTestId('nav-/chat').click();
	await page.locator('[data-test-class="chat-entry"]').filter({ hasText: name }).click();
	await expect(page.getByTestId('chat-input')).toBeVisible();
}

/**
 * We knew how to reach the conversation; we did not know you could speak in it. This test follows the
 * message end to end: written, sent, shown, and still there after a reload — it is the reload that tells a
 * message that left for the database from one that stayed on the screen.
 */
test('écrire un message dans la conversation d’une liste', async ({ signedInPage: page }) => {
	const name = listName();
	await createList(page, name);

	const text = `On se retrouve samedi ${Date.now()}`;
	await page.getByTestId('chat-input').fill(text);
	await page.getByTestId('chat-send').click();

	await expect(page.locator('[data-test-class="chat-message"]').filter({ hasText: text })).toBeVisible({
		timeout: 15_000
	});

	// Empty after sending: otherwise the next message leaves with the previous one stuck in front of it.
	await expect(page.getByTestId('chat-input')).toHaveValue('');

	await page.reload();
	await expect(page.locator('[data-test-class="chat-message"]').filter({ hasText: text })).toBeVisible({
		timeout: 15_000
	});
});

/**
 * The date poll, through to its conclusion. Voting is not enough: what counts is that the majority choice
 * becomes the list's date, visible at the top of the screen, because that is the only trace surviving the
 * conversation.
 */
test('proposer des dates, voter, et fixer la date retenue', async ({ signedInPage: page }) => {
	const name = listName();
	await createList(page, name);

	await page.getByTestId('new-poll-date').click();
	await page.getByTestId('poll-question').fill('Quel soir ?');
	await page.getByTestId('poll-choices').fill('Vendredi\nSamedi');
	await page.getByTestId('poll-create').click();

	const poll = page.locator('[data-test-class="poll-card"]').last();
	await expect(poll).toBeVisible({ timeout: 15_000 });

	const choices = poll.locator('[data-test-class="poll-vote"]');
	await expect(choices).toHaveCount(2);

	await choices.filter({ hasText: 'Samedi' }).click();
	await expect(choices.filter({ hasText: 'Samedi' })).toHaveAttribute('aria-pressed', 'true', {
		timeout: 15_000
	});

	// The button only appears once a choice is leading: with no vote, there is nothing to keep.
	const setDate = poll.locator('[data-test-class="poll-set-date"]');
	await expect(setDate).toBeVisible({ timeout: 15_000 });
	await expect(setDate).toContainText('Samedi');
	await setDate.click();

	await expect(page.getByTestId('event-date')).toContainText('Samedi', { timeout: 15_000 });
});

/**
 * A poll with no choices is not a poll. The refusal must show on the spot, without closing the form: closed,
 * it would take the question already typed with it.
 */
test('un sondage sans choix est refusé sans fermer le formulaire', async ({
	signedInPage: page
}) => {
	const name = listName();
	await createList(page, name);

	await page.getByTestId('new-poll-date').click();
	await page.getByTestId('poll-question').fill('Quel soir ?');
	await page.getByTestId('poll-choices').fill('   \n  ');
	await page.getByTestId('poll-create').click();

	await expect(page.getByTestId('poll-error')).toBeVisible();
	await expect(page.getByTestId('poll-form')).toBeVisible();
	await expect(page.getByTestId('poll-question')).toHaveValue('Quel soir ?');
	await expect(page.locator('[data-test-class="poll-card"]')).toHaveCount(0);
});
