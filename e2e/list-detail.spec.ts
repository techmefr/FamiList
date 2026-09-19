import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Une liste fraîche, ouverte sur son écran de détail. Chaque test en crée une à lui : les articles et les
 * rayons dépendent trop de l'état précédent pour partager une liste entre les tests.
 */
async function openFreshList(page: Page, name: string): Promise<string> {
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

/** Ouvre la feuille d'ajout depuis le menu de création, comme le ferait la personne sur le bouton flottant. */
async function addItem(page: Page, name: string) {
	await page.getByTestId('nav-create').click();
	await page.getByTestId('create-item').click();
	await expect(page.getByTestId('add-item')).toBeVisible();
	await page.getByTestId('add-name').fill(name);
	await page.getByTestId('add-submit').click();
	await expect(page.getByTestId('add-item')).toBeHidden();
}

test.describe('detail de liste', () => {
	test('ajouter un article, le cocher puis le decocher', async ({ signedInPage: page }) => {
		const listName = `Liste e2e ${Date.now()}`;
		const itemName = `Article e2e ${Date.now()}`;

		await openFreshList(page, listName);
		await addItem(page, itemName);

		const row = page.locator('[data-test-class="item-row"]').filter({ hasText: itemName });
		await expect(row).toBeVisible();

		const checkbox = row.locator('[data-test-class="item-check"]');
		await expect(checkbox).not.toBeChecked();

		// Le prix n'apparaît que sur un article coché : c'est le seul moment où le prix est sous les yeux.
		await checkbox.check();
		await expect(checkbox).toBeChecked();
		await expect(row.locator('[data-test-class="item-price"]')).toBeVisible();

		await checkbox.uncheck();
		await expect(checkbox).not.toBeChecked();
		await expect(row.locator('[data-test-class="item-price"]')).toBeHidden();

		await row.locator('[data-test-class="item-remove"]').click();
		await expect(row).toBeHidden();
	});

	test('plier et deplier un rayon', async ({ signedInPage: page }) => {
		const listName = `Liste e2e ${Date.now()}`;
		const itemName = `Article e2e ${Date.now()}`;

		await openFreshList(page, listName);
		await addItem(page, itemName);

		const row = page.locator('[data-test-class="item-row"]').filter({ hasText: itemName });
		await expect(row).toBeVisible();

		const aisle = page.locator('[data-test-class="aisle-group"]').first();
		const toggle = aisle.locator('[data-test-class="aisle-toggle"]');

		// Le rayon s'ouvre par défaut : on le replie d'abord, l'article disparaît, puis on le rouvre.
		await toggle.click();
		await expect(row).toBeHidden();

		await toggle.click();
		await expect(row).toBeVisible();

		// Le glisser-déposer tactile ne peut pas être rejoué ici : Playwright ne produit pas d'événements
		// tactiles de bas niveau synthétiques équivalents à un vrai geste de pointer, et la poignée n'écoute
		// que ces événements. Le tri au clavier (item-up / item-down) reste couvert ailleurs et suffit à
		// vérifier la mécanique de réordonnancement elle-même.
	});

	test('priorite et note d un article', async ({ signedInPage: page }) => {
		const listName = `Liste e2e ${Date.now()}`;
		const itemName = `Article e2e ${Date.now()}`;

		await openFreshList(page, listName);
		await addItem(page, itemName);

		const row = page.locator('[data-test-class="item-row"]').filter({ hasText: itemName });
		const priority = row.locator('[data-test-class="item-priority"]');

		await expect(priority).toHaveAttribute('aria-pressed', 'false');
		await priority.click();
		await expect(priority).toHaveAttribute('aria-pressed', 'true');

		await row.locator('[data-test-class="item-edit"]').click();
		await expect(page.getByTestId('add-item')).toBeVisible();
		await page.getByTestId('add-note').fill('Sans sucre');
		await page.getByTestId('add-submit').click();

		await expect(row).toContainText('Sans sucre');
	});

	test('la feuille de filtres masque les articles non prioritaires', async ({
		signedInPage: page
	}) => {
		const listName = `Liste e2e ${Date.now()}`;
		const priorityName = `Prioritaire e2e ${Date.now()}`;
		const otherName = `Ordinaire e2e ${Date.now()}`;

		await openFreshList(page, listName);
		await addItem(page, priorityName);
		await addItem(page, otherName);

		const priorityRow = page.locator('[data-test-class="item-row"]').filter({ hasText: priorityName });
		const otherRow = page.locator('[data-test-class="item-row"]').filter({ hasText: otherName });
		await priorityRow.locator('[data-test-class="item-priority"]').click();

		await page.getByTestId('open-filters').click();
		await expect(page.getByTestId('filter-sheet')).toBeVisible();
		await page.getByTestId('filter-priority').check();
		await page.getByTestId('filter-sheet-close').click();

		await expect(priorityRow).toBeVisible();
		await expect(otherRow).toBeHidden();

		await page.getByTestId('open-filters').click();
		await page.getByTestId('filter-reset').click();
		await page.getByTestId('filter-sheet-close').click();

		await expect(otherRow).toBeVisible();
	});

	test('la feuille de partage et l envoi comme texte sont deux gestes distincts', async ({
		signedInPage: page
	}) => {
		const listName = `Liste e2e ${Date.now()}`;
		await openFreshList(page, listName);

		// Le partage donne accès à la liste dans le foyer : sur un compte seul, seule l'invitation est proposée.
		await page.getByTestId('open-share').click();
		await expect(page.getByTestId('share-sheet')).toBeVisible();
		await expect(page.getByTestId('share-invite')).toBeVisible();
		await page.getByTestId('share-close').click();
		await expect(page.getByTestId('share-sheet')).toBeHidden();

		// L'envoi comme texte est un bouton différent : il ne partage aucun accès, il fige une copie du
		// contenu. Sans presse-papiers ou destinataire réel disponible dans Chromium headless, on vérifie
		// seulement qu'un message de statut apparaît — succès ou repli, les deux sont un aboutissement.
		await page.getByTestId('send-list').click();
		await expect(page.getByTestId('send-status')).not.toHaveText('');
	});

	test('le lien profond met l article en surbrillance', async ({ signedInPage: page }) => {
		const listName = `Liste e2e ${Date.now()}`;
		const itemName = `Article e2e ${Date.now()}`;

		const listId = await openFreshList(page, listName);
		await addItem(page, itemName);

		const row = page.locator('[data-test-class="item-row"]').filter({ hasText: itemName });
		const itemId = (await row.locator('[data-test-class="item-check"]').getAttribute('id'))!.replace(
			'item-',
			''
		);

		await page.goto(`/l/${listId}?item=${itemId}`);

		// The checkbox carries the same `item-<id>` id as its wrapping row (a pre-existing duplicate-id
		// quirk, not something to fix here): we target the row explicitly, not the checkbox.
		const highlighted = page.locator(`div#item-${itemId}`);
		await expect(highlighted).toBeVisible();
		await expect(highlighted).toHaveClass(/ring-primary/);
	});
});
