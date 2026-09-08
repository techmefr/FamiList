import { describe, expect, it } from 'vitest';
import { communeFromAddress, trigramSource } from './place';
import { trigram } from './trigram';

describe('communeFromAddress', () => {
	it('lit la commune après le code postal', () => {
		expect(communeFromAddress('12 rue des Lilas, 01800 Meximieux')).toBe('Meximieux');
		expect(communeFromAddress('01120 Montluel')).toBe('Montluel');
	});

	it('accepte une adresse sur plusieurs lignes', () => {
		expect(communeFromAddress('Zone du Bois\n01800 Meximieux\nFrance')).toBe('Meximieux');
	});

	it('accepte un nom de commune en plusieurs mots', () => {
		expect(communeFromAddress('69100 Villeurbanne')).toBe('Villeurbanne');
		expect(communeFromAddress('3 place Croix-Rousse, 69004 Lyon 4e')).toBe('Lyon 4e');
	});

	// Sans code postal, le dernier morceau reste le plus probable.
	it('se rabat sur le dernier morceau', () => {
		expect(communeFromAddress('12 rue des Lilas, Meximieux')).toBe('Meximieux');
	});

	it('ne prend pas le pays pour une commune', () => {
		expect(communeFromAddress('12 rue des Lilas, Meximieux, France')).toBe('Meximieux');
	});

	// Un mauvais trigramme est pire que pas de trigramme : on ne devine pas.
	it('ne rend rien quand rien ne ressemble à une commune', () => {
		expect(communeFromAddress('12 rue des Lilas')).toBe('');
		expect(communeFromAddress('')).toBe('');
		expect(communeFromAddress(null)).toBe('');
		expect(communeFromAddress(undefined)).toBe('');
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
 * Le point de la manœuvre : les trigrammes que ça produit vraiment. Ces cas sont ceux qu'on lira
 * sur les pastilles, et c'est là qu'une régression se verrait.
 */
describe('trigramme d’un lieu', () => {
	const court = (place: Parameters<typeof trigramSource>[0], pris: string[] = []) =>
		trigram(trigramSource(place), pris);

	it('distingue deux magasins de la même enseigne', () => {
		const meximieux = court({ brand: 'Carrefour', name: 'Carrefour', address: '01800 Meximieux' });
		const miribel = court({ brand: 'Carrefour', name: 'Carrefour', address: '01700 Miribel' });

		expect(meximieux).toBe('CMX');
		// Dernière lettre du dernier mot : Meximieux donne X, Miribel donne L.
		expect(miribel).toBe('CML');
	});

	it('donne un trigramme lisible à un indépendant', () => {
		expect(court({ name: 'Salon Émilie' })).toBe('SEM');
		expect(court({ name: 'Boucherie Martin' })).toBe('BMN');
	});

	it('reste unique dans le foyer', () => {
		const place = { brand: 'Carrefour', name: 'Carrefour', address: '01800 Meximieux' };

		expect(court(place)).toBe('CMX');
		expect(court(place, ['CMX'])).not.toBe('CMX');
	});
});
