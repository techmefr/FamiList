import { describe, expect, it } from 'vitest';
import { draftFromScan, scanProgress, structureRecipeText, textOfLines } from './recipe-ocr';
import { parseIngredientLine } from './recipe-import';

/** A printed French cookbook page, as a recogniser returns it: page number, times, headings, wrapped lines. */
const FRENCH_PAGE = `124
TARTE AUX POMMES
Dessert
Préparation : 20 min - Cuisson : 35 min
Pour 6 personnes

Ingrédients
• 1 pâte brisée
• 6 pommes golden
• 80 g de sucre
• 50 g de beurre
• 2 œufs
• 20 cl de crème
fraîche
• 1 pincée de cannelle

Préparation
1. Préchauffez le four à 180 °C. Étalez la pâte dans un moule
et piquez le fond avec une fourchette.
2. Épluchez les pommes, coupez-les en quartiers et disposez-les
sur la pâte.
3. Battez les œufs avec le sucre et la crème, versez sur les pommes.
4. Enfournez pour 35 minutes, jusqu'à ce que la tarte soit dorée.`;

/** A handwritten card: no heading, digits read as letters, a glued unit, stray marks, no numbering. */
const HANDWRITTEN_CARD = `Gâteau au yaourt de Mamie
~ ,.
l pot de yaourt
2 pots de sucre
3 pots de farine
3 oeufs
l/2 pot d'huile
1 sachet de levure
Mélanger le yaourt, le sucre et les oeufs.
Ajouter la farine, la levure puis l'huile.
Cuire 30 min au four th. 6.`;

const ENGLISH_PAGE = `Tomato Soup
Serves 4
Prep time: 10 minutes

Ingredients
2 tbsp olive oil
1 onion, chopped
800 g canned tomatoes
500 ml vegetable stock
Salt and pepper

Method
Heat the oil in a large pan and cook the onion for 5 minutes until soft.

Add the tomatoes and the stock, bring to the boil, then simmer for 20 minutes.

Blend until smooth and season to taste.`;

describe('structureRecipeText, une page de livre imprimée', () => {
	const recipe = structureRecipeText([FRENCH_PAGE])!;

	it('trouve le titre et le remet en minuscules', () => {
		expect(recipe.name).toBe('Tarte aux pommes');
	});

	it('lit le nombre de parts', () => {
		expect(recipe.servings).toBe(6);
	});

	it('découpe les ingrédients sous leur titre, puces retirées', () => {
		expect(recipe.lines).toEqual([
			{ name: 'pâte brisée', qty: '1', unit: 'piece' },
			{ name: 'pommes golden', qty: '6', unit: 'piece' },
			{ name: 'sucre', qty: '80', unit: 'g' },
			{ name: 'beurre', qty: '50', unit: 'g' },
			{ name: 'œufs', qty: '2', unit: 'piece' },
			{ name: 'crème fraîche', qty: '200', unit: 'ml' },
			{ name: '1 pincée de cannelle', qty: '', unit: 'piece' }
		]);
	});

	it('découpe les étapes sur leurs numéros, lignes coupées recollées', () => {
		expect(recipe.steps).toEqual([
			'Préchauffez le four à 180 °C. Étalez la pâte dans un moule et piquez le fond avec une fourchette.',
			'Épluchez les pommes, coupez-les en quartiers et disposez-les sur la pâte.',
			'Battez les œufs avec le sucre et la crème, versez sur les pommes.',
			"Enfournez pour 35 minutes, jusqu'à ce que la tarte soit dorée."
		]);
	});

	it('lit les durées des étapes', () => {
		expect(recipe.stepDurations).toEqual([null, null, null, 35 * 60]);
	});

	it("reconnaît la catégorie écrite sur la page", () => {
		expect(recipe.tags).toContain('dessert');
	});

	it("ne prend pas « Préparation : 20 min » pour le début des étapes", () => {
		expect(recipe.steps[0]).not.toContain('20 min');
	});
});

