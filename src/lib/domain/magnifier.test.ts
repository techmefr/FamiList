import { describe, expect, it } from 'vitest';
import { digitalZoom, opticalZoom, viewFilter } from './magnifier';

describe('opticalZoom', () => {
	it('vaut 1 quand l objectif ne zoome pas', () => {
		expect(opticalZoom(3, null)).toBe(1);
	});

	it('ignore une plage vide annoncee par le pilote', () => {
		expect(opticalZoom(3, { min: 1, max: 1 })).toBe(1);
	});

	it('plafonne a ce que l objectif accepte', () => {
		expect(opticalZoom(5, { min: 1, max: 2 })).toBe(2);
	});

	it('respecte un plancher superieur a 1', () => {
		expect(opticalZoom(1, { min: 1.5, max: 4 })).toBe(1.5);
	});
});

describe('digitalZoom', () => {
	it('complete ce que l objectif n a pas pu donner', () => {
		expect(digitalZoom(5, 2)).toBe(2.5);
	});

	it('n agrandit pas davantage quand l objectif a tout donne', () => {
		expect(digitalZoom(3, 3)).toBe(1);
	});

	it('ne reduit jamais l image', () => {
		expect(digitalZoom(2, 4)).toBe(1);
	});

	it('porte tout le grossissement quand l objectif est fixe', () => {
		expect(digitalZoom(4, 1)).toBe(4);
	});
});

describe('viewFilter', () => {
	it('ne touche pas à l’image quand aucune aide n’est demandée', () => {
		expect(viewFilter({ contrast: false, brighten: false })).toBe('none');
	});

	it('éclaircit un peu quand la torche est logicielle', () => {
		expect(viewFilter({ contrast: false, brighten: true })).toBe(
			'brightness(1.35) contrast(1.05)'
		);
	});

	it('retire la couleur et écarte les gris en mode contraste', () => {
		expect(viewFilter({ contrast: true, brighten: false })).toBe('grayscale(1) contrast(1.9)');
	});

	// Le contraste fort remplace le léger de la torche : les cumuler bouchait les noirs.
	it('cumule les deux sans empiler deux contrastes', () => {
		expect(viewFilter({ contrast: true, brighten: true })).toBe(
			'brightness(1.35) grayscale(1) contrast(1.9)'
		);
	});
});
