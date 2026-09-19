import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/** Crée un magasin depuis /shops, comme dans e2e/shops.spec.ts. */
async function createShop(page: Page, name: string) {
	await page.goto('/shops');
	await page.getByTestId('shop-name').fill(name);
	await page.getByTestId('shop-create').click();
	await expect(
		page.locator('[data-test-class="shop-card"]').filter({ hasText: name })
	).toBeVisible();
}

async function switchToShop(page: Page, name: string) {
	// Le sélecteur de magasin existe en double dans le DOM (barre desktop et barre du pouce mobile), chacun
	// avec sa propre feuille : seule celle réellement ouverte porte l'attribut `open`.
	await page.getByTestId('shop-bar').click();
	const picker = page.locator('dialog[data-test-id="shop-picker"][open]');
	await expect(picker).toBeVisible();
	await picker.locator('[data-test-class="shop-choice"]').filter({ hasText: name }).click();
	await expect(picker).toBeHidden();
}

async function createList(page: Page, name: string): Promise<string> {
	await page.goto('/');
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-list').click();
	await page.getByTestId('list-name').fill(name);
	await page.getByTestId('list-create').click();

	await page
		.locator('[data-test-class="list-card"]')
		.filter({ hasText: name })
		.getByRole('link')
		.first()
		.click();
	await expect(page).toHaveURL(/\/l\/([^/?]+)/);

	return page.url().match(/\/l\/([^/?]+)/)![1];
}

async function addItem(page: Page, name: string) {
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-item').click();
	await expect(page.getByTestId('add-item')).toBeVisible();
	await page.getByTestId('add-name').fill(name);
	await page.getByTestId('add-submit').click();
	await expect(page.getByTestId('add-item')).toBeHidden();
}

test.describe('historique des prix', () => {
	test('enregistrer un prix sur un article coche', async ({ signedInPage: page }) => {
		const itemName = `Prix e2e ${Date.now()}`;
		await createList(page, `Liste prix e2e ${Date.now()}`);
		await addItem(page, itemName);

		const row = page.locator('[data-test-class="item-row"]').filter({ hasText: itemName });
		await row.locator('[data-test-class="item-check"]').check();

		const priceField = row.locator('[data-test-class="item-price"]');
		await expect(priceField).toBeVisible();
		// Le point plutôt que la virgule : Chromium sans préférence de langue configurée lit l'anglais, et
		// `parseAmount` accepte les deux séparateurs de toute façon.
		await priceField.fill('2.50');
		await priceField.blur();

		// Un lien de l'application (`open-prices`), pas `page.goto` : celui-ci provoque un vrai rechargement
		// de la page, qui peut devancer l'écriture asynchrone du prix dans IndexedDB.
		await page.getByTestId('open-prices').click();
		await expect(page).toHaveURL(/\/prices/);
		const product = page.locator('[data-test-class="price-product"]').filter({ hasText: itemName });
		await expect(product).toBeVisible();
		await expect(product.locator('[data-test-class="price-shop"]')).toHaveCount(1);
	});

	test('la comparaison par magasin est triee du moins cher au plus cher', async ({
		signedInPage: page
	}) => {
		const stamp = Date.now();
		// Des noms qui ne se contiennent pas l'un l'autre : `filter({ hasText })` fait une recherche de
		// sous-chaîne insensible à la casse, et « Pas cher » contient « cher ».
		const cheapShop = `Auchamps e2e ${stamp}`;
		const dearShop = `Zentrum e2e ${stamp}`;
		const itemName = `Comparaison e2e ${stamp}`;

		await createShop(page, cheapShop);
		await createShop(page, dearShop);

		await createList(page, `Liste comparaison e2e ${stamp}`);
		await addItem(page, itemName);

		const row = page.locator('[data-test-class="item-row"]').filter({ hasText: itemName });
		await row.locator('[data-test-class="item-check"]').check();

		// Créé en dernier, ce magasin devient l'actif : on y enregistre le prix le plus élevé d'abord.
		await switchToShop(page, dearShop);
		await row.locator('[data-test-class="item-price"]').fill('3.20');
		await row.locator('[data-test-class="item-price"]').blur();

		await switchToShop(page, cheapShop);
		await row.locator('[data-test-class="item-price"]').fill('1.10');
		await row.locator('[data-test-class="item-price"]').blur();

		await page.getByTestId('open-prices').click();
		await expect(page).toHaveURL(/\/prices/);
		const product = page.locator('[data-test-class="price-product"]').filter({ hasText: itemName });
		await expect(product).toBeVisible();

		const shopRows = product.locator('[data-test-class="price-shop"]');
		await expect(shopRows).toHaveCount(2);
		await expect(shopRows.nth(0)).toContainText(cheapShop);
		// Le séparateur décimal et le symbole monétaire dépendent de la langue lue par le navigateur : on ne
		// vérifie que les chiffres, pas leur habillage.
		await expect(shopRows.nth(0)).toContainText(/1[.,]10/);
		await expect(shopRows.nth(1)).toContainText(dearShop);
	});

	test('l etat vide quand rien n a encore ete tarife', async ({ signedInPage: page }) => {
		const itemName = `Sans prix e2e ${Date.now()}`;
		await createList(page, `Liste sans prix e2e ${Date.now()}`);
		await addItem(page, itemName);

		// L'article existe mais n'a jamais été coché ni tarifé : la liste des prix reste vide pour lui, même
		// si le foyer a par ailleurs déjà tarifé d'autres produits dans les autres scénarios de cette suite.
		await page.goto('/prices');
		const product = page.locator('[data-test-class="price-product"]').filter({ hasText: itemName });
		await expect(product).toHaveCount(0);
	});
});
