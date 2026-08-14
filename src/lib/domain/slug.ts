/**
 * Doit produire exactement le même résultat que public.slugify() en base, qui alimente la colonne
 * générée items.product_slug. La parité est couverte par slug.test.ts contre des valeurs relevées
 * sur la vraie base : toute divergence casserait l'ordre appris, qui est indexé par slug.
 */

/**
 * Caractères que la décomposition NFD ne sépare pas, mais que unaccent transcrit quand même.
 * Sans ça, « Bœuf haché » donnerait buf-hache côté client et boeuf-hache côté base.
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
