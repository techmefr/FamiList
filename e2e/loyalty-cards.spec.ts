import type { Page } from '@playwright/test';
import {
	test,
	expect,
	FIXTURE_EMAIL,
	FIXTURE_PASSWORD,
	SECOND_EMAIL,
	signIn,
	signOut
} from './fixtures';
import { enableSecondStep, signBackInAndRemoveSecondStep } from './totp';

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY =
	process.env.E2E_SUPABASE_ANON_KEY ??
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

interface NewCard {
	name: string;
	code: string;
	type?: string;
	secret?: string;
	website?: string;
}

const cardEntry = (page: Page, name: string) =>
	page.locator('[data-test-class="card-open"]').filter({ hasText: name });

const cardSaved = (page: Page) =>
	page.waitForResponse(
		(response) =>
			response.url().includes('/rest/v1/loyalty_cards') &&
			response.request().method() !== 'GET' &&
			response.ok(),
		{ timeout: 15_000 }
	);

async function createCard(page: Page, card: NewCard) {
	await page.goto('/cards');
	await page.getByTestId('card-add').click();
	await page.getByTestId('card-name').fill(card.name);
	await page.getByTestId('card-code').fill(card.code);
	if (card.type) await page.getByTestId('card-type').selectOption(card.type);
	if (card.secret) await page.getByTestId('card-secret-code').fill(card.secret);
	if (card.website) await page.getByTestId('card-website').fill(card.website);

	const saved = cardSaved(page);
	await page.getByTestId('card-submit').click();
	await expect(cardEntry(page, card.name)).toBeVisible();
	await saved;
}

async function openCard(page: Page, name: string) {
	await cardEntry(page, name).click();
	await expect(page.getByTestId('card-fullscreen')).toBeVisible();
}

async function openAccountPage(page: Page, name: string): Promise<string> {
	await page.goto('/cards');
	await openCard(page, name);
	await page.getByTestId('card-tab-account').click();
	await page.getByTestId('card-account-open').click();
	await expect(page).toHaveURL(/\/cards\/[0-9a-f-]+\/account/);
	return page.url().split('/cards/')[1].split('/')[0];
}

test('une carte montre son code tout de suite et masque le code secret', async ({
	signedInPage: page
}) => {
	const stamp = Date.now();
	const withSecret = `Avec code e2e ${stamp}`;
	const withoutSecret = `Vide e2e ${stamp}`;

	await createCard(page, { name: withSecret, code: '4006381333931', secret: '4821' });
	await createCard(page, { name: withoutSecret, code: 'ABC123' });

	await openCard(page, withSecret);
	await expect(page.getByTestId('card-tab-card')).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByTestId('code-barcode')).toBeVisible();
	await expect(page.getByTestId('card-code-value')).toHaveText('4006381333931');
	await expect(page.getByTestId('card-detail-notes')).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByTestId('card-notes-text')).toBeVisible();

	await page.getByTestId('card-detail-codes').click();
	await expect(page.getByTestId('card-secret-code-value')).toHaveCount(0);
	await expect(page.getByTestId('card-codes')).not.toContainText('4821');

	await page.getByTestId('card-code-reveal').click();
	await expect(page.getByTestId('card-secret-code-value')).toHaveText('4821');

	await page.getByTestId('card-code-hide').click();
	await expect(page.getByTestId('card-secret-code-value')).toHaveCount(0);
	await expect(page.getByTestId('card-code-reveal')).toBeVisible();

	await page.getByTestId('card-close').click();
	await openCard(page, withoutSecret);
	await page.getByTestId('card-detail-codes').click();
	await expect(page.getByTestId('card-secret-code-empty')).toBeVisible();
	await expect(page.getByTestId('card-code-reveal')).toHaveCount(0);
});

test('la note d une carte s enregistre et survit au rechargement', async ({
	signedInPage: page
}) => {
	const name = `Notes e2e ${Date.now()}`;
	const note = `Seuil à 500 points ${Date.now()}`;

	await createCard(page, { name, code: 'NOTES42' });
	await openCard(page, name);

	await page.getByTestId('card-notes-toggle').click();
	await page.getByTestId('card-notes').fill(note);

	const saved = cardSaved(page);
	await page.getByTestId('card-notes-toggle').click();
	await expect(page.getByTestId('card-notes-text')).toHaveText(note);
	await saved;

	await page.reload();
	await openCard(page, name);
	await expect(page.getByTestId('card-notes-text')).toHaveText(note);
});

