/**
 * The chains a loyalty card is most often for, and how to recognise them.
 *
 * This is data: adding a brand, or a country's brands, is adding an entry, never touching the matching
 * below. The order matters only for ties — the well-known French chains come first because that is who
 * uses the app today.
 *
 * `color` is the chain's own colour, as a suggestion: it goes through `tintForWhiteText` like any other
 * tint, so a light brand colour comes out darker on the card rather than unreadable.
 *
 * `logo` is the extension point for real logos. Brand logos are trademarks: none is downloaded or linked
 * from a third party. An entry may point at a file shipped under `static/brands/` once its licence allows
 * it; until then the card draws a lettermark in the brand colour (`mark`, or the name's initials).
 */
export interface Brand {
	name: string;
	aliases: string[];
	color: string;
	mark?: string;
	logo?: string;
}

export const BRANDS: Brand[] = [
	{
		name: 'Carrefour',
		aliases: [
			'Carrefour Market',
			'Carrefour City',
			'Carrefour Express',
			'Carrefour Contact',
			'Carrefour Bio',
			'Carrefour Drive'
		],
		color: '#004E9F'
	},
	{
		name: 'E.Leclerc',
		aliases: ['Leclerc', 'Centre Leclerc', 'Leclerc Drive'],
		color: '#0066B3',
		mark: 'EL'
	},
	{
		name: 'Intermarché',
		aliases: ['Intermarché Super', 'Intermarché Hyper', 'Intermarché Express', 'Intermarché Contact'],
		color: '#E30613',
		mark: 'I'
	},
	{
		name: 'Auchan',
		aliases: ['My Auchan', 'Auchan Supermarché', 'Auchan Piéton', 'Auchan Drive'],
		color: '#E2001A'
	},
	{
		name: 'Super U',
		aliases: ['Hyper U', 'U Express', 'Marché U', 'Système U', 'Magasins U', 'Coopérative U'],
		color: '#D2001E',
		mark: 'U'
	},
	{ name: 'Lidl', aliases: [], color: '#0050AA' },
	{ name: 'Aldi', aliases: [], color: '#00205B' },
	{ name: 'Casino', aliases: ['Géant Casino', 'Petit Casino', 'Casino Shop'], color: '#00843D' },
	{ name: 'Monoprix', aliases: ['Monop', 'Monop Daily'], color: '#1A1A1A' },
	{ name: 'Franprix', aliases: [], color: '#E85D1A' },
	{ name: 'Cora', aliases: [], color: '#E30613' },
	{ name: 'Picard', aliases: [], color: '#1C3E8E' },
	{ name: 'Biocoop', aliases: [], color: '#5E9732' },
	{ name: 'Naturalia', aliases: [], color: '#4E9A2F' },
	{ name: 'Decathlon', aliases: [], color: '#0082C3' },
	{ name: 'Leroy Merlin', aliases: [], color: '#78BE20' },
	{ name: 'Castorama', aliases: [], color: '#0072BC' },
	{ name: 'Ikea', aliases: [], color: '#0058A3' },
	{ name: 'Fnac', aliases: [], color: '#E1A925' },
	{ name: 'Darty', aliases: [], color: '#E30613' },
	{ name: 'Cultura', aliases: [], color: '#6B2C91' },
	{ name: 'Gamm vert', aliases: ['Gammvert'], color: '#6CB33F' },
	{ name: 'Sephora', aliases: [], color: '#000000' }
];

/** Accents, case and punctuation do not tell two spellings of a brand apart: "e.leclerc" is "E Leclerc". */
export function normalizeBrand(value: string): string {
	return value
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

const TERMS = BRANDS.flatMap((brand) =>
	[brand.name, ...brand.aliases].map((term) => ({ brand, term: normalizeBrand(term) }))
);

/**
 * The brand a free text names, or null.
 *
 * The brand is matched as whole words anywhere in the text, so "Leclerc Vienne" or "Carte Carrefour de
 * maman" find their chain while "Interflora" does not find Intermarché. The longest term wins: "Carrefour
 * Market" before "Carrefour", "Géant Casino" before "Casino".
 */
export function findBrand(value: string | null | undefined): Brand | null {
	const text = normalizeBrand(value ?? '');
	if (!text) return null;

	const padded = ` ${text} `;
	let best: { brand: Brand; term: string } | null = null;
	for (const entry of TERMS) {
		if (!padded.includes(` ${entry.term} `)) continue;
		if (!best || entry.term.length > best.term.length) best = entry;
	}
	return best?.brand ?? null;
}

/**
 * The letters drawn in place of a logo: the brand's own `mark` when it has one, otherwise the first letter
 * of the first two words. Letters are taken whole, so a name written in another script keeps its character.
 */
export function monogram(name: string, brand?: Brand | null): string {
	if (brand?.mark) return brand.mark;
	const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
	return words
		.slice(0, 2)
		.map((word) => Array.from(word)[0].toLocaleUpperCase())
		.join('');
}
