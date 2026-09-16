import { describe, expect, it } from 'vitest';
import {
	compareShops,
	currencyForLocale,
	formatAmount,
	latestAt,
	parseAmount,
	pricedProducts,
	productSlug,
	sameDay
} from './price';
import type { PriceEntry } from './price';

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-16T10:00:00Z');

let counter = 0;

function entry(patch: Partial<PriceEntry> = {}): PriceEntry {
	counter += 1;

	return {
		id: `p${counter}`,
		shopId: 'shop-a',
		productSlug: 'lait-demi-ecreme',
		productName: 'Lait demi-écrémé',
		amount: 1.2,
		currency: 'EUR',
		recordedAt: NOW,
		...patch
	};
}

describe('productSlug', () => {
	it('rapproche deux orthographes du même produit', () => {
		expect(productSlug('Lait demi-écrémé')).toBe(productSlug('  LAIT DEMI-ECREME  '));
	});

	it('sépare deux produits différents', () => {
		expect(productSlug('Lait entier')).not.toBe(productSlug('Lait demi-écrémé'));
	});
});

describe('parseAmount', () => {
	it.each([
		['1,50', 1.5],
		['1.50', 1.5],
		[' 2 ', 2],
		['0,99', 0.99],
		['1,999', 2]
	])('lit %j comme %j', (raw, expected) => {
		expect(parseAmount(raw)).toBe(expected);
	});

	it.each(['', '   ', 'gratuit', '0', '-3', '1,2,3'])('refuse %j', (raw) => {
		expect(parseAmount(raw)).toBeNull();
	});
});

describe('currencyForLocale', () => {
	it.each([
		['fr', 'EUR'],
		['de', 'EUR'],
		['fr-CH', 'EUR'],
		['ru', 'RUB'],
		['zh', 'CNY'],
		['mg', 'MGA']
	])('propose %j pour %j', (locale, expected) => {
		expect(currencyForLocale(locale)).toBe(expected);
	});

	it('retombe sur l’euro pour une langue inconnue', () => {
		expect(currencyForLocale('ja')).toBe('EUR');
	});
});

describe('formatAmount', () => {
	it('suit la langue pour le séparateur et la place du symbole', () => {
		const fr = formatAmount(1.5, 'EUR', 'fr');
		const en = formatAmount(1.5, 'GBP', 'en-GB');

		expect(fr).toContain('1,50');
		expect(fr).not.toContain('1.50');
		expect(en).toContain('1.50');
	});

	it('affiche quand même le montant avec une monnaie inconnue', () => {
		expect(formatAmount(1.5, 'XXXX', 'fr')).toContain('XXXX');
	});
});

describe('latestAt', () => {
	it('rend le relevé le plus récent du magasin', () => {
		const entries = [
			entry({ amount: 1.1, recordedAt: NOW - DAY }),
			entry({ amount: 1.4, recordedAt: NOW }),
			entry({ amount: 0.9, shopId: 'shop-b' })
		];

		expect(latestAt(entries, 'lait-demi-ecreme', 'shop-a')?.amount).toBe(1.4);
	});

	it('rend null quand ce magasin n’a rien relevé', () => {
		expect(latestAt([entry()], 'lait-demi-ecreme', 'shop-z')).toBeNull();
	});
});

describe('sameDay', () => {
	it('sépare deux jours', () => {
		expect(sameDay(NOW, NOW - DAY)).toBe(false);
	});

	it('réunit deux moments du même jour', () => {
		expect(sameDay(Date.parse('2026-09-16T08:00'), Date.parse('2026-09-16T21:30'))).toBe(true);
	});
});

describe('compareShops', () => {
	it('classe les magasins du moins cher au plus cher, un par magasin', () => {
		const entries = [
			entry({ shopId: 'shop-a', amount: 1.4, recordedAt: NOW }),
			entry({ shopId: 'shop-a', amount: 1.1, recordedAt: NOW - DAY }),
			entry({ shopId: 'shop-b', amount: 1.05 }),
			entry({ shopId: 'shop-c', amount: 2 })
		];

		expect(compareShops(entries, 'lait-demi-ecreme').map((e) => [e.shopId, e.amount])).toEqual([
			['shop-b', 1.05],
			['shop-a', 1.4],
			['shop-c', 2]
		]);
	});

	it('ignore les autres produits', () => {
		const entries = [entry(), entry({ productSlug: 'beurre', amount: 0.1 })];

		expect(compareShops(entries, 'lait-demi-ecreme')).toHaveLength(1);
	});

	it('ne mélange pas deux monnaies faute de taux de change', () => {
		const entries = [
			entry({ shopId: 'shop-a', amount: 1.2, recordedAt: NOW }),
			entry({ shopId: 'shop-b', amount: 0.9, currency: 'GBP', recordedAt: NOW - DAY })
		];

		expect(compareShops(entries, 'lait-demi-ecreme').map((e) => e.shopId)).toEqual(['shop-a']);
	});

	it('rend une liste vide pour un produit jamais relevé', () => {
		expect(compareShops([entry()], 'pain')).toEqual([]);
	});
});

describe('pricedProducts', () => {
	it('range les produits et retient la dernière orthographe', () => {
		const entries = [
			entry({ productSlug: 'pain', productName: 'pain', amount: 1, recordedAt: NOW - DAY }),
			entry({ productSlug: 'pain', productName: 'Pain de campagne', amount: 1.3 }),
			entry({ shopId: 'shop-a', amount: 1.2 }),
			entry({ shopId: 'shop-b', amount: 0.95 })
		];

		const produits = pricedProducts(entries);

		expect(produits.map((p) => p.slug)).toEqual(['lait-demi-ecreme', 'pain']);
		expect(produits[1].name).toBe('Pain de campagne');
		expect(produits[0].shopCount).toBe(2);
		expect(produits[0].best.amount).toBe(0.95);
	});

	it('rend une liste vide sans aucun relevé', () => {
		expect(pricedProducts([])).toEqual([]);
	});
});