describe('structureRecipeText, une fiche écrite à la main', () => {
	const recipe = structureRecipeText([HANDWRITTEN_CARD])!;

	it('garde le titre et ignore les traces', () => {
		expect(recipe.name).toBe('Gâteau au yaourt de Mamie');
	});

	it('répare les chiffres lus comme des lettres', () => {
		expect(recipe.lines[0]).toEqual({ name: 'yaourt', qty: '1', unit: 'jar' });
		expect(recipe.lines[4]).toEqual({ name: 'huile', qty: '0.5', unit: 'jar' });
	});

	it("sépare les ingrédients des étapes sans aucun titre", () => {
		expect(recipe.lines.map((line) => line.name)).toEqual([
			'yaourt',
			'sucre',
			'farine',
			'oeufs',
			'huile',
			'levure'
		]);
		expect(recipe.steps).toHaveLength(3);
	});

	it('découpe les étapes aux fins de phrase, et lit la cuisson', () => {
		expect(recipe.steps[2]).toBe('Cuire 30 min au four th. 6.');
		expect(recipe.stepDurations).toEqual([null, null, 30 * 60]);
	});

	it("ne met pas de nombre de parts qu'elle ne donne pas", () => {
		expect(recipe.servings).toBeNull();
		expect(draftFromScan(recipe).servings).toBe(4);
	});

	it('un « pot » ou un « sachet » devient son unité', () => {
		expect(recipe.lines[1]).toEqual({ name: 'sucre', qty: '2', unit: 'jar' });
		expect(recipe.lines[5]).toEqual({ name: 'levure', qty: '1', unit: 'bag' });
	});
});

describe('structureRecipeText, une page en anglais', () => {
	const recipe = structureRecipeText([ENGLISH_PAGE])!;

	it('lit le titre, les parts et les ingrédients', () => {
		expect(recipe.name).toBe('Tomato Soup');
		expect(recipe.servings).toBe(4);
		expect(recipe.lines).toEqual([
			{ name: '2 tbsp olive oil', qty: '', unit: 'piece' },
			{ name: 'onion, chopped', qty: '1', unit: 'piece' },
			{ name: 'canned tomatoes', qty: '800', unit: 'g' },
			{ name: 'vegetable stock', qty: '500', unit: 'ml' },
			{ name: 'Salt and pepper', qty: '', unit: 'piece' }
		]);
	});

	it('découpe les étapes en paragraphes, avec leurs durées', () => {
		expect(recipe.steps).toHaveLength(3);
		expect(recipe.stepDurations).toEqual([5 * 60, 20 * 60, null]);
	});

	it('reconnaît une soupe à son titre', () => {
		expect(recipe.tags).toContain('soup');
	});

	it('relie les étapes aux ingrédients qu elles nomment', () => {
		const draft = draftFromScan(recipe);
		expect(draft.stepIngredients[0]).toContain(1);
		expect(draft.reviewed).toBe(true);
	});
});

describe('structureRecipeText, plusieurs pages', () => {
	it('construit une seule recette, dans l ordre des pages', () => {
		const first = `Poulet basquaise
Pour 4 personnes
Ingrédients
1 poulet coupé en morceaux
3 poivrons
4 tomates`;
		const second = `2 oignons
Préparation
1. Faites dorer le poulet 10 min.
2. Ajoutez les légumes et laissez mijoter 45 min.`;

		const recipe = structureRecipeText([first, second])!;
		expect(recipe.name).toBe('Poulet basquaise');
		expect(recipe.lines.map((line) => line.name)).toEqual([
			'poulet coupé en morceaux',
			'poivrons',
			'tomates',
			'oignons'
		]);
		expect(recipe.steps).toEqual([
			'Faites dorer le poulet 10 min.',
			'Ajoutez les légumes et laissez mijoter 45 min.'
		]);
		expect(recipe.stepDurations).toEqual([600, 2700]);
	});

	it('une étape coupée entre deux pages reste une seule étape', () => {
		const recipe = structureRecipeText([
			'Crêpes\nIngrédients\n250 g de farine\nPréparation\n1. Versez la farine dans un saladier et',
			'ajoutez le lait petit à petit.\n2. Laissez reposer 1 h.'
		])!;

		expect(recipe.steps).toEqual([
			'Versez la farine dans un saladier et ajoutez le lait petit à petit.',
			'Laissez reposer 1 h.'
		]);
		expect(recipe.stepDurations[1]).toBe(3600);
	});
});

