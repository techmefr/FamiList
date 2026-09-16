import { slugify } from './slug';

/**
 * Le prix relevé une fois, pour un produit et dans un magasin.
 *
 * Il n'y a pas de catalogue de produits : les articles sont tapés à la main, liste après liste.
 * Ce qui fait « le même produit » d'une semaine sur l'autre, c'est donc le slug du nom — exactement
 * celui qui sert déjà à retenir l'ordre des produits dans un rayon (`shop_item_orders`) et qui
 * existe en base comme colonne générée sur `items`. Un troisième mode d'identification donnerait
 * deux produits là où l'application en voit un.
 *
 * Le nom est conservé à côté du slug parce qu'un slug ne se lit pas : « lait-demi-ecreme » n'est
 * pas ce qu'on veut afficher, et le nom d'origine ne se reconstruit pas depuis le slug.
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
 * La monnaie que l'on propose selon la langue d'affichage.
 *
 * C'est une approximation assumée : une langue n'est pas un pays, et l'anglais ou l'arabe en
 * couvrent plusieurs. Elle ne sert qu'à choisir une valeur de départ — la monnaie est enregistrée
 * sur chaque relevé, si bien qu'un prix noté en voyage garde la sienne pour toujours et qu'un
 * changement de langue ne réécrit rien.
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

/** Accepte aussi bien « fr » que « fr-CH » : seule la langue est connue de la table. */
export function currencyForLocale(locale: string): string {
	const language = locale.split('-')[0].toLowerCase();
	return CURRENCY_BY_LANGUAGE[language] ?? DEFAULT_CURRENCY;
}

/** L'identité d'un produit à travers les listes et le temps. */
export const productSlug = (name: string) => slugify(name);

/**
 * Lit un montant tapé au clavier.
 *
 * La virgule et le point sont acceptés tous les deux : le séparateur décimal dépend de la langue,
 * et un clavier de téléphone ne propose pas toujours celui qu'attendrait la locale. Zéro et les
 * montants négatifs sont refusés — ce n'est pas un prix, et les laisser passer ferait d'une frappe
 * malheureuse le « moins cher » de la comparaison.
 */
export function parseAmount(raw: string): number | null {
	const written = raw.trim().replace(/\s/g, '');
	if (written === '') return null;

	const parsed = Number(written.replace(/,/g, '.'));
	if (!Number.isFinite(parsed) || parsed <= 0) return null;

	// Deux décimales : au-delà, le prix affiché ne serait plus celui qui a été saisi.
	return Math.round(parsed * 100) / 100;
}

/**
 * Le montant tel qu'on l'écrit dans la langue lue. Ni le symbole ni le séparateur décimal ne sont
 * posés à la main : « 1,50 € », « £1.50 » et « ١٫٥٠ » sortent tous du même appel.
 *
 * Une monnaie inconnue de l'environnement ne doit pas faire disparaître le prix : on retombe alors
 * sur un nombre nu suivi du code.
 */
export function formatAmount(amount: number, currency: string, locale: string): string {
	try {
		return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
	} catch {
		return `${new Intl.NumberFormat(locale).format(amount)} ${currency}`;
	}
}

/** Le relevé le plus récent d'un produit dans un magasin donné, s'il y en a un. */
export function latestAt(entries: PriceEntry[], slug: string, shopId: string): PriceEntry | null {
	let best: PriceEntry | null = null;

	for (const entry of entries) {
		if (entry.productSlug !== slug || entry.shopId !== shopId) continue;
		if (!best || entry.recordedAt > best.recordedAt) best = entry;
	}

	return best;
}

/** Deux horodatages tombent-ils le même jour, pour l'appareil qui regarde. */
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
 * Ce que le foyer vient chercher : où ce produit coûte le moins cher, aujourd'hui.
 *
 * Un seul relevé par magasin, le plus récent — un prix d'il y a six mois n'a rien à dire de plus
 * que celui de la semaine dernière, et les empiler ferait une liste où le même magasin revient.
 * Le résultat est trié du moins cher au plus cher : c'est la seule lecture que la fonctionnalité
 * promet.
 *
 * Les monnaies ne se comparent pas entre elles sans taux de change, que l'application n'a pas. On
 * ne garde donc que celle du relevé le plus récent : un prix noté une fois en voyage ne vient pas
 * se ranger, comme s'il était comparable, au milieu des prix du quotidien.
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
 * Les produits dont on connaît au moins un prix, pour l'écran d'historique.
 *
 * Le nom affiché est celui du relevé le plus récent : c'est la dernière orthographe qu'on a
 * utilisée, et celle qu'on reconnaîtra. L'ordre est alphabétique, le seul qui laisse retrouver un
 * produit précis sans le chercher deux fois.
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
