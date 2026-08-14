import { describe, expect, it } from 'vitest';
import { guessAisleKind, FALLBACK_AISLE_KIND } from './guess-aisle';

describe('guessAisleKind', () => {
	it.each([
		['Tomates grappe', 'fruits'],
		['Salade batavia', 'fruits'],
		['Baguette tradition', 'boulangerie'],
		['Croissants', 'boulangerie'],
		['Lait demi-écrémé', 'laitier'],
		['Yaourts nature', 'laitier'],
		['Comté 18 mois', 'laitier'],
		['Œufs bio', 'laitier'],
		['oeufs de caille', 'laitier'],
		['Filets de cabillaud', 'viande'],
		['Saumon fumé', 'viande'],
		['Liquide vaisselle', 'maison'],
		['Dentifrice', 'maison']
	])('classe %j dans %j', (name, aisle) => {
		expect(guessAisleKind(name)).toBe(aisle);
	});

	it.each(['Bœuf haché', 'boeuf bourguignon', 'Steak de bœuf'])(
		'ne classe pas %j dans les produits laitiers à cause de « œuf »',
		(name) => {
			expect(guessAisleKind(name)).toBe('viande');
		}
	);

	it('retombe sur l’épicerie quand rien ne correspond', () => {
		expect(guessAisleKind('Bougie parfumée')).toBe(FALLBACK_AISLE_KIND);
	});

	it('ignore la casse', () => {
		expect(guessAisleKind('TOMATES')).toBe(guessAisleKind('tomates'));
	});
});
