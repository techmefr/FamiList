import { describe, expect, it } from 'vitest';
import { DEFAULT_UNIT, UNITS, resolveUnit, unitKey } from './units';

describe('resolveUnit', () => {
	it('reconnait un identifiant tel quel', () => {
		expect(resolveUnit('kg')).toBe('kg');
	});

	it('reconnait ce qui a ete saisi a la main avant la liste', () => {
		expect(resolveUnit('pièce')).toBe('piece');
		expect(resolveUnit('boîte')).toBe('box');
		expect(resolveUnit('rouleaux')).toBe('roll');
	});

	it('ignore la casse et les espaces autour', () => {
		expect(resolveUnit('  Litres ')).toBe('l');
	});

	it('rend null sur une valeur vide ou inconnue', () => {
		expect(resolveUnit('')).toBeNull();
		expect(resolveUnit('   ')).toBeNull();
		expect(resolveUnit(null)).toBeNull();
		expect(resolveUnit('douzaine')).toBeNull();
	});

	it('ne rapproche pas deux unites de volumes differents', () => {
		// 50 cl ramenes a 50 ml, ce serait dix fois moins sans que personne ne le voie.
		expect(resolveUnit('cl')).toBeNull();
	});

	it('propose une unite par defaut qui est bien de la liste', () => {
		expect(UNITS).toContain(DEFAULT_UNIT);
	});
});

describe('unitKey', () => {
	it('prefixe la clef de traduction', () => {
		expect(unitKey('paquet')).toBe('units.pack');
	});

	it('rend null pour laisser afficher le texte d origine', () => {
		expect(unitKey('douzaine')).toBeNull();
	});
});
