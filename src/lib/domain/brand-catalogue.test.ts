import { describe, expect, it } from 'vitest';
import { BRANDS, findBrand, monogram, normalizeBrand } from './brand-catalogue';
import { contrastWithWhite, parseHex, tintForWhiteText } from './tint';

describe('normalizeBrand', () => {
	it('ignore accents, casse et ponctuation', () => {
		expect(normalizeBrand('E.Leclerc')).toBe('e leclerc');
		expect(normalizeBrand('  INTERMARCHÉ  ')).toBe('intermarche');
		expect(normalizeBrand("Monop'")).toBe('monop');
	});
});

describe('findBrand', () => {
	it('reconnait une enseigne quelle que soit son ecriture', () => {
		expect(findBrand('intermarche')?.name).toBe('Intermarché');
		expect(findBrand('E LECLERC')?.name).toBe('E.Leclerc');
		expect(findBrand('leclerc')?.name).toBe('E.Leclerc');
	});

	it('trouve l enseigne au milieu d un nom de magasin', () => {
		expect(findBrand('Leclerc Vienne')?.name).toBe('E.Leclerc');
		expect(findBrand('Carte Carrefour de maman')?.name).toBe('Carrefour');
		expect(findBrand('Hyper U Meximieux')?.name).toBe('Super U');
	});

	it('prefere le terme le plus long', () => {
		expect(findBrand('Géant Casino Lyon')?.name).toBe('Casino');
		expect(findBrand('Carrefour Market')?.name).toBe('Carrefour');
	});

	it('ne prend pas un mot qui ne fait que commencer comme une enseigne', () => {
		expect(findBrand('Interflora')).toBeNull();
		expect(findBrand('Lidlou')).toBeNull();
	});

	it('rend null sur un texte vide ou inconnu', () => {
		expect(findBrand('')).toBeNull();
		expect(findBrand(null)).toBeNull();
		expect(findBrand('Piscine municipale')).toBeNull();
	});
});

describe('monogram', () => {
	it('prend la marque de l enseigne quand elle en a une', () => {
		expect(monogram('E.Leclerc', findBrand('Leclerc'))).toBe('EL');
	});

	it('prend les initiales des deux premiers mots sinon', () => {
		expect(monogram('Carrefour')).toBe('C');
		expect(monogram('carte piscine du centre')).toBe('CP');
		expect(monogram('بطاقة المكتبة')).toBe('با');
	});
});

describe('BRANDS', () => {
	it('donne a chaque enseigne une couleur lisible sous du texte blanc une fois ajustee', () => {
		for (const brand of BRANDS) {
			expect(parseHex(brand.color), brand.name).not.toBeNull();
			const shown = parseHex(tintForWhiteText(brand.color))!;
			expect(contrastWithWhite(shown), brand.name).toBeGreaterThanOrEqual(4.5);
		}
	});

	it('ne donne un meme terme qu a une seule enseigne', () => {
		const terms = BRANDS.flatMap((brand) => [brand.name, ...brand.aliases].map(normalizeBrand));
		expect(new Set(terms).size).toBe(terms.length);
	});

	it('ne pointe vers aucun logo distant', () => {
		for (const brand of BRANDS) {
			if (brand.logo) expect(brand.logo.startsWith('/brands/'), brand.name).toBe(true);
		}
	});
});
