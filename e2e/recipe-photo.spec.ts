import { test, expect } from './fixtures';

/** A 1x1 red pixel JPEG, small enough to inline: no generated image is ever fetched in a test. */
const FAKE_JPEG = Buffer.from(
	'/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
	'base64'
);

/** A 1x1 PNG the browser can decode: a search result whose preview fails to load is removed from the sheet. */
const FAKE_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

async function createRecipe(page: import('@playwright/test').Page, name: string) {
	await page.goto('/recipes');
	await page.getByTestId('recipe-new').click();
	await page.getByTestId('recipe-name').fill(name);
	await page.getByTestId('recipe-next').click();

	await page.locator('[data-test-class="ingredient-name"]').first().fill('Farine');
	await page.getByTestId('recipe-next').click();
	await page.getByTestId('recipe-next').click();

	const card = page.locator('[data-test-class="recipe-card"]').filter({ hasText: name });
	await expect(card).toBeVisible();
	return card;
}

async function openPicker(card: import('@playwright/test').Locator) {
	await card.locator('[data-test-class="recipe-card-header"]').click();
	await card.locator('[data-test-class="recipe-photo-button"]').click();
	const picker = card.page().getByTestId('recipe-image-picker');
	await expect(picker).toBeVisible();
	return picker;
}

function mockOpenverse(page: import('@playwright/test').Page, count: number) {
	return page.route('https://api.openverse.org/v1/images/?**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				results: Array.from({ length: count }, (_, n) => ({
					id: `img-${n}`,
					title: `Plat ${n}`,
					thumbnail: `https://thumbs.example.test/${n}.png`,
					creator: 'Auteur',
					license: 'by'
				}))
			})
		});
	});
}

function mockThumbnails(page: import('@playwright/test').Page) {
	return page.route('https://thumbs.example.test/**', async (route) => {
		await route.fulfill({ status: 200, contentType: 'image/png', body: FAKE_PNG });
	});
}

const successToast = '[data-test-class="toast"][data-tone="success"]';

async function clearAiKeys(page: import('@playwright/test').Page) {
	await page.goto('/profile/ai');
	await expect(page.getByTestId('ai-state')).toBeVisible();
	const remove = page.getByTestId('ai-clear');
	while ((await remove.count()) > 0) {
		const before = await remove.count();
		await remove.first().click();
		await expect(remove).toHaveCount(before - 1);
	}
}

async function setOpenRouterKey(page: import('@playwright/test').Page) {
	await clearAiKeys(page);
	await page.getByTestId('ai-provider').selectOption('openrouter');
	await page.getByTestId('ai-key').fill('cle-openrouter-e2e');
	await page.getByTestId('ai-save').click();
	await expect(page.locator('[data-test-id="ai-credential-row"][data-test-provider="openrouter"]')).toBeVisible();
}

const DESCRIBED = 'Golden quiche with a flaky crust on a wooden board';

/**
 * OpenRouter answers both calls on the same address: the text model writing the description, then the
 * image model drawing it. `modalities` is what tells the two apart.
 */
function mockOpenRouter(page: import('@playwright/test').Page, imageStatus = 200) {
	const imagePrompts: string[] = [];
	const ready = page.route('https://openrouter.ai/api/v1/chat/completions', async (route) => {
		const body = route.request().postDataJSON();
		if (!body.modalities) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ choices: [{ message: { content: `"${DESCRIBED}"` } }] })
			});
			return;
		}

		imagePrompts.push(body.messages[0].content);
		await route.fulfill({
			status: imageStatus,
			contentType: 'application/json',
			body: JSON.stringify(
				imageStatus === 200
					? {
							choices: [
								{
									message: {
										images: [
											{
												type: 'image_url',
												image_url: { url: `data:image/jpeg;base64,${FAKE_JPEG.toString('base64')}` }
											}
										]
									}
								}
							]
						}
					: { error: { message: 'Insufficient credits' } }
			)
		});
	});
	return { ready, imagePrompts };
}

/**
 * Every source of the picker (#305). Third parties are intercepted: nothing here should depend on
 * OpenRouter, Openverse or Pexels being reachable or fast in CI.
 */
