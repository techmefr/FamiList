import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * Hands-free cook-along (#309). The browser's recogniser is replaced by a fake one the test speaks
 * through, so what is checked is FamiList's side: the wake word, the commands, and what the screen says.
 */
type Mode = 'ok' | 'denied' | 'missing';

async function fakeRecognition(page: Page, mode: Mode) {
	await page.addInitScript((mode: Mode) => {
		localStorage.setItem('familist:locale', 'fr');
		const voice = { instances: [] as FakeRecognition[] };
		(window as unknown as { __voice: typeof voice }).__voice = voice;

		class FakeRecognition {
			onresult: ((event: unknown) => void) | null = null;
			onerror: ((event: { error: string }) => void) | null = null;
			onend: (() => void) | null = null;

			constructor() {
				voice.instances.push(this);
			}

			start() {
				if (mode !== 'denied') return;
				setTimeout(() => {
					this.onerror?.({ error: 'not-allowed' });
					this.onend?.();
				}, 0);
			}

			stop() {}
			abort() {}
		}

		const target = window as unknown as Record<string, unknown>;
		delete target.webkitSpeechRecognition;
		if (mode === 'missing') delete target.SpeechRecognition;
		else target.SpeechRecognition = FakeRecognition;

		(window as unknown as { __say: (text: string) => void }).__say = (text: string) => {
			const recognition = voice.instances.at(-1);
			const result = Object.assign([{ transcript: text }], { isFinal: true });
			recognition?.onresult?.({ resultIndex: 0, results: [result] });
		};
	}, mode);
}

const say = (page: Page, text: string) => page.evaluate((text) => (window as unknown as { __say: (t: string) => void }).__say(text), text);

async function openCookAlong(page: Page) {
	const name = `Voix e2e ${Date.now()}`;

	await page.goto('/recipes');
	await page.getByTestId('recipe-new').click();
	await page.getByTestId('recipe-name').fill(name);
	await page.getByTestId('recipe-next').click();
	await page.locator('[data-test-class="ingredient-name"]').first().fill('Oeufs');
	await page.getByTestId('recipe-next').click();

	const steps = page.locator('[data-test-class="recipe-step"]');
	await steps.first().fill('Battre les oeufs');
	await page.getByTestId('recipe-add-step').click();
	await steps.nth(1).fill('Cuire');
	await page.getByTestId('recipe-next').click();

	const card = page.locator('[data-test-class="recipe-card"]').filter({ hasText: name });
	await card.locator('[data-test-class="recipe-card-header"]').click();
	await card.locator('[data-test-class="recipe-cook-along"]').click();

	return page.getByTestId('cook-along');
}

test.describe('suivre la recette à la voix', () => {
	test('« Famy » puis une commande pilote la recette sans toucher l écran', async ({ signedInPage: page }) => {
		await fakeRecognition(page, 'ok');
		await page.reload();
		const cookAlong = await openCookAlong(page);
		const position = cookAlong.getByTestId('cook-along-position');
		const notice = cookAlong.getByTestId('cook-along-voice-notice');
		const heard = cookAlong.getByTestId('cook-along-voice-heard');

		await cookAlong.getByTestId('cook-along-voice-toggle').click();
		await expect(cookAlong.getByTestId('cook-along-voice-intro')).toBeVisible();
		await cookAlong.getByTestId('cook-along-voice-intro-accept').click();
		await expect(notice).toHaveAttribute('data-test-state', 'listening');
		await expect(cookAlong.getByTestId('cook-along-voice-toggle')).toHaveAttribute('aria-pressed', 'true');

		await say(page, 'Famy, étape suivante');
		await expect(position).toHaveText('Étape 2 sur 2');
		await expect(heard).toHaveText('Compris : Étape suivante');

		await say(page, 'passe-moi le sel');
		await expect(position).toHaveText('Étape 2 sur 2');

		await say(page, 'Fami');
		await expect(notice).toHaveAttribute('data-test-state', 'awake');
		await say(page, 'précédent');
		await expect(position).toHaveText('Étape 1 sur 2');

		await say(page, 'Famy, fais-moi un café');
		await expect(heard).toContainText('Pas compris');

		await say(page, 'Famy, lis tous les ingrédients');
		await expect(cookAlong.getByTestId('cook-along-ingredients')).toBeVisible();
		await page.keyboard.press('Escape');

		await say(page, 'Famy, aide');
		await expect(cookAlong.locator('[data-test-class="cook-along-voice-command"]')).toHaveCount(15);
		await cookAlong.getByTestId('cook-along-voice-help-close').click();

		await say(page, 'Famy, quitter');
		await expect(cookAlong).toBeHidden();
	});

	test('un micro refusé le dit et laisse les boutons marcher', async ({ signedInPage: page }) => {
		await fakeRecognition(page, 'denied');
		await page.reload();
		await page.evaluate(() => localStorage.setItem('familist:voice-intro-seen', '1'));
		const cookAlong = await openCookAlong(page);

		await cookAlong.getByTestId('cook-along-voice-toggle').click();
		await expect(cookAlong.getByTestId('cook-along-voice-notice')).toHaveAttribute('data-test-state', 'denied');
		await expect(cookAlong.getByTestId('cook-along-voice-toggle')).toHaveAttribute('aria-pressed', 'false');

		await cookAlong.getByTestId('cook-along-next').click();
		await expect(cookAlong.getByTestId('cook-along-position')).toHaveText('Étape 2 sur 2');
	});

	test('sans reconnaissance vocale, un message clair plutôt qu un bouton mort', async ({ signedInPage: page }) => {
		await fakeRecognition(page, 'missing');
		await page.reload();
		await page.evaluate(() => localStorage.setItem('familist:voice-intro-seen', '1'));
		const cookAlong = await openCookAlong(page);

		await cookAlong.getByTestId('cook-along-voice-toggle').click();
		await expect(cookAlong.getByTestId('cook-along-voice-notice')).toHaveAttribute('data-test-state', 'unsupported');
	});
});
