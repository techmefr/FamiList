import { describe, expect, it } from 'vitest';
import { SCAN_FORMATS, normalizeFormat, normalizeValue, scanScale } from './scan-image';

describe('SCAN_FORMATS', () => {
	it('demande les formats que portent vraiment les cartes de fidélité', () => {
		expect(SCAN_FORMATS).toContain('code_128');
		expect(SCAN_FORMATS).toContain('ean_8');
		expect(SCAN_FORMATS).toContain('itf');
		expect(SCAN_FORMATS).toContain('upc_a');
	});
});

describe('normalizeFormat', () => {
	it.each([
		['QR_CODE', 'qr_code'],
		['qr_code', 'qr_code'],
		['EAN_13', 'ean_13'],
		['ean-13', 'ean_13'],
		['CODE_39', 'code_39'],
		['UPC_A', 'ean_13']
	])('ramène %s au format dessinable %s', (raw, expected) => {
		expect(normalizeFormat(raw)).toBe(expected);
	});

	it.each(['CODE_128', 'ITF', 'EAN_8', 'PDF_417', 'inconnu'])(
		'rend null pour %s, que la carte ne sait pas dessiner',
		(raw) => {
			expect(normalizeFormat(raw)).toBeNull();
		}
	);
});

describe('normalizeValue', () => {
	it('complète un UPC-A de douze chiffres en EAN-13', () => {
		expect(normalizeValue('012345678905', 'UPC_A')).toBe('0012345678905');
	});

	it('laisse la valeur intacte pour les autres formats', () => {
		expect(normalizeValue('012345678905', 'CODE_128')).toBe('012345678905');
		expect(normalizeValue('3560070976232', 'EAN_13')).toBe('3560070976232');
	});

	it("laisse intact un UPC-A qui n'a pas douze chiffres", () => {
		expect(normalizeValue('12345', 'UPC_A')).toBe('12345');
	});
});

describe('scanScale', () => {
	it('ne touche pas à une image déjà petite', () => {
		expect(scanScale(800, 600)).toBe(1);
		expect(scanScale(1600, 900)).toBe(1);
	});

	it('réduit une photo de téléphone sur son plus grand côté', () => {
		expect(scanScale(4032, 3024)).toBeCloseTo(1600 / 4032);
		expect(scanScale(3024, 4032)).toBeCloseTo(1600 / 4032);
	});

	it('ne divise pas par zéro sur une image vide', () => {
		expect(scanScale(0, 0)).toBe(1);
	});
});