test.describe("choisir l'image d'une recette", () => {
	test('sans cle OpenRouter, generer dit quoi faire', async ({ signedInPage: page }) => {
		await clearAiKeys(page);

		const card = await createRecipe(page, `Recette sans cle e2e ${Date.now()}`);
		const picker = await openPicker(card);
		await picker.getByTestId('recipe-image-source-generate').click();

		await expect(picker.getByTestId('recipe-image-picker-error')).toBeVisible();
		await expect(picker.getByTestId('recipe-image-picker-error-link')).toHaveAttribute('href', '/profile/ai');
	});

	test('genere la photo a partir de la description ecrite par l IA', async ({ signedInPage: page }) => {
		await setOpenRouterKey(page);
		const openRouter = mockOpenRouter(page);
		await openRouter.ready;

		try {
			const card = await createRecipe(page, `Quiche e2e ${Date.now()}`);
			const picker = await openPicker(card);
			await picker.getByTestId('recipe-image-source-generate').click();

			await expect(picker).toBeHidden({ timeout: 15_000 });
			await expect(page.locator(successToast)).toBeVisible();
			await expect(card.locator('[data-test-class="recipe-photo"]')).toBeVisible({ timeout: 15_000 });
			expect(openRouter.imagePrompts[0]).toContain(DESCRIBED);
		} finally {
			await clearAiKeys(page);
		}
	});

	test('un compte OpenRouter sans credit le dit dans le menu', async ({ signedInPage: page }) => {
		await setOpenRouterKey(page);
		const openRouter = mockOpenRouter(page, 402);
		await openRouter.ready;

		try {
			const card = await createRecipe(page, `Recette sans credit e2e ${Date.now()}`);
			const picker = await openPicker(card);
			await picker.getByTestId('recipe-image-source-generate').click();

			await expect(picker.getByTestId('recipe-image-picker-error')).toBeVisible();
			await expect(picker.getByTestId('recipe-image-picker-error-link')).toHaveAttribute(
				'href',
				'https://openrouter.ai/settings/credits'
			);
			await expect(card.locator('[data-test-class="recipe-photo"]')).toHaveCount(0);
		} finally {
			await clearAiKeys(page);
		}
	});

	test("chercher, choisir une image, puis la retirer", async ({ signedInPage: page }) => {
		await mockOpenverse(page, 3);
		await mockThumbnails(page);

		const name = `Recette recherche e2e ${Date.now()}`;
		const card = await createRecipe(page, name);
		const picker = await openPicker(card);
		await picker.getByTestId('recipe-image-source-search').click();

		await expect(page.getByTestId('recipe-image-search-query')).toHaveValue(name);
		const results = picker.locator('[data-test-class="recipe-image-search-result"]');
		await expect(results).toHaveCount(3);
		await results.nth(1).click();

		await expect(picker).toBeHidden({ timeout: 15_000 });
		await expect(page.locator(successToast)).toBeVisible();
		await expect(card.locator('[data-test-class="recipe-photo"]')).toBeVisible({ timeout: 15_000 });

		await card.locator('[data-test-class="recipe-photo-button"]').click();
		await picker.getByTestId('recipe-image-source-remove').click();
		await expect(picker).toBeHidden();
		await expect(card.locator('[data-test-class="recipe-photo"]')).toHaveCount(0);
	});

	test("dit quand rien n'est trouve", async ({ signedInPage: page }) => {
		await mockOpenverse(page, 0);

		const card = await createRecipe(page, `Recette introuvable e2e ${Date.now()}`);
		const picker = await openPicker(card);
		await picker.getByTestId('recipe-image-source-search').click();

		await expect(page.getByTestId('recipe-image-search-error')).toBeVisible();
		await expect(page.getByTestId('recipe-image-banks-hint')).toBeVisible();
	});

	test('une photo de l appareil devient la photo de la recette', async ({ signedInPage: page }) => {
		const card = await createRecipe(page, `Recette galerie e2e ${Date.now()}`);
		const picker = await openPicker(card);

		await picker.getByTestId('recipe-image-gallery-input').setInputFiles({
			name: 'plat.png',
			mimeType: 'image/png',
			buffer: FAKE_PNG
		});

		await expect(picker).toBeHidden({ timeout: 15_000 });
		await expect(page.locator(successToast)).toBeVisible();
		await expect(card.locator('[data-test-class="recipe-photo"]')).toBeVisible({ timeout: 15_000 });
	});

	test('une cle pexels ajoute ses resultats a ceux d openverse', async ({ signedInPage: page }) => {
		await mockOpenverse(page, 1);
		await mockThumbnails(page);
		let authorization = '';
		await page.route('https://api.pexels.com/v1/search?**', async (route) => {
			authorization = route.request().headers()['authorization'] ?? '';
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					photos: [{ id: 1, alt: 'Plat', photographer: 'Ana', src: { medium: 'https://thumbs.example.test/p.png' } }]
				})
			});
		});

		await page.goto('/profile/images');
		await page.getByTestId('image-bank-pexels-key').fill('cle-e2e');
		await page.getByTestId('image-bank-pexels-save').click();
		await expect(page.getByTestId('image-bank-pexels-state')).toHaveAttribute('data-state', 'on');

		try {
			const card = await createRecipe(page, `Recette pexels e2e ${Date.now()}`);
			const picker = await openPicker(card);
			await picker.getByTestId('recipe-image-source-search').click();

			await expect(picker.locator('[data-source="pexels"]')).toHaveCount(1);
			await expect(picker.locator('[data-source="openverse"]')).toHaveCount(1);
			expect(authorization).toBe('cle-e2e');
		} finally {
			await page.goto('/profile/images');
			await page.getByTestId('image-bank-pexels-clear').click();
			await expect(page.getByTestId('image-bank-pexels-state')).toHaveAttribute('data-state', 'off');
		}
	});
});
