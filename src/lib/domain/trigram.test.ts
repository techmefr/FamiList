import { describe, expect, it } from 'vitest';
import { trigram } from './trigram';

describe('trigram', () => {
	it.each([
		['Carrefour', 'CAR'],
		['Casino', 'CAS'],
		['Leclerc', 'LEC'],
		['Lidl', 'LID'],
		['Intermarché', 'INT'],
		['Monoprix', 'MON'],
		['Auchan', 'AUC']
	])('donne les trois premières lettres de %j', (nom, attendu) => {
		expect(trigram(nom)).toBe(attendu);
	});

	it.each([
		['Super U', 'SUP'],
		['Grand Frais', 'GRA'],
		['  lidl  ', 'LID'],
		['8 à Huit', '8AH']
	])('ignore les espaces : %j donne %j', (nom, attendu) => {
		expect(trigram(nom)).toBe(attendu);
	});

	it.each([
		['E.Leclerc', 'ELE'],
		['Éco Marché', 'ECO'],
		['Cœur de Ville', 'COE'],
		["L'Épicerie", 'LEP']
	])('ignore la ponctuation et les accents : %j donne %j', (nom, attendu) => {
		expect(trigram(nom)).toBe(attendu);
	});

	it.each([
		['U', 'U'],
		['Bio', 'BIO'],
		['', '']
	])('ne complète pas un nom plus court que trois caractères : %j donne %j', (nom, attendu) => {
		expect(trigram(nom)).toBe(attendu);
	});

	/**
	 * Sans lettre ni chiffre, slugify ne rend rien. Une pastille vide n'apprend rien à personne :
	 * on retombe sur ce qui a été tapé.
	 */
	it.each([
		['###', '###'],
		['🛒', '🛒'],
		['🛒🥕🧀🍎', '🛒🥕🧀']
	])('garde le nom tel quel quand il ne reste rien à transcrire : %j donne %j', (nom, attendu) => {
		expect(trigram(nom)).toBe(attendu);
	});

	it('ne coupe jamais un emoji en deux', () => {
		expect([...trigram('🛒🥕🧀🍎')]).toHaveLength(3);
	});

	it('est stable si on le rappelle sur son propre résultat', () => {
		const une = trigram('Intermarché');
		expect(trigram(une)).toBe(une);
	});
});
