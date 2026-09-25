import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * The "ask the AI" chat of "Create a recipe" (#313), with the provider mocked the way
 * `ai-recipe-request.spec.ts` does it: a fake Anthropic key, and `api.anthropic.com/v1/messages` answered in
 * Anthropic's own envelope. Each call gets the next reply of the list, and every request body is kept so
 * the test can read what left the device.
 */
interface SentMessage {
	role: string;
	content: string;
}

async function mockAnthropicSequence(page: Page, replies: unknown[]) {
	const sent: SentMessage[][] = [];

	await page.route('https://api.anthropic.com/v1/messages', async (route) => {
		const body = JSON.parse(route.request().postData() ?? '{}') as { messages: SentMessage[] };
		sent.push(body.messages);
		const reply = replies[Math.min(sent.length - 1, replies.length - 1)];

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ content: [{ text: JSON.stringify(reply) }] })
		});
	});

	return sent;
}

async function setFakeKey(page: Page) {
	await page.goto('/profile/ai');
	await expect(page.getByTestId('ai-state')).toBeVisible();

	const remove = page.getByTestId('ai-clear');
	if ((await remove.count()) > 0) await remove.click();
	await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'off');

	await page.getByTestId('ai-key').fill('cle-de-test-sans-valeur');
	await page.getByTestId('ai-save').click();
	await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'on');
}

async function clearKey(page: Page) {
	await page.goto('/profile/ai');
	await expect(page.getByTestId('ai-state')).toBeVisible();
	const remove = page.getByTestId('ai-clear');
	if ((await remove.count()) > 0) await remove.click();
	await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'off');
}

async function openChat(page: Page) {
	await page.goto('/recipes/new');
	await page.getByTestId('recipe-source-ai').click();
	await expect(page.getByTestId('ai-request-input')).toBeVisible();
}

async function say(page: Page, text: string) {
	await page.getByTestId('ai-request-input').fill(text);
	await page.getByTestId('ai-request-submit').click();
}

