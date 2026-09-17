import { describe, expect, it } from 'vitest';
import { townFromAddress, trigramSource } from './place';
import { trigram } from './trigram';

describe('communeFromAddress', () => {
	it('lit la commune après le code postal', () => {
		expect(townFromAddress('12 rue des Lilas, 01800 Meximieux')).toBe('Meximieux');
		expect(townFromAddress('01120 Montluel')).toBe('Montluel');
	});

	it('accepte une adresse sur plusieurs lignes', () => {
		expect(townFromAddress('Zone du Bois\n01800 Meximieux\nFrance')).toBe('Meximieux');
	});

	it('accepte un nom de commune en plusieurs mots', () => {
		expect(townFromAddress('69100 Villeurbanne')).toBe('Villeurbanne');
		expect(townFromAddress('3 place Croix-Rousse, 69004 Lyon 4e')).toBe('Lyon 4e');
	});

	// With no postcode, the last piece stays the most likely.
	it('se rabat sur le dernier morceau', () => {
		expect(townFromAddress('12 rue des Lilas, Meximieux')).toBe('Meximieux');
	});

	it('ne prend pas le pays pour une commune', () => {
		expect(townFromAddress('12 rue des Lilas, Meximieux, France')).toBe('Meximieux');
	});

	// A wrong three-letter code is worse than none: we do not guess.
	it('ne rend rien quand rien ne ressemble à une commune', () => {
		expect(townFromAddress('12 rue des Lilas')).toBe('');
		expect(townFromAddress('')).toBe('');
		expect(townFromAddress(null)).toBe('');
		expect(townFromAddress(undefined)).toBe('');
	});
});

describe('trigramSource', () => {
	it('assemble l’enseigne et la commune pour une chaîne', () => {
		expect(
			trigramSource({ brand: 'Carrefour', name: 'Carrefour', address: '01800 Meximieux' })
		).toBe('Carrefour Meximieux');
	});

	it('se contente du nom pour un indépendant', () => {
		expect(trigramSource({ name: 'Salon Émilie' })).toBe('Salon Émilie');
	});

	it('ajoute la commune d’un indépendant quand elle est connue', () => {
		expect(trigramSource({ name: 'Boucherie Martin', address: '69004 Lyon' })).toBe(
			'Boucherie Martin Lyon'
		);
	});

	it('ignore une enseigne vide', () => {
		expect(trigramSource({ brand: '   ', name: 'Le Fournil', address: '01120 Montluel' })).toBe(
			'Le Fournil Montluel'
		);
	});
});

/*
 * The point of the exercise: the three-letter codes it really produces. These cases are the ones that will
 * be read on the chips, and that is where a regression would show.
 */
describe('trigramme d’un lieu', () => {
	const short = (place: Parameters<typeof trigramSource>[0], taken: string[] = []) =>
		trigram(trigramSource(place), taken);

	it('distingue deux magasins de la même enseigne', () => {
		const meximieux = short({ brand: 'Carrefour', name: 'Carrefour', address: '01800 Meximieux' });
		const miribel = short({ brand: 'Carrefour', name: 'Carrefour', address: '01700 Miribel' });

		expect(meximieux).toBe('CMX');
		// Last letter of the last word: Meximieux gives X, Miribel gives L.
		expect(miribel).toBe('CML');
	});

	it('donne un trigramme lisible à un indépendant', () => {
		expect(short({ name: 'Salon Émilie' })).toBe('SEM');
		expect(short({ name: 'Boucherie Martin' })).toBe('BMN');
	});

	it('reste unique dans le foyer', () => {
		const place = { brand: 'Carrefour', name: 'Carrefour', address: '01800 Meximieux' };

		expect(short(place)).toBe('CMX');
		expect(short(place, ['CMX'])).not.toBe('CMX');
	});
});