describe('structureRecipeText, les autres langues', () => {
	it('allemand', () => {
		const recipe = structureRecipeText([
			'Apfelkuchen\nFür 8 Personen\nZutaten\n200 g Mehl\n2 EL Zucker\n1 Bund Petersilie\nZubereitung\n1. Den Ofen vorheizen.\n2. 40 Minuten backen.'
		])!;
		expect(recipe.servings).toBe(8);
		expect(recipe.lines).toEqual([
			{ name: 'Mehl', qty: '200', unit: 'g' },
			{ name: '2 EL Zucker', qty: '', unit: 'piece' },
			{ name: 'Petersilie', qty: '1', unit: 'bunch' }
		]);
		expect(recipe.stepDurations).toEqual([null, 2400]);
	});

	it('espagnol', () => {
		const recipe = structureRecipeText([
			'Tortilla de patatas\nPara 4 personas\nIngredientes\n500 gramos de patatas\n1 cucharada de sal\nPreparación\nFreír las patatas 20 minutos.'
		])!;
		expect(recipe.servings).toBe(4);
		expect(recipe.lines[0]).toEqual({ name: 'patatas', qty: '500', unit: 'g' });
		expect(recipe.lines[1].qty).toBe('');
		expect(recipe.stepDurations).toEqual([1200]);
	});

	it('italien', () => {
		const recipe = structureRecipeText([
			'Risotto\nPer 4 persone\nIngredienti\n320 g di riso\n1 litro di brodo\nPreparazione\nCuocere il riso per 18 minuti.'
		])!;
		expect(recipe.lines).toEqual([
			{ name: 'riso', qty: '320', unit: 'g' },
			{ name: 'brodo', qty: '1', unit: 'l' }
		]);
	});

	it('portugais', () => {
		const recipe = structureRecipeText([
			'Bolo de cenoura\nIngredientes\n3 cenouras\n2 xícaras de açúcar\nModo de preparo\nAsse por 40 minutos.'
		])!;
		expect(recipe.lines[0]).toEqual({ name: 'cenouras', qty: '3', unit: 'piece' });
		expect(recipe.lines[1].qty).toBe('');
		expect(recipe.steps).toEqual(['Asse por 40 minutos.']);
	});

	it('russe', () => {
		const recipe = structureRecipeText([
			'Блины\nНа 4 порции\nИнгредиенты\n200 г муки\n500 мл молока\n1 ст. л. сахара\nПриготовление\nЖарить 2 минуты с каждой стороны.'
		])!;
		expect(recipe.servings).toBe(4);
		expect(recipe.lines).toEqual([
			{ name: 'муки', qty: '200', unit: 'g' },
			{ name: 'молока', qty: '500', unit: 'ml' },
			{ name: '1 ст. л. сахара', qty: '', unit: 'piece' }
		]);
		expect(recipe.stepDurations).toEqual([120]);
	});

	it('arabe, chiffres arabes-indiens compris', () => {
		const recipe = structureRecipeText([
			'شوربة العدس\nالمكونات\n٢٠٠ غرام عدس\n١ ملعقة كمون\nطريقة التحضير\nيطهى العدس ٢٥ دقيقة.'
		])!;
		expect(recipe.name).toBe('شوربة العدس');
		expect(recipe.lines[0]).toEqual({ name: 'عدس', qty: '200', unit: 'g' });
		expect(recipe.lines[1].qty).toBe('');
		expect(recipe.stepDurations).toEqual([1500]);
	});

	it('chinois, une ligne non découpée reste entière', () => {
		const recipe = structureRecipeText(['番茄炒蛋\n材料：\n鸡蛋 3个\n番茄 2个\n做法：\n1. 鸡蛋打散。\n2. 炒5分钟。'])!;
		expect(recipe.name).toBe('番茄炒蛋');
		expect(recipe.lines.map((line) => line.name)).toEqual(['鸡蛋 3个', '番茄 2个']);
		expect(recipe.steps).toEqual(['鸡蛋打散。', '炒5分钟。']);
		expect(recipe.stepDurations).toEqual([null, 300]);
	});

	it('malgache', () => {
		const recipe = structureRecipeText([
			'Romazava\nOlona 4\nAkora\n500 g hena omby\n1 fehezana anamalao\nFomba fanamboarana\nAndrahoy 45 minitra.'
		])!;
		expect(recipe.servings).toBe(4);
		expect(recipe.lines[0]).toEqual({ name: 'hena omby', qty: '500', unit: 'g' });
		expect(recipe.stepDurations).toEqual([2700]);
	});
});

