import { test, expect } from './fixtures';

/**
 * Les deux chemins vers un code — la caméra, une image déjà sur l'appareil — sont côte à côte.
 * L'un portait une marge haute que l'autre n'avait pas, et des icônes d'une autre taille : sur un
 * écran étroit, le décalage se voyait tout de suite.
 *
 * Le test mesure la géométrie réelle plutôt que les classes : c'est le décalage qui se voit, pas
 * la feuille de style.
 */
test('les deux boutons de code sont alignés sur mobile', async ({ signedInPage: page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/cards');
	await page.getByTestId('card-add').click();

	const scan = page.getByTestId('scan-start');
	const image = page.getByTestId('import-code');

	// Sans caméra, le bouton de scan n'existe pas : il n'y a alors rien à aligner.
	await expect(image).toBeVisible();
	if ((await scan.count()) === 0) test.skip();

	// Les polices décident du repli des libellés, donc de la hauteur des boutons : mesurer avant
	// qu'elles soient chargées donne une géométrie qui n'est celle de personne.
	await page.evaluate(() => document.fonts.ready);

	/**
	 * Le formulaire s'ouvre en glissant : mesuré au milieu de l'animation, tout est décalé. On
	 * relit jusqu'à ce que la géométrie tienne — un vrai désalignement, lui, ne se résorbe pas.
	 *
	 * Selon la langue et la taille du texte, la rangée tient sur une ligne ou se replie. Les deux
	 * cas sont bons ; ce qui ne l'est pas, c'est le décalage de quelques pixels qu'on avait — côte
	 * à côte, même hauteur et même sommet ; l'un sous l'autre, même bord gauche.
	 */
	await expect
		.poll(
			async () => {
				const a = await scan.boundingBox();
				const b = await image.boundingBox();
				if (!a || !b) return 'boîtes absentes';

				const cote = Math.abs(a.y - b.y) < 4;
				if (cote) {
					return Math.abs(a.height - b.height) < 1 ? 'aligné' : `hauteurs ${a.height}/${b.height}`;
				}

				return Math.abs(a.x - b.x) < 1 ? 'aligné' : `bords gauches ${a.x}/${b.x}`;
			},
			{ timeout: 10_000 }
		)
		.toBe('aligné');
});
