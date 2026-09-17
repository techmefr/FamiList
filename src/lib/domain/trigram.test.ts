import { describe, expect, it } from 'vitest';
import { trigram } from './trigram';

describe('trigram', () => {
	/**
	 * The case that dictated the rule: a shop carries the brand and the town, and it is the town that tells
	 * them apart. Three letters taken from the start would give CAR to every Carrefour around.
	 */
	it.each([
		['Carrefour Meximieux', 'CMX'],
		['Carrefour Montluel', 'CML'],
		['Auchan Beynost', 'ABT'],
		['Grand Frais', 'GFS'],
		['Intermarché Contact', 'ICT']
	])('deux mots : les initiales et la dernière lettre — %j donne %j', (name, expected) => {
		expect(trigram(name)).toBe(expected);
	});

	it.each([
		['Super U Montluel', 'SUM'],
		['Carrefour Market Montluel', 'CML'],
		['8 à Huit', '8AH']
	])('trois mots ou plus : une initiale par mot — %j donne %j', (name, expected) => {
		expect(trigram(name)).toBe(expected);
	});

	it.each([
		['Carrefour', 'CAR'],
		['Casino', 'CAS'],
		['Leclerc', 'LEC'],
		['Lidl', 'LID'],
		['Monoprix', 'MON']
	])('un seul mot : ses trois premières lettres — %j donne %j', (name, expected) => {
		expect(trigram(name)).toBe(expected);
	});

	it.each([
		['E.Leclerc', 'ELC'],
		['Éco Marché', 'EME'],
		['Cœur de Ville', 'CDV'],
		// The last letter of "Épicerie" is an E, which would double the one from the base: we move to the P.
		["L'Épicerie", 'LEP'],
		['  lidl  ', 'LID']
	])('ignore la ponctuation, les accents et les espaces — %j donne %j', (name, expected) => {
		expect(trigram(name)).toBe(expected);
	});

	/**
	 * "U" has no last letter distinct from its initial: SUU does not read. So we complete from the name,
	 * which gives back the expected reading.
	 */
	it('ne double pas une lettre : Super U donne SUP', () => {
		expect(trigram('Super U')).toBe('SUP');
	});

	it.each([
		['U', 'U'],
		['Bio', 'BIO'],
		['', '']
	])('ne complète pas un nom plus court que trois caractères — %j donne %j', (name, expected) => {
		expect(trigram(name)).toBe(expected);
	});

	it.each([
		['###', '###'],
		['🛒', '🛒'],
		['🛒🥕🧀🍎', '🛒🥕🧀']
	])('garde le nom tel quel quand il n’y a rien à transcrire — %j donne %j', (name, expected) => {
		expect(trigram(name)).toBe(expected);
	});

	it('ne coupe jamais un emoji en deux', () => {
		expect([...trigram('🛒🥕🧀🍎')]).toHaveLength(3);
	});
});

describe('trigram — unicité', () => {
	it('avance d’une lettre quand le trigramme est déjà pris', () => {
		expect(trigram('Carrefour Meximieux', ['CMX'])).toBe('CME');
	});

	/**
	 * The fallback letters come from the town, not from the brand: the town is what tells them apart, and a
	 * CMA taken from "Carrefour" would teach nothing.
	 */
	it('tire les lettres de repli du dernier mot', () => {
		expect(trigram('Carrefour Miribel', ['CML'])).toBe('CMI');
		expect(trigram('Carrefour Miribel', ['CML', 'CMI'])).toBe('CMR');
	});

	it('donne un trigramme distinct à chaque magasin d’une même enseigne', () => {
		const names = [
			'Carrefour Meximieux',
			'Carrefour Montluel',
			'Carrefour Miribel',
			'Carrefour Massieux',
			'Carrefour Mionnay'
		];

		const taken: string[] = [];
		for (const name of names) taken.push(trigram(name, taken));

		expect(taken).toEqual(['CMX', 'CML', 'CMI', 'CMA', 'CMY']);
		expect(new Set(taken).size).toBe(names.length);
	});

	it('numérote en dernier recours, quand toutes les lettres du nom sont prises', () => {
		const all: string[] = [];
		for (let i = 0; i < 12; i += 1) all.push(trigram('Bio', all));

		expect(all.slice(0, 3)).toEqual(['BIO', 'BI2', 'BI3']);
		expect(new Set(all.slice(0, 9)).size).toBe(9);
	});

	it('compare sans tenir compte de la casse ni des espaces', () => {
		expect(trigram('Carrefour Meximieux', [' cmx '])).toBe('CME');
	});

	it('ignore les entrées vides de la liste des trigrammes pris', () => {
		expect(trigram('Carrefour Meximieux', ['', '   '])).toBe('CMX');
	});

	it('rend le premier choix plutôt que rien quand tout est pris', () => {
		const tout = new Set<string>();
		for (let i = 0; i < 40; i += 1) tout.add(trigram('Bio', [...tout]));

		// A duplicate chip still says which brand it is; an empty chip does not.
		expect(trigram('Bio', [...tout])).toBe('BIO');
	});
});