test('le lien vers le site de la marque ne sort que pour une adresse http ou https', async ({
	signedInPage: page
}) => {
	const stamp = Date.now();
	const withSite = `Lien e2e ${stamp}`;
	const withoutSite = `Nu e2e ${stamp}`;

	await page.goto('/cards');
	await page.getByTestId('card-add').click();
	await page.getByTestId('card-website').fill('javascript:alert(1)');
	await expect(page.getByTestId('card-website-error')).toBeVisible();
	await page.getByTestId('card-website').fill('');
	await expect(page.getByTestId('card-website-error')).toHaveCount(0);

	await createCard(page, { name: withSite, code: 'SITE42', website: 'https://www.example.com/fidelite' });
	await createCard(page, { name: withoutSite, code: 'NOSITE42' });

	await openCard(page, withSite);
	await page.getByTestId('card-tab-account').click();
	const link = page.getByTestId('card-website-open');
	await expect(link).toHaveAttribute('href', 'https://www.example.com/fidelite');
	await expect(link).toHaveAttribute('target', '_blank');
	await expect(link).toHaveAttribute('rel', /noopener/);

	await page.getByTestId('card-close').click();
	await openCard(page, withoutSite);
	await page.getByTestId('card-tab-account').click();
	await expect(page.getByTestId('card-account')).toBeVisible();
	await expect(page.getByTestId('card-website-open')).toHaveCount(0);
});

