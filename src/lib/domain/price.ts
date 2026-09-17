import { slugify } from './slug';

/**
 * A price recorded once, for a product and in a shop.
 *
 * There is no product catalogue: items are typed by hand, list after list. What makes "the same product"
 * from one week to the next is therefore the slug of the name — exactly the one already used to remember
 * the order of products in an aisle (`shop_item_orders`) and which exists in the database as a generated
 * column on `items`. A third way of identifying would give two products where the application sees one.
 *
 * The name is kept beside the slug because a slug cannot be read: "semi-skimmed-milk" is not what we want
 * to display, and the original name cannot be rebuilt from the slug.
 */
export interface PriceEntry {
	id: string;
	shopId: string;
	productSlug: string;
	productName: string;
	amount: number;
	currency: string;
	recordedAt: number;
}

export const DEFAULT_CURRENCY = 'EUR';

/**
 * The currency we offer according to the display language.
 *
 * It is an acknowledged approximation: a language is not a country, and English or Arabic cover several.
 * It only serves to pick a starting value — the currency is saved on each record, so a price noted while
 * travelling keeps its own forever and a language change rewrites nothing.
 */
const CURRENCY_BY_LANGUAGE: Record<string, string> = {
	fr: 'EUR',
	es: 'EUR',
	de: 'EUR',
	it: 'EUR',
	pt: 'EUR',
	en: 'GBP',
	ru: 'RUB',
	zh: 'CNY',
	mg: 'MGA',
	ar: 'MAD'
};

/** Accepts "fr" as well as "fr-CH": only the language is known to the table. */
export function currencyForLocale(locale: string): string {
	const language = locale.split('-')[0].toLowerCase();
	return CURRENCY_BY_LANGUAGE[language] ?? DEFAULT_CURRENCY;
}

/** A product's identity across lists and time. */
export const productSlug = (name: string) => slugify(name);

/**
 * Reads an amount typed on a keyboard.
 *
 * Comma and dot are both accepted: the decimal separator depends on the language, and a phone keyboard
 * does not always offer the one the locale would expect. Zero and negative amounts are refused — that is
 * not a price, and letting them through would make an unlucky keystroke the "cheapest" of the comparison.
 */
export function parseAmount(raw: string): number | null {
	const written = raw.trim().replace(/\s/g, '');
	if (written === '') return null;

	const parsed = Number(written.replace(/,/g, '.'));
	if (!Number.isFinite(parsed) || parsed <= 0) return null;

	// Two decimals: beyond that, the price displayed would no longer be the one typed.
	return Math.round(parsed * 100) / 100;
}

/**
 * The amount as written in the language being read. Neither the symbol nor the decimal separator is set
 * by hand: "1,50 €", "£1.50" and "١٫٥٠" all come out of the same call.
 *
 * A currency unknown to the environment must not make the price disappear: we then fall back on a bare
 * number followed by the code.
 */
export function formatAmount(amount: number, currency: string, locale: string): string {
	try {
		return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
	} catch {
		return `${new Intl.NumberFormat(locale).format(amount)} ${currency}`;
	}
}

/** The most recent record of a product in a given shop, if there is one. */
export function latestAt(entries: PriceEntry[], slug: string, shopId: string): PriceEntry | null {
	let best: PriceEntry | null = null;

	for (const entry of entries) {
		if (entry.productSlug !== slug || entry.shopId !== shopId) continue;
		if (!best || entry.recordedAt > best.recordedAt) best = entry;
	}

	return best;
}

/** Whether two timestamps fall on the same day, for the device looking. */
export function sameDay(a: number, b: number): boolean {
	const first = new Date(a);
	const second = new Date(b);

	return (
		first.getFullYear() === second.getFullYear() &&
		first.getMonth() === second.getMonth() &&
		first.getDate() === second.getDate()
	);
}

/**
 * What the household comes for: where this product costs least, today.
 *
 * One record per shop, the most recent — a price from six months ago has nothing more to say than last
 * week's, and stacking them would make a list where the same shop comes back. The result is sorted
 * cheapest first: that is the only reading the feature promises.
 *
 * Currencies cannot be compared without an exchange rate, which the application does not have. So we only
 * keep the most recent record's: a price noted once while travelling does not come and sit, as if it were
 * comparable, among everyday prices.
 */
export function compareShops(entries: PriceEntry[], slug: string): PriceEntry[] {
	const mine = entries.filter((entry) => entry.productSlug === slug);
	if (mine.length === 0) return [];

	const newest = mine.reduce((a, b) => (b.recordedAt > a.recordedAt ? b : a));

	const byShop = new Map<string, PriceEntry>();
	for (const entry of mine) {
		if (entry.currency !== newest.currency) continue;

		const kept = byShop.get(entry.shopId);
		if (!kept || entry.recordedAt > kept.recordedAt) byShop.set(entry.shopId, entry);
	}

	return [...byShop.values()].sort((a, b) => a.amount - b.amount || b.recordedAt - a.recordedAt);
}

export interface PricedProduct {
	slug: string;
	name: string;
	shopCount: number;
	best: PriceEntry;
}

/**
 * The products we know at least one price for, for the history screen.
 *
 * The displayed name is that of the most recent record: it is the last spelling used, and the one that
 * will be recognised. The order is alphabetical, the only one that lets a specific product be found
 * without looking twice.
 */
export function pricedProducts(entries: PriceEntry[]): PricedProduct[] {
	const slugs = [...new Set(entries.map((entry) => entry.productSlug))];

	return slugs
		.map((slug) => {
			const shops = compareShops(entries, slug);
			const newest = entries
				.filter((entry) => entry.productSlug === slug)
				.reduce((a, b) => (b.recordedAt > a.recordedAt ? b : a));

			return { slug, name: newest.productName, shopCount: shops.length, best: shops[0] ?? newest };
		})
		.sort((a, b) => a.slug.localeCompare(b.slug));
}
