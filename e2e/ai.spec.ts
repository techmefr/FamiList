import { test, expect } from './fixtures';

/**
 * La clé d'IA, et la seule chose qu'elle commande : l'apparition de la suggestion de recette.
 *
 * Aucun appel n'est fait vers un fournisseur ici. La clé posée est fausse, et c'est voulu — ce qui
 * est vérifié n'a pas besoin du réseau : sans clé la fonctionnalité n'existe pas, avec clé elle
 * apparaît, et avant tout envoi l'écran montre exactement ce qui partirait.
 *
 * Le compte fixe est partagé par toute la suite : chaque test retire la clé qu'il a posée, sinon
 * il laisserait la suggestion visible pour les autres.
 */
test.describe('intelligence artificielle', () => {
	/**
	 * Le compte fixe est partagé, et une exécution interrompue peut laisser une clé derrière elle.
	 * On repart donc d'un compte sans clé plutôt que de le supposer : sans cela, le premier test
	 * échouerait pour l'état laissé par le précédent et non pour ce qu'il vérifie.
	 */
	test.beforeEach(async ({ signedInPage: page }) => {
		await page.goto('/profile/ai');
		await expect(page.getByTestId('ai-state')).toBeVisible();

		const retirer = page.getByTestId('ai-clear');
		if ((await retirer.count()) > 0) await retirer.click();

		await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'off');
	});

	test('sans clé, la suggestion de recette n existe pas', async ({ signedInPage: page }) => {
		await page.goto('/profile/ai');
		await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'off');

		await page.goto('/recipes');
		await expect(page.getByTestId('recipe-new')).toBeVisible();
		await expect(page.getByTestId('ai-suggest-block')).toHaveCount(0);
	});

	test('une clé posée fait apparaître la suggestion, la retirer la fait disparaître', async ({
		signedInPage: page
	}) => {
		await page.goto('/profile/ai');
		await expect(page.getByTestId('ai-form')).toBeVisible();

		await page.getByTestId('ai-key').fill('cle-de-test-sans-valeur');
		await page.getByTestId('ai-save').click();

		await expect(page.getByTestId('ai-saved')).toBeVisible();
		await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'on');

		// La clé quitte l'écran dès qu'elle est enregistrée : elle n'a plus rien à faire dans un champ.
		await expect(page.getByTestId('ai-key')).toHaveValue('');

		await page.goto('/recipes');
		await expect(page.getByTestId('ai-suggest-open')).toBeVisible();

		// Le dépliage n'envoie rien : il montre ce qui partirait, et attend un second geste.
		await page.getByTestId('ai-suggest-open').click();
		await expect(page.getByTestId('ai-suggest-open')).toBeVisible();

		await page.goto('/profile/ai');
		await page.getByTestId('ai-clear').click();
		await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'off');

		await page.goto('/recipes');
		await expect(page.getByTestId('ai-suggest-block')).toHaveCount(0);
	});

	/**
	 * Ce qui est montré avant l'envoi est ce qui part. Le test coche un article, puis vérifie que
	 * son nom se trouve dans le texte affiché — et qu'un nom de liste, lui, n'y est pas.
	 *
	 * La clé est posée en premier, et la navigation se fait ensuite par les liens de l'application
	 * et non par `page.goto` : un rechargement complet relance `data.load()`, qui vide le cache
	 * local avant de le remplir depuis le serveur, et emporterait l'article coché s'il n'a pas
	 * encore été synchronisé.
	 */
	test('avant l envoi, l écran montre le texte exact et rien de plus', async ({
		signedInPage: page
	}) => {
		const produit = `Courgettes ${Date.now()}`;
		const nomDeListe = `SecretDeListe ${Date.now()}`;

		await page.goto('/profile/ai');
		await page.getByTestId('ai-key').fill('cle-de-test-sans-valeur');
		await page.getByTestId('ai-save').click();
		await expect(page.getByTestId('ai-saved')).toBeVisible();

		await page.goto('/');
		await page.getByTestId('nav-create').click();
		await page.getByTestId('create-list').click();
		await page.getByTestId('list-name').fill(nomDeListe);
		await page.getByTestId('list-create').click();

		const carte = page.locator('[data-test-class="list-card"]').filter({ hasText: nomDeListe });
		await expect(carte).toBeVisible();
		await carte.getByRole('link').first().click();
		await expect(page).toHaveURL(/\/l\//);

		await page.getByTestId('empty-add-item').click();
		await page.getByTestId('add-name').fill(produit);
		await page.getByTestId('add-submit').click();

		const ligne = page.locator('[data-test-class="item-row"]').filter({ hasText: produit });
		await expect(ligne).toBeVisible();
		await ligne.locator('[data-test-class="item-check"]').check();

		await page.locator('a[href="/recipes"]').first().click();
		await expect(page).toHaveURL(/\/recipes$/);

		await page.getByTestId('ai-suggest-open').click();
		await expect(page.getByTestId('ai-products')).toContainText(produit);

		await page.getByTestId('ai-prompt-toggle').click();
		const consigne = page.getByTestId('ai-prompt');
		await expect(consigne).toContainText(produit);
		await expect(consigne).not.toContainText(nomDeListe);

		await page.goto('/profile/ai');
		await page.getByTestId('ai-clear').click();
		await expect(page.getByTestId('ai-state')).toHaveAttribute('data-test-state', 'off');
	});
});
