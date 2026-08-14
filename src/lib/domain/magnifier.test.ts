import { describe, expect, it } from 'vitest';
import { clampZoom, digitalZoom, opticalZoom, ZOOM_MAX, ZOOM_MIN } from './magnifier';

describe('clampZoom', () => {
	it('reste dans les bornes', () => {
		expect(clampZoom(0.2)).toBe(ZOOM_MIN);
		expect(clampZoom(12)).toBe(ZOOM_MAX);
		expect(clampZoom(2.5)).toBe(2.5);
	});

	it('arrondit au dixième', () => {
		expect(clampZoom(2.34)).toBe(2.3);
		expect(clampZoom(2.36)).toBe(2.4);
	});

	it('retombe au minimum sur une valeur inexploitable', () => {
		expect(clampZoom(Number.NaN)).toBe(ZOOM_MIN);
		expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(ZOOM_MIN);
	});
});

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
