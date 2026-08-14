import { describe, expect, it } from 'vitest';
import { code39, ean13, ean13CheckDigit, linearCode, normalizeEan13 } from './barcode';

const pattern = (elements: { width: number; dark: boolean }[]) =>
	elements.map((el) => (el.dark ? '1' : '0').repeat(el.width)).join('');

describe('ean13CheckDigit', () => {
	// Codes réels, clé vérifiable à la main.
	it.each([
		['400638133393', 1],
		['978020137962', 4],
		['501234567890', 0]
	])('%s -> %i', (twelve, expected) => {
		expect(ean13CheckDigit(twelve)).toBe(expected);
	});
});

describe('normalizeEan13', () => {
	it('complète douze chiffres avec leur clé', () => {
		expect(normalizeEan13('400638133393')).toBe('4006381333931');
	});

	it('accepte treize chiffres dont la clé est juste', () => {
		expect(normalizeEan13('4006381333931')).toBe('4006381333931');
	});

	it('refuse treize chiffres dont la clé est fausse', () => {
		expect(normalizeEan13('4006381333930')).toBeNull();
	});

	it('ignore les séparateurs de saisie', () => {
		expect(normalizeEan13('400 6381 33393')).toBe('4006381333931');
	});

	it('refuse une longueur qui ne peut pas former un EAN-13', () => {
		expect(normalizeEan13('12345')).toBeNull();
	});
});

describe('ean13', () => {
	it('encadre le code des gardes normalisées', () => {
		const bits = pattern(ean13('4006381333931')!);

		expect(bits.startsWith('101')).toBe(true);
		expect(bits.endsWith('101')).toBe(true);
		expect(bits.slice(45, 50)).toBe('01010');
	});

	it('produit les 95 modules de la norme', () => {
		expect(pattern(ean13('4006381333931')!)).toHaveLength(95);
	});

	it('code le premier chiffre par l alternance des jeux, sans le dessiner', () => {
		// Deux codes qui ne diffèrent que par leur premier chiffre doivent donner des tracés
		// différents, sinon le lecteur lirait le même produit.
		expect(pattern(ean13('400638133393')!)).not.toBe(pattern(ean13('500638133393')!));
	});

	it('rend null sur une saisie non conforme', () => {
		expect(ean13('pas un code')).toBeNull();
	});
});

describe('code39', () => {
	it('encadre la donnée du caractère de départ et d arrêt', () => {
		// « * » occupe 15 modules : six étroits et trois larges.
		const STAR = 15;
		const bits = pattern(code39('A'));
		const star = pattern(code39('')).slice(0, STAR);

		expect(bits.slice(0, STAR)).toBe(star);
		expect(bits.slice(-STAR)).toBe(star);
	});

	it('ignore les caractères hors alphabet plutôt que de produire un code faux', () => {
		expect(pattern(code39('AB'))).toBe(pattern(code39('A@B')));
	});

	it('traite la saisie sans tenir compte de la casse', () => {
		expect(pattern(code39('abc'))).toBe(pattern(code39('ABC')));
	});
});

describe('linearCode', () => {
	it('refuse de dessiner un EAN-13 invalide en Code 39', () => {
		// Sinon le code scannerait, mais renverrait une donnée qui n est pas celle de la carte.
		expect(linearCode('12345', 'ean_13')).toBeNull();
	});

	it('rend le Code 39 pour les autres formats', () => {
		expect(linearCode('9352004421', 'code_39')).not.toBeNull();
	});
});