describe('structureRecipeText, les pièges', () => {
	it('rend null quand rien ne ressemble à une recette', () => {
		expect(structureRecipeText([''])).toBeNull();
		expect(structureRecipeText(['~~ ., ;;', '  '])).toBeNull();
		expect(structureRecipeText([])).toBeNull();
	});

	it('« persil » ne se lit pas comme un nombre de personnes', () => {
		const recipe = structureRecipeText(['Taboulé\nIngrédients\n2 bouquets de persil\n1 citron'])!;
		expect(recipe.servings).toBeNull();
		expect(recipe.lines).toHaveLength(2);
	});

	it('« 1l » reste un litre', () => {
		const recipe = structureRecipeText(['Soupe\nIngrédients\n1l de bouillon'])!;
		expect(recipe.lines[0]).toEqual({ name: 'bouillon', qty: '1', unit: 'l' });
	});

	it('« 2O0g » redevient 200 g', () => {
		const recipe = structureRecipeText(['Pâte\nIngrédients\n2O0g de farine'])!;
		expect(recipe.lines[0]).toEqual({ name: 'farine', qty: '200', unit: 'g' });
	});

	it('un sous-titre « Pour la pâte : » ne devient pas un ingrédient', () => {
		const recipe = structureRecipeText([
			'Quiche\nIngrédients\nPour la pâte :\n200 g de farine\nPour la garniture :\n3 œufs'
		])!;
		expect(recipe.lines.map((line) => line.name)).toEqual(['farine', 'œufs']);
	});

	it('un mot coupé en fin de ligne est recollé', () => {
		const recipe = structureRecipeText(['Sauce\nPréparation\nMélan-\nger doucement le tout.'])!;
		expect(recipe.steps).toEqual(['Mélanger doucement le tout.']);
	});

	it('sans étape, le brouillon garde une étape vide à remplir', () => {
		const draft = draftFromScan(structureRecipeText(['Salade\nIngrédients\n1 salade'])!);
		expect(draft.steps).toEqual(['']);
		expect(draft.stepDurations).toEqual([null]);
		expect(draft.stepIngredients).toEqual([[]]);
	});

	it('sans ingrédient, le brouillon garde une ligne vide à remplir', () => {
		const draft = draftFromScan(structureRecipeText(['Préparation\n1. Tout mélanger dans un bol.'])!);
		expect(draft.lines).toEqual([{ name: '', qty: '', unit: 'piece' }]);
		expect(draft.name).toBe('');
	});
});

describe('parseIngredientLine, les autres langues', () => {
	it('convertit les livres et les onces en grammes', () => {
		expect(parseIngredientLine('1 lb potatoes')).toEqual({ name: 'potatoes', qty: '453.592', unit: 'g' });
		expect(parseIngredientLine('4 oz of cheese')).toEqual({ name: 'cheese', qty: '113.398', unit: 'g' });
	});

	it('laisse entière une mesure sans unité dans le modèle', () => {
		for (const raw of ['2 cups flour', '1 tsp salt', '2 cucchiai di olio', '1 colher de sal', '2 ложки сахара']) {
			expect(parseIngredientLine(raw)).toEqual({ name: raw, qty: '', unit: 'piece' });
		}
	});
});

describe('textOfLines', () => {
	it('remet les boîtes dans l ordre de lecture, un blanc entre deux paragraphes', () => {
		const text = textOfLines([
			{ text: 'Cuire 20 min.', top: 200, left: 10, height: 20 },
			{ text: 'Crêpes', top: 10, left: 10, height: 30 },
			{ text: '250 g de farine', top: 60, left: 10, height: 20 },
			{ text: '3 œufs', top: 84, left: 10, height: 20 },
			{ text: '  ', top: 120, left: 10, height: 20 }
		]);
		expect(text).toBe('Crêpes\n250 g de farine\n3 œufs\n\nCuire 20 min.');
	});

	it('sur une même ligne, de gauche à droite', () => {
		expect(
			textOfLines([
				{ text: 'farine', top: 12, left: 80, height: 20 },
				{ text: '250 g', top: 10, left: 10, height: 20 }
			])
		).toBe('250 g\nfarine');
	});

	it('ne touche pas au tableau reçu', () => {
		const lines = [
			{ text: 'b', top: 50, left: 0, height: 10 },
			{ text: 'a', top: 0, left: 0, height: 10 }
		];
		textOfLines(lines);
		expect(lines[0].text).toBe('b');
	});
});

describe('scanProgress', () => {
	it('avance sur toutes les pages à la fois', () => {
		expect(scanProgress(0, 2, 0)).toBe(0);
		expect(scanProgress(0, 2, 0.5)).toBe(0.25);
		expect(scanProgress(1, 2, 1)).toBe(1);
	});

	it('reste entre 0 et 1 quoi que dise le moteur', () => {
		expect(scanProgress(0, 0, 0.5)).toBe(0);
		expect(scanProgress(0, 1, Number.NaN)).toBe(0);
		expect(scanProgress(0, 1, 7)).toBe(1);
	});
});
