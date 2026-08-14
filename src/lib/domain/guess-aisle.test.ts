import { describe, expect, it } from 'vitest';
import { guessAisle, FALLBACK_AISLE } from './guess-aisle';

describe('guessAisle', () => {
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
		expect(guessAisle(name)).toBe(aisle);
	});

	it.each(['Bœuf haché', 'boeuf bourguignon', 'Steak de bœuf'])(
		'ne classe pas %j dans les produits laitiers à cause de « œuf »',
		(name) => {
			expect(guessAisle(name)).toBe('viande');
		}
	);

	it('retombe sur l’épicerie quand rien ne correspond', () => {
		expect(guessAisle('Bougie parfumée')).toBe(FALLBACK_AISLE);
	});

	it('ignore la casse', () => {
		expect(guessAisle('TOMATES')).toBe(guessAisle('tomates'));
	});
});
