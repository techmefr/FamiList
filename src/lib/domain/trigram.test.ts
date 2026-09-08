import { describe, expect, it } from 'vitest';
import { trigram } from './trigram';

describe('trigram', () => {
	/**
	 * Le cas qui a dicté la règle : un magasin porte l'enseigne et la commune, et c'est la commune
	 * qui distingue. Trois lettres prises au début donneraient CAR à tous les Carrefour du coin.
	 */
	it.each([
		['Carrefour Meximieux', 'CMX'],
		['Carrefour Montluel', 'CML'],
		['Auchan Beynost', 'ABT'],
		['Grand Frais', 'GFS'],
		['Intermarché Contact', 'ICT']
	])('deux mots : les initiales et la dernière lettre — %j donne %j', (nom, attendu) => {
		expect(trigram(nom)).toBe(attendu);
	});

	it.each([
		['Super U Montluel', 'SUM'],
		['Carrefour Market Montluel', 'CML'],
		['8 à Huit', '8AH']
	])('trois mots ou plus : une initiale par mot — %j donne %j', (nom, attendu) => {
		expect(trigram(nom)).toBe(attendu);
	});

	it.each([
		['Carrefour', 'CAR'],
		['Casino', 'CAS'],
		['Leclerc', 'LEC'],
		['Lidl', 'LID'],
		['Monoprix', 'MON']
	])('un seul mot : ses trois premières lettres — %j donne %j', (nom, attendu) => {
		expect(trigram(nom)).toBe(attendu);
	});

	it.each([
		['E.Leclerc', 'ELC'],
		['Éco Marché', 'EME'],
		['Cœur de Ville', 'CDV'],
		// La dernière lettre d'« Épicerie » est un E, qui doublerait celui de la base : on passe au P.
		["L'Épicerie", 'LEP'],
		['  lidl  ', 'LID']
	])('ignore la ponctuation, les accents et les espaces — %j donne %j', (nom, attendu) => {
		expect(trigram(nom)).toBe(attendu);
	});

	/**
	 * « U » n'a pas de dernière lettre distincte de son initiale : SUU ne se lit pas. On complète
	 * alors depuis le nom, ce qui redonne la lecture attendue.
	 */
	it('ne double pas une lettre : Super U donne SUP', () => {
		expect(trigram('Super U')).toBe('SUP');
	});

	it.each([
		['U', 'U'],
		['Bio', 'BIO'],
		['', '']
	])('ne complète pas un nom plus court que trois caractères — %j donne %j', (nom, attendu) => {
		expect(trigram(nom)).toBe(attendu);
	});

	it.each([
		['###', '###'],
		['🛒', '🛒'],
		['🛒🥕🧀🍎', '🛒🥕🧀']
	])('garde le nom tel quel quand il n’y a rien à transcrire — %j donne %j', (nom, attendu) => {
		expect(trigram(nom)).toBe(attendu);
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
	 * Les lettres de repli viennent de la commune, pas de l'enseigne : c'est elle qui distingue,
	 * et un CMA pris dans « Carrefour » n'apprendrait rien.
	 */
	it('tire les lettres de repli du dernier mot', () => {
		expect(trigram('Carrefour Miribel', ['CML'])).toBe('CMI');
		expect(trigram('Carrefour Miribel', ['CML', 'CMI'])).toBe('CMR');
	});

	it('donne un trigramme distinct à chaque magasin d’une même enseigne', () => {
		const noms = [
			'Carrefour Meximieux',
			'Carrefour Montluel',
			'Carrefour Miribel',
			'Carrefour Massieux',
			'Carrefour Mionnay'
		];

		const pris: string[] = [];
		for (const nom of noms) pris.push(trigram(nom, pris));

		expect(pris).toEqual(['CMX', 'CML', 'CMI', 'CMA', 'CMY']);
		expect(new Set(pris).size).toBe(noms.length);
	});

	it('numérote en dernier recours, quand toutes les lettres du nom sont prises', () => {
		const toutes: string[] = [];
		for (let i = 0; i < 12; i += 1) toutes.push(trigram('Bio', toutes));

		expect(toutes.slice(0, 3)).toEqual(['BIO', 'BI2', 'BI3']);
		expect(new Set(toutes.slice(0, 9)).size).toBe(9);
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

		// Une pastille en doublon dit encore de quelle enseigne il s'agit ; une pastille vide, non.
		expect(trigram('Bio', [...tout])).toBe('BIO');
	});
});
