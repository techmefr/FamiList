import { describe, expect, it } from 'vitest';
import { extractRecipe, MAX_READABLE_CHARS, readableText } from './extract.ts';

const page = (jsonLd: unknown): string =>
	`<html><head><title>x</title><script type="application/ld+json">${
		typeof jsonLd === 'string' ? jsonLd : JSON.stringify(jsonLd)
	}</script></head><body><p>Bonjour</p></body></html>`;

const gratin = {
	'@context': 'https://schema.org',
	'@type': 'Recipe',
	name: 'Gratin de courgettes',
	recipeYield: '4 personnes',
	recipeIngredient: ['600 g de courgettes', '20 cl de creme', 'Sel'],
	recipeInstructions: ['Laver les courgettes.', 'Enfourner 30 minutes.']
};

describe('extractRecipe', () => {
	it('lit un Recipe pose directement', () => {
		expect(extractRecipe(page(gratin))).toEqual({
			name: 'Gratin de courgettes',
			servings: '4 personnes',
			ingredients: ['600 g de courgettes', '20 cl de creme', 'Sel'],
			steps: ['Laver les courgettes.', 'Enfourner 30 minutes.'],
			image: null,
			categories: []
		});
	});

	it('rend telles quelles la categorie, la cuisine et le regime', () => {
		const found = extractRecipe(
			page({
				...gratin,
				recipeCategory: ['Plat principal', 'Gratin'],
				recipeCuisine: 'Française',
				suitableForDiet: 'https://schema.org/VegetarianDiet'
			})
		);
		expect(found?.categories).toEqual([
			'Plat principal',
			'Gratin',
			'Française',
			'https://schema.org/VegetarianDiet'
		]);
	});

	it('lit un Recipe range dans un tableau', () => {
		const found = extractRecipe(page([{ '@type': 'WebSite', name: 'Site' }, gratin]));
		expect(found?.name).toBe('Gratin de courgettes');
	});

	it('lit un Recipe range dans un @graph', () => {
		const found = extractRecipe(page({ '@context': 'x', '@graph': [gratin] }));
		expect(found?.name).toBe('Gratin de courgettes');
	});

	it('accepte un @type multiple', () => {
		const found = extractRecipe(page({ ...gratin, '@type': ['Article', 'Recipe'] }));
		expect(found?.name).toBe('Gratin de courgettes');
	});

	it('deplie les HowToStep et les HowToSection', () => {
		const found = extractRecipe(
			page({
				...gratin,
				recipeInstructions: [
					{ '@type': 'HowToStep', text: 'Laver.' },
					{
						'@type': 'HowToSection',
						name: 'Cuisson',
						itemListElement: [
							{ '@type': 'HowToStep', text: 'Prechauffer.' },
							{ '@type': 'HowToStep', name: 'Enfourner.' }
						]
					}
				]
			})
		);
		expect(found?.steps).toEqual(['Laver.', 'Prechauffer.', 'Enfourner.']);
	});

	it('accepte des instructions donnees en une seule chaine', () => {
		const found = extractRecipe(page({ ...gratin, recipeInstructions: 'Tout melanger.' }));
		expect(found?.steps).toEqual(['Tout melanger.']);
	});

	it('accepte un nombre de parts numerique', () => {
		expect(extractRecipe(page({ ...gratin, recipeYield: 6 }))?.servings).toBe('6');
	});

	it('garde la premiere valeur quand le nombre de parts est un tableau', () => {
		expect(extractRecipe(page({ ...gratin, recipeYield: ['4', '4 parts'] }))?.servings).toBe('4');
	});

	it('nettoie les balises, les entites et les espaces des champs', () => {
		const found = extractRecipe(
			page({
				...gratin,
				name: '  Gratin   &amp; co ',
				recipeInstructions: ['<p>Laver les&nbsp;courgettes.</p>']
			})
		);
		expect(found?.name).toBe('Gratin & co');
		expect(found?.steps).toEqual(['Laver les courgettes.']);
	});

	it('ignore un bloc JSON illisible et lit le suivant', () => {
		const html = page('{ pas du json') + page(gratin);
		expect(extractRecipe(html)?.name).toBe('Gratin de courgettes');
	});

	it('rend null quand la page ne publie aucune recette', () => {
		expect(extractRecipe(page({ '@type': 'Article', name: 'Un billet' }))).toBeNull();
		expect(extractRecipe('<html><body>Rien du tout</body></html>')).toBeNull();
	});

	it('rend null pour un Recipe vide de nom et d ingredients', () => {
		expect(extractRecipe(page({ '@type': 'Recipe', recipeInstructions: ['Cuire.'] }))).toBeNull();
	});

	it('rend une recette sans etapes quand le site n en publie pas', () => {
		const found = extractRecipe(page({ ...gratin, recipeInstructions: undefined }));
		expect(found?.steps).toEqual([]);
		expect(found?.ingredients).toHaveLength(3);
	});

	it('trouve le bloc quel que soit l ordre des attributs du script', () => {
		const html = `<script data-x="1" TYPE='application/ld+json' defer>${JSON.stringify(gratin)}</script>`;
		expect(extractRecipe(html)?.name).toBe('Gratin de courgettes');
	});

	describe('image', () => {
		it('lit une image donnee comme simple chaine', () => {
			const found = extractRecipe(page({ ...gratin, image: 'https://x.test/photo.jpg' }));
			expect(found?.image).toBe('https://x.test/photo.jpg');
		});

		it('lit la premiere image d un tableau de chaines', () => {
			const found = extractRecipe(
				page({ ...gratin, image: ['https://x.test/a.jpg', 'https://x.test/b.jpg'] })
			);
			expect(found?.image).toBe('https://x.test/a.jpg');
		});

		it('lit l url d un ImageObject', () => {
			const found = extractRecipe(
				page({ ...gratin, image: { '@type': 'ImageObject', url: 'https://x.test/obj.jpg' } })
			);
			expect(found?.image).toBe('https://x.test/obj.jpg');
		});

		it('lit la premiere url d un tableau d ImageObject', () => {
			const found = extractRecipe(
				page({
					...gratin,
					image: [
						{ '@type': 'ImageObject', url: 'https://x.test/first.jpg' },
						{ '@type': 'ImageObject', url: 'https://x.test/second.jpg' }
					]
				})
			);
			expect(found?.image).toBe('https://x.test/first.jpg');
		});

		it('rend null quand le Recipe ne publie aucune image', () => {
			expect(extractRecipe(page(gratin))?.image).toBeNull();
		});
	});
});

