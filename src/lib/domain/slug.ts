/**
 * Must produce exactly the same result as public.slugify() in the database, which feeds the generated column
 * items.product_slug. Parity is covered by slug.test.ts against values taken from the real database: any
 * divergence would break the learned order, which is indexed by slug.
 */

/**
 * Characters that NFD decomposition does not separate, but that unaccent transcribes all the same. Without
 * this, "Bœuf haché" would give buf-hache on the client side and boeuf-hache on the database side.
 */
const LIGATURES: [RegExp, string][] = [
	[/œ/g, 'oe'],
	[/Œ/g, 'OE'],
	[/æ/g, 'ae'],
	[/Æ/g, 'AE'],
	[/ß/g, 'ss'],
	[/ø/g, 'o'],
	[/Ø/g, 'O'],
	[/đ|ð/g, 'd'],
	[/Đ|Ð/g, 'D'],
	[/ł/g, 'l'],
	[/Ł/g, 'L'],
	[/þ/g, 'th'],
	[/Þ/g, 'TH']
];

export function slugify(value: string): string {
	let normalized = String(value);

	for (const [pattern, replacement] of LIGATURES) {
		normalized = normalized.replace(pattern, replacement);
	}

	return normalized
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
