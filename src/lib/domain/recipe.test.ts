import { describe, expect, it } from 'vitest';
import { generatedItems, parseQty, scaleQty, scalingFactor } from './recipe';
import type { RecipeLine } from './recipe';

const line = (name: string, qty = '', unit = 'piece'): RecipeLine => ({ name, qty, unit });

describe('parseQty', () => {
	it('lit un nombre écrit à la virgule', () => {
		expect(parseQty('1,5')).toBe(1.5);
	});

	it('lit un nombre écrit au point', () => {
		expect(parseQty('1.5')).toBe(1.5);
	});

	it('rend null sur un champ vide', () => {
		expect(parseQty('')).toBeNull();
		expect(parseQty('   ')).toBeNull();
		expect(parseQty(null)).toBeNull();
		expect(parseQty(undefined)).toBeNull();
	});

	it('rend null sur un texte qui n est pas un nombre', () => {
		expect(parseQty('une pincée')).toBeNull();
	});

	it('rend null sur zéro et sur un nombre négatif', () => {
		expect(parseQty('0')).toBeNull();
		expect(parseQty('-3')).toBeNull();
	});
});

describe('scalingFactor', () => {
	it('rend 1 quand on cuisine pour le nombre de parts écrit', () => {
		expect(scalingFactor(4, 4)).toBe(1);
	});

	it('double pour deux fois plus de convives', () => {
		expect(scalingFactor(4, 8)).toBe(2);
	});

	it('divise pour moins de convives', () => {
		expect(scalingFactor(4, 2)).toBe(0.5);
	});

	it('rend 1 plutôt qu une erreur sur des parts absurdes', () => {
		expect(scalingFactor(0, 4)).toBe(1);
		expect(scalingFactor(4, 0)).toBe(1);
		expect(scalingFactor(-4, 4)).toBe(1);
		expect(scalingFactor(Number.NaN, 4)).toBe(1);
	});
});

describe('scaleQty', () => {
	it('multiplie la quantité', () => {
		expect(scaleQty('400', 2)).toBe('800');
	});

	it('garde un entier entier', () => {
		expect(scaleQty('2', 0.5)).toBe('1');
	});

	it('arrondit à trois décimales plutôt que de rendre une traînée de chiffres', () => {
		expect(scaleQty('400', 1 / 3)).toBe('133.333');
	});

	it('accepte la virgule décimale', () => {
		expect(scaleQty('1,5', 2)).toBe('3');
	});

	it('laisse vide une quantité qui n en est pas une', () => {
		expect(scaleQty('', 2)).toBe('');
		expect(scaleQty('une pincée', 2)).toBe('');
	});
});

describe('generatedItems', () => {
	it('rend une ligne par ingrédient, à l échelle', () => {
		const produced = generatedItems([line('Pâtes', '400', 'g'), line('Œufs', '4')], 2, []);

		expect(produced).toEqual([
			{ name: 'Pâtes', qty: '800', unit: 'g' },
			{ name: 'Œufs', qty: '8', unit: 'piece' }
		]);
	});

	it('donne une quantité de 1 à un ingrédient qui n en porte pas', () => {
		expect(generatedItems([line('Sel')], 3, [])).toEqual([
			{ name: 'Sel', qty: '1', unit: 'piece' }
		]);
	});

	it('écarte ce que la liste contient déjà, quelle que soit la casse ou les accents', () => {
		expect(generatedItems([line('Tomates', '3'), line('Basilic')], 1, ['tomates'])).toEqual([
			{ name: 'Basilic', qty: '1', unit: 'piece' }
		]);
	});

	it('n ajoute qu une fois un ingrédient écrit deux fois dans la recette', () => {
		const produced = generatedItems([line('Oignon', '1'), line('oignon', '2')], 1, []);
		expect(produced).toHaveLength(1);
	});

	it('ignore les lignes laissées vides par le formulaire', () => {
		expect(generatedItems([line('  '), line('', '3')], 1, [])).toEqual([]);
	});

	it('retombe sur l unité par défaut quand aucune n est choisie', () => {
		expect(generatedItems([line('Lait', '1', '')], 1, [])[0].unit).toBe('piece');
	});
});