describe('readableText', () => {
	it('retire les scripts, styles et la navigation', () => {
		const html =
			'<html><head><style>.x{color:red}</style></head><body>' +
			'<nav>Accueil Recettes Contact</nav>' +
			'<script>console.log("x")</script>' +
			'<p>Gratin de courgettes</p>' +
			'</body></html>';

		const text = readableText(html);
		expect(text).toContain('Gratin de courgettes');
		expect(text).not.toContain('Accueil');
		expect(text).not.toContain('console.log');
		expect(text).not.toContain('color:red');
	});

	it('retire aussi l en-tete et le pied de page', () => {
		const html = '<header>Menu</header><p>Recette</p><footer>Copyright 2026</footer>';
		const text = readableText(html);
		expect(text).toBe('Recette');
	});

	it('deplie les entites et les espaces comme extractRecipe', () => {
		const html = '<p>600&nbsp;g de courgettes &amp; sel</p>';
		expect(readableText(html)).toBe('600 g de courgettes & sel');
	});

	it('ne garde que le texte, sans les balises', () => {
		const html = '<div><p>Une   phrase</p><p>Une autre</p></div>';
		expect(readableText(html)).toBe('Une phrase Une autre');
	});

	it('plafonne la longueur du texte rendu', () => {
		const html = `<p>${'a'.repeat(MAX_READABLE_CHARS + 500)}</p>`;
		expect(readableText(html)).toHaveLength(MAX_READABLE_CHARS);
	});

	it('rend une chaine vide pour une page sans texte', () => {
		expect(readableText('<script>1</script><style>.a{}</style>')).toBe('');
	});
});
