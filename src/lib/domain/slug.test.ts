import { describe, expect, it } from 'vitest';
import { slugify } from './slug';

/**
 * Expected values taken from the real database, by calling public.slugify(). Regenerate them with:
 *   select v, public.slugify(v) from (values ('Bœuf haché'), ...) as t(v);
 * The learned order being indexed by slug, a divergence would empty it silently.
 */
describe('slugify — parité avec public.slugify()', () => {
	it.each([
		['Tomates grappe', 'tomates-grappe'],
		['Lait demi-écrémé', 'lait-demi-ecreme'],
		['Huile d’olive', 'huile-d-olive'],
		['  Yaourts   NATURE  ', 'yaourts-nature'],
		['Comté 18 mois', 'comte-18-mois'],
		['Œufs bio', 'oeufs-bio'],
		['Bœuf haché', 'boeuf-hache'],
		['Pâtes & riz', 'pates-riz'],
		['Crème fraîche', 'creme-fraiche'],
		['Weißbier', 'weissbier'],
		['Ærø', 'aero'],
		['---', ''],
		['', '']
	])('transforme %j en %j', (input, expected) => {
		expect(slugify(input)).toBe(expected);
	});

	it('est idempotente', () => {
		const once = slugify('Lait demi-écrémé');
		expect(slugify(once)).toBe(once);
	});

	it('ne distingue pas les apostrophes typographiques des droites', () => {
		expect(slugify('Huile d’olive')).toBe(slugify("Huile d'olive"));
	});
});
