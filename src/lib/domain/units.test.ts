import { describe, expect, it } from 'vitest';
import {
	DEFAULT_UNIT,
	UNIT_GROUPS,
	UNITS,
	resolveUnit,
	unitGroupOf,
	unitKey,
	unitsOf
} from './units';

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

describe('UNIT_GROUPS', () => {
	it('range chaque unité dans une famille et une seule', () => {
		const rangees = UNIT_GROUPS.flatMap((groupe) => groupe.units as readonly string[]);

		expect([...rangees].sort()).toEqual([...UNITS].sort());
		expect(new Set(rangees).size).toBe(rangees.length);
	});

	// Dix conditionnements, c'est déjà beaucoup à lire d'un coup ; au-delà, la famille se scinde.
	it('ne propose jamais plus de dix choix à la fois', () => {
		for (const groupe of UNIT_GROUPS) expect(groupe.units.length).toBeLessThanOrEqual(10);
	});
});

describe('unitGroupOf', () => {
	it('retrouve la famille d’une unité connue', () => {
		expect(unitGroupOf('kg')).toBe('weight');
		expect(unitGroupOf('ml')).toBe('volume');
		expect(unitGroupOf('bottle')).toBe('pack');
		expect(unitGroupOf('piece')).toBe('count');
	});

	it('accepte ce qui a été saisi à la main', () => {
		expect(unitGroupOf('litres')).toBe('volume');
		expect(unitGroupOf('boîte')).toBe('pack');
	});

	// Un article importé avec une unité fantaisiste doit rester modifiable.
	it('retombe sur les pièces plutôt que d’échouer', () => {
		expect(unitGroupOf('douzaine')).toBe('count');
		expect(unitGroupOf('')).toBe('count');
		expect(unitGroupOf(null)).toBe('count');
	});
});

describe('unitsOf', () => {
	it('rend les unités de la famille demandée', () => {
		expect(unitsOf('weight')).toEqual(['g', 'kg']);
		expect(unitsOf('count')).toEqual(['piece']);
	});

	it('rend toujours une rangée non vide', () => {
		for (const groupe of UNIT_GROUPS) expect(unitsOf(groupe.id).length).toBeGreaterThan(0);
	});
});
