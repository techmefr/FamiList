import { describe, expect, it } from 'vitest';
import {
	importErrorOf,
	importedLines,
	parseImportedServings,
	parseIngredientLine
} from './recipe-import';

describe('parseIngredientLine', () => {
	it('découpe un poids', () => {
		expect(parseIngredientLine('600 g de courgettes')).toEqual({
			name: 'courgettes',
			qty: '600',
			unit: 'g'
		});
	});

	it('découpe un poids écrit en toutes lettres', () => {
		expect(parseIngredientLine('250 grammes de farine')).toEqual({
			name: 'farine',
			qty: '250',
			unit: 'g'
		});
	});

	it('convertit les centilitres et les décilitres en millilitres', () => {
		expect(parseIngredientLine('20 cl de crème')).toEqual({
			name: 'crème',
			qty: '200',
			unit: 'ml'
		});
		expect(parseIngredientLine('2 dl de lait')).toEqual({ name: 'lait', qty: '200', unit: 'ml' });
	});

	it('convertit les milligrammes', () => {
		expect(parseIngredientLine('500 mg de safran')).toEqual({
			name: 'safran',
			qty: '0.5',
			unit: 'g'
		});
	});

	it('accepte la virgule décimale', () => {
		expect(parseIngredientLine('1,5 l de bouillon')).toEqual({
			name: 'bouillon',
			qty: '1.5',
			unit: 'l'
		});
	});

	it('compte en pièces un nombre posé devant un produit', () => {
		expect(parseIngredientLine('2 œufs')).toEqual({ name: 'œufs', qty: '2', unit: 'piece' });
		expect(parseIngredientLine('3 tomates bien mûres')).toEqual({
			name: 'tomates bien mûres',
			qty: '3',
			unit: 'piece'
		});
	});

	it('retire le mot de liaison entre la mesure et le produit', () => {
		expect(parseIngredientLine("400 g d'oignons")).toEqual({
			name: 'oignons',
			qty: '400',
			unit: 'g'
		});
		expect(parseIngredientLine('1 kg de la viande')?.name).toBe('viande');
		expect(parseIngredientLine('2 pièces du pain')?.name).toBe('pain');
	});

	it('lit les fractions, écrites en caractère unique ou en barre', () => {
		expect(parseIngredientLine('½ l de lait')).toEqual({ name: 'lait', qty: '0.5', unit: 'l' });
		expect(parseIngredientLine('1/4 l de vin')).toEqual({ name: 'vin', qty: '0.25', unit: 'l' });
		expect(parseIngredientLine('1 1/2 kg de pommes')).toEqual({
			name: 'pommes',
			qty: '1.5',
			unit: 'kg'
		});
		expect(parseIngredientLine('½ citron')).toEqual({ name: 'citron', qty: '0.5', unit: 'piece' });
	});

	it('reconnaît les unités déjà connues du modèle, abrégées ou non', () => {
		expect(parseIngredientLine('2 sachets de levure')).toEqual({
			name: 'levure',
			qty: '2',
			unit: 'bag'
		});
		expect(parseIngredientLine('1 boîte de tomates pelées')?.unit).toBe('box');
		expect(parseIngredientLine('3 tranches de jambon')?.unit).toBe('slice');
	});

	it('tolère le point d abréviation après l unité', () => {
		expect(parseIngredientLine('200 g. de sucre')).toEqual({
			name: 'sucre',
			qty: '200',
			unit: 'g'
		});
	});

	describe('le repli sur la ligne brute', () => {
		it('garde la ligne entière quand la mesure ne rentre pas dans le modèle', () => {
			expect(parseIngredientLine("2 cuillères à soupe d'huile d'olive")).toEqual({
				name: "2 cuillères à soupe d'huile d'olive",
				qty: '',
				unit: 'piece'
			});
			expect(parseIngredientLine('1 pincée de sel')?.name).toBe('1 pincée de sel');
			expect(parseIngredientLine("2 gousses d'ail")?.name).toBe("2 gousses d'ail");
			expect(parseIngredientLine('1 c. à soupe de moutarde')?.name).toBe(
				'1 c. à soupe de moutarde'
			);
		});

		it('garde la ligne entière quand elle ne commence pas par un nombre', () => {
			expect(parseIngredientLine('Sel et poivre')).toEqual({
				name: 'Sel et poivre',
				qty: '',
				unit: 'piece'
			});
			expect(parseIngredientLine('Un peu de persil')?.qty).toBe('');
		});

		it('garde la ligne entière quand il ne reste aucun nom après la mesure', () => {
			expect(parseIngredientLine('500 g')).toEqual({ name: '500 g', qty: '', unit: 'piece' });
			expect(parseIngredientLine('4')).toEqual({ name: '4', qty: '', unit: 'piece' });
		});

		it('ne prend pas un zéro pour une quantité', () => {
			expect(parseIngredientLine('0 g de sucre')?.qty).toBe('');
		});
	});

	it('traite un tiret de tête comme une puce et non comme un signe', () => {
		expect(parseIngredientLine('- 2 oignons')).toEqual({
			name: 'oignons',
			qty: '2',
			unit: 'piece'
		});
	});

	it('normalise les espaces et les puces laissées par les sites', () => {
		expect(parseIngredientLine('  •  600   g   de   courgettes  ')).toEqual({
			name: 'courgettes',
			qty: '600',
			unit: 'g'
		});
	});

	it('rend null pour une ligne vide', () => {
		expect(parseIngredientLine('')).toBeNull();
		expect(parseIngredientLine('   ')).toBeNull();
		expect(parseIngredientLine('  -  ')).toBeNull();
	});
});

describe('importedLines', () => {
	it('découpe une liste et écarte les lignes vides', () => {
		expect(importedLines(['600 g de courgettes', '', '2 œufs', '   '])).toEqual([
			{ name: 'courgettes', qty: '600', unit: 'g' },
			{ name: 'œufs', qty: '2', unit: 'piece' }
		]);
	});

	it('rend une liste vide pour une liste vide', () => {
		expect(importedLines([])).toEqual([]);
	});
});

describe('parseImportedServings', () => {
	it('lit le nombre de parts sous ses écritures courantes', () => {
		expect(parseImportedServings('4 personnes')).toBe(4);
		expect(parseImportedServings('6')).toBe(6);
		expect(parseImportedServings('Pour 8 parts')).toBe(8);
		expect(parseImportedServings('4 à 6 personnes')).toBe(4);
	});

	it('rend null quand rien n est lisible ou que le nombre est absurde', () => {
		expect(parseImportedServings(null)).toBeNull();
		expect(parseImportedServings('')).toBeNull();
		expect(parseImportedServings('un gratin')).toBeNull();
		expect(parseImportedServings('0 personne')).toBeNull();
		expect(parseImportedServings('500 personnes')).toBeNull();
	});
});

describe('importErrorOf', () => {
	it('garde un motif connu', () => {
		expect(importErrorOf('no_recipe')).toBe('no_recipe');
		expect(importErrorOf('private_host')).toBe('private_host');
	});

	it('ramène tout le reste à une panne', () => {
		expect(importErrorOf('boom')).toBe('unreachable');
		expect(importErrorOf(undefined)).toBe('unreachable');
		expect(importErrorOf(42)).toBe('unreachable');
	});
});