test.describe('discussion avec l IA pour creer une recette', () => {
	test.beforeEach(async ({ signedInPage: page }) => {
		await setFakeKey(page);
	});

	test.afterEach(async ({ signedInPage: page }) => {
		await clearKey(page);
	});

	test('une question, puis la recette, dont le titre est choisi par l IA et non la demande', async ({
		signedInPage: page
	}) => {
		const request = `quelque chose de rapide avec des restes de poulet ${Date.now()}`;
		const recipe = {
			name: `Poulet sauté minute e2e ${Date.now()}`,
			emoji: '🍗',
			servings: 2,
			ingredients: [
				{ name: 'Poulet cuit', qty: '300', unit: 'g' },
				{ name: 'Oignon', qty: '1', unit: 'piece' }
			],
			steps: ['Émincer l oignon.', 'Faire sauter le poulet 5 minutes.'],
			stepIngredients: [[1], [0]],
			stepMinutes: [0, 5],
			imagePrompt: 'Golden sautéed chicken pieces with onions in a cast iron pan',
			tags: ['main']
		};
		const sent = await mockAnthropicSequence(page, [{ question: 'Pour combien de personnes ?' }, recipe]);

		await openChat(page);
		await say(page, request);

		const question = page.locator('[data-test-class="ai-chat-question"]');
		await expect(question).toContainText('Pour combien de personnes ?', { timeout: 15_000 });
		await expect(page.getByTestId('ai-chat-thread')).toHaveAttribute('role', 'log');
		await expect(page.getByTestId('ai-chat-status')).toHaveAttribute('role', 'status');

		await say(page, 'deux');
		await expect(page.getByTestId('ai-proposal')).toContainText(recipe.name, { timeout: 15_000 });

		// What left: the whole thread every time, with the title rule, and the question sent back as asked.
		expect(sent).toHaveLength(2);
		expect(sent[0][0].content).toContain(request);
		expect(sent[0][0].content).toContain("Never copy or rephrase the person's message as the title.");
		expect(sent[1].map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
		expect(sent[1][1].content).toContain('Pour combien de personnes ?');
		expect(sent[1][2].content).toContain('deux');

		// Kept, it opens the form without saving: the title is the AI's, never the request (#313).
		await page.getByTestId('ai-proposal-accept').click();
		await expect(page).toHaveURL(/\/recipes$/);
		await expect(page.getByTestId('recipe-import-review')).toBeVisible();
		await expect(page.getByTestId('recipe-name')).toHaveValue(recipe.name);
		await expect(page.getByTestId('recipe-name')).not.toHaveValue(request);
	});

	test('les contraintes d un invite partent sans son nom et un ingredient interdit est signale', async ({
		signedInPage: page
	}) => {
		const guest = `Marie e2e ${Date.now()}`;
		const withCauliflower = {
			name: `Gratin de chou-fleur e2e ${Date.now()}`,
			emoji: '🥘',
			servings: 4,
			ingredients: [
				{ name: 'Chou-fleur', qty: '1', unit: 'piece' },
				{ name: 'Crème', qty: '20', unit: 'cl' }
			],
			steps: ['Cuire le chou-fleur.', 'Gratiner 20 minutes.'],
			tags: ['main']
		};
		const withoutCauliflower = {
			...withCauliflower,
			name: `Gratin de poireaux e2e ${Date.now()}`,
			ingredients: [
				{ name: 'Poireaux', qty: '4', unit: 'piece' },
				{ name: 'Crème', qty: '20', unit: 'cl' }
			],
			steps: ['Cuire les poireaux.', 'Gratiner 20 minutes.']
		};
		const sent = await mockAnthropicSequence(page, [withCauliflower, withoutCauliflower]);

		await openChat(page);
		await page.getByTestId('ai-chat-add-guest').click();
		await page.getByTestId('ai-chat-guest-name').fill(guest);
		await page.getByTestId('ai-chat-guest-notes').fill('allergique au chou-fleur');
		await page.getByTestId('ai-chat-guest-save').click();

		await expect(page.locator('[data-test-class="ai-chat-guest"]')).toContainText(guest);
		await expect(page.locator('[data-test-class="ai-chat-constraint"]').filter({ hasText: guest })).toContainText(
			'allergique au chou-fleur'
		);

		await say(page, 'un gratin pour ce soir');
		const first = page.getByTestId('ai-proposal').first();
		await expect(first).toContainText(withCauliflower.name, { timeout: 15_000 });

		expect(sent[0][0].content).toContain('allergique au chou-fleur');
		expect(sent[0][0].content).not.toContain(guest);

		await expect(first.getByTestId('ai-proposal-conflicts')).toContainText('Chou-fleur');
		await first.getByTestId('ai-proposal-avoid').click();

		const last = page.getByTestId('ai-proposal').last();
		await expect(last).toContainText(withoutCauliflower.name, { timeout: 15_000 });
		await expect(last).not.toContainText('Chou-fleur');
		await expect(last.getByTestId('ai-proposal-conflicts')).toHaveCount(0);

		expect(sent).toHaveLength(2);
		expect(sent[1].at(-1)?.content).toContain('Chou-fleur');
		expect(sent[1].at(-1)?.content).toContain('allergique au chou-fleur');
	});

	test('le bouton de la discussion d une liste ouvre la discussion avec l IA', async ({ signedInPage: page }) => {
		const listName = `Discussion IA e2e ${Date.now()}`;

		await page.goto('/');
		await page.getByTestId('nav-create').click();
		await page.getByTestId('create-list').click();
		await page.getByTestId('list-name').fill(listName);
		await page.getByTestId('list-create').click();

		const card = page.locator('[data-test-class="list-card"]').filter({ hasText: listName });
		await card.getByRole('link').first().click();
		await page.getByTestId('open-chat').click();
		await expect(page).toHaveURL(/\/l\/[^/]+\/chat$/);

		await page.getByTestId('ai-request-open').click();
		await expect(page).toHaveURL(/\/recipes\/new$/);
		await expect(page.getByTestId('ai-request-input')).toBeVisible();
	});
});