test.describe('compte de la carte', () => {
	let secret: string | null = null;

	test.afterEach(async ({ page }) => {
		if (!secret) return;
		const current = secret;
		secret = null;
		await signBackInAndRemoveSecondStep(page, current);
	});

	test('le mot de passe exige l aal2, se relit après rechargement et hors ligne', async ({
		signedInPage: page
	}) => {
		test.setTimeout(120_000);

		const name = `Compte e2e ${Date.now()}`;
		const accountEmail = `fidelite-${Date.now()}@example.com`;
		const password = `Mdp-${Date.now()}`;
		const unlock = '246813';

		await createCard(page, { name, code: 'ACCOUNT42' });
		const cardId = await openAccountPage(page, name);
		await expect(page.getByTestId('card-account-needs-mfa')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId('card-account-form')).toHaveCount(0);

		secret = await enableSecondStep(page);

		await page.goto(`/cards/${cardId}/account`);
		await page.getByTestId('card-account-email-input').fill(accountEmail);
		await page.getByTestId('card-account-password-input').fill(password);
		await page.getByTestId('card-account-save').click();
		await expect(page.getByTestId('card-account-notice')).toBeVisible({ timeout: 15_000 });

		await page.reload();
		await expect(page.getByTestId('card-account-email')).toHaveText(accountEmail, { timeout: 15_000 });
		await page.getByTestId('card-account-reveal').click();
		await expect(page.getByTestId('card-account-password')).toHaveText(password);

		const signedIn = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
			method: 'POST',
			headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: FIXTURE_EMAIL, password: FIXTURE_PASSWORD })
		});
		const { access_token: aal1Token } = (await signedIn.json()) as { access_token: string };
		const refused = await fetch(`${SUPABASE_URL}/rest/v1/rpc/read_loyalty_card_password`, {
			method: 'POST',
			headers: {
				apikey: SUPABASE_ANON_KEY,
				Authorization: `Bearer ${aal1Token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ card: cardId })
		});
		expect(refused.ok).toBe(false);
		expect(await refused.text()).not.toContain(password);

		await page.getByTestId('card-unlock-code').fill(unlock);
		await page.getByTestId('card-offline-enable').click();
		await expect(page.getByTestId('card-offline-setup')).toHaveCount(0, { timeout: 30_000 });
		await page.getByTestId('card-account-hide').click();

		await page.context().setOffline(true);
		await expect(page.getByTestId('card-account-offline')).toBeVisible();
		await expect(page.getByTestId('card-account-password')).toHaveCount(0);

		const code = page.getByTestId('card-offline-code');
		await code.fill(unlock);
		await page.getByTestId('card-offline-unlock').click();
		await expect(page.getByTestId('card-account-password')).toHaveText(password, { timeout: 30_000 });
		await page.getByTestId('card-account-hide').click();

		for (let attempt = 1; attempt <= 5; attempt++) {
			await code.fill(`faux-${attempt}00`);
			await page.getByTestId('card-offline-unlock').click();
			if (attempt < 5) await expect(code).toHaveValue('', { timeout: 30_000 });
		}

		await expect(page.getByTestId('card-offline-missing')).toBeVisible({ timeout: 30_000 });
		await expect(page.getByTestId('card-offline-code')).toHaveCount(0);
		await expect(page.getByTestId('card-account-password')).toHaveCount(0);

		await page.context().setOffline(false);
	});
});

async function showCircleWith(page: Page, name: string) {
	await page.goto('/cards');
	await expect(page.getByTestId('card-add')).toBeVisible({ timeout: 15_000 });
	if (await cardEntry(page, name).isVisible()) return;

	await page.goto('/household');
	await page.locator('[data-test-class="circle-option"]:not([aria-current])').first().click();
	await page.goto('/cards');
	await expect(cardEntry(page, name)).toBeVisible({ timeout: 15_000 });
}

test('partager une carte avec un autre cercle, puis retirer le partage', async ({
	signedInPage: page
}) => {
	test.setTimeout(120_000);

	const name = `Partage e2e ${Date.now()}`;
	await createCard(page, { name, code: 'SHARE42' });

	await signOut(page);
	await signIn(page, SECOND_EMAIL, FIXTURE_PASSWORD);
	await page.goto('/household');
	await page.getByTestId('invite-create').click();
	const invite = (await page.getByTestId('invite-code').innerText()).trim();

	await signOut(page);
	await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);
	await page.goto('/household');
	await page.getByTestId('join-code').fill(invite);
	await page.getByTestId('join-submit').click();
	await expect(page.locator('[data-test-class="household-member"]')).toHaveCount(2, {
		timeout: 15_000
	});

	await showCircleWith(page, name);
	await openCard(page, name);
	await page.getByTestId('card-share').click();
	await expect(page.getByTestId('card-share-sheet')).toBeVisible();
	await page.locator('[data-test-class="card-share-request"]').first().click();
	await expect(page.locator('[data-test-class="card-share-withdraw"]')).toBeVisible({
		timeout: 15_000
	});

	await signOut(page);
	await signIn(page, SECOND_EMAIL, FIXTURE_PASSWORD);
	await page.goto('/cards');
	const request = page.locator('[data-test-class="card-share-request-item"]').filter({ hasText: name });
	await expect(request).toBeVisible({ timeout: 15_000 });
	await request.locator('[data-test-class="card-share-accept"]').click();
	await expect(cardEntry(page, name)).toBeVisible({ timeout: 15_000 });

	await page.reload();
	await openCard(page, name);
	await expect(page.getByTestId('card-code-value')).toHaveText('SHARE42');
	await expect(page.getByTestId('card-share')).toHaveCount(0);
	await expect(page.getByTestId('card-edit')).toHaveCount(0);
	await expect(page.getByTestId('card-notes-toggle')).toHaveCount(0);

	await signOut(page);
	await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);
	await showCircleWith(page, name);
	await openCard(page, name);
	await page.getByTestId('card-share').click();
	await page.locator('[data-test-class="card-share-withdraw"]').first().click();
	await expect(page.locator('[data-test-class="card-share-request"]')).toBeVisible({
		timeout: 15_000
	});

	await signOut(page);
	await signIn(page, SECOND_EMAIL, FIXTURE_PASSWORD);
	await page.goto('/cards');
	await expect(page.getByTestId('card-add')).toBeVisible({ timeout: 15_000 });
	await expect(cardEntry(page, name)).toHaveCount(0);
	await page.reload();
	await expect(page.getByTestId('card-add')).toBeVisible({ timeout: 15_000 });
	await expect(cardEntry(page, name)).toHaveCount(0);

	await signOut(page);
	await signIn(page, FIXTURE_EMAIL, FIXTURE_PASSWORD);
	await page.goto('/household');
	const members = page.locator('[data-test-class="household-member"]');
	await expect(members.first()).toBeVisible({ timeout: 15_000 });
	if ((await members.count()) < 2) {
		await page.locator('[data-test-class="circle-option"]:not([aria-current])').first().click();
		await expect(members).toHaveCount(2, { timeout: 15_000 });
	}
	await page.getByTestId('household-leave').click();
	await expect(members).toHaveCount(1, { timeout: 15_000 });
});

const FORMATS: { type: string; code: string }[] = [
	{ type: 'code_128', code: 'FL-128-42' },
	{ type: 'code_39', code: 'FL39-42' },
	{ type: 'code_93', code: 'FL93-42' },
	{ type: 'ean_13', code: '4006381333931' },
	{ type: 'ean_8', code: '96385074' },
	{ type: 'itf', code: '12345678' },
	{ type: 'qr_code', code: 'https://familist.test/carte/42' }
];

test('une carte de chaque format survit au rechargement', async ({ signedInPage: page }) => {
	test.setTimeout(120_000);

	const stamp = Date.now();
	for (const format of FORMATS) {
		await createCard(page, { name: `Format ${format.type} ${stamp}`, code: format.code, type: format.type });
	}

	await page.reload();

	for (const format of FORMATS) {
		const name = `Format ${format.type} ${stamp}`;
		await openCard(page, name);
		await expect(page.getByTestId('card-code-type')).toHaveAttribute('data-test-state', format.type);
		await expect(page.getByTestId('card-code-value')).toHaveText(format.code);
		await expect(page.getByTestId(format.type === 'qr_code' ? 'code-qr' : 'code-barcode')).toBeVisible();
		await expect(page.getByTestId('code-invalid')).toHaveCount(0);
		await page.getByTestId('card-close').click();
		await expect(page.getByTestId('card-fullscreen')).toHaveCount(0);
	}
});
