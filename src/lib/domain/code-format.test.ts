import { describe, expect, it } from 'vitest';
import { CODE_TYPES, guessCodeType, isMatrixFormat } from './code-format';

describe('guessCodeType', () => {
	it('reconnaît un EAN-13', () => {
		expect(guessCodeType('3017620422003')).toBe('ean_13');
	});

	it("tolère les espaces autour d'un EAN-13 sans en faire un autre format", () => {
		expect(guessCodeType('  3017620422003  ')).toBe('ean_13');
	});

	it('refuse treize chiffres mêlés à autre chose', () => {
		expect(guessCodeType('3017620422003-X')).not.toBe('ean_13');
	});

	it('reconnaît un Code 39 alphanumérique court', () => {
		expect(guessCodeType('ABC-123')).toBe('code_39');
		expect(guessCodeType('CARTE.FIDELITE')).toBe('code_39');
	});

	it('bascule en QR au-delà de vingt caractères', () => {
		expect(guessCodeType('A'.repeat(21))).toBe('qr_code');
	});

	it('bascule en QR sur un caractère hors alphabet Code 39', () => {
		expect(guessCodeType('café@2026')).toBe('qr_code');
	});

	it("traite les espaces autour de la saisie comme du bruit", () => {
		expect(guessCodeType('  ABC123  ')).toBe('code_39');
	});
});

describe('isMatrixFormat', () => {
	it('reconnaît les formats en deux dimensions', () => {
		expect(isMatrixFormat('qr_code')).toBe(true);
		expect(isMatrixFormat('data_matrix')).toBe(true);
		expect(isMatrixFormat('aztec')).toBe(true);
		expect(isMatrixFormat('pdf417')).toBe(true);
	});

	it('rejette les formats en barres', () => {
		expect(isMatrixFormat('ean_13')).toBe(false);
		expect(isMatrixFormat('code_39')).toBe(false);
	});
});

describe('CODE_TYPES', () => {
	it('liste les formats que la carte sait dessiner', () => {
		expect(CODE_TYPES).toEqual([
			'code_128',
			'code_39',
			'code_93',
			'ean_13',
			'ean_8',
			'itf',
			'qr_code'
		]);
	});

	it('contient tout format que la détection peut proposer', () => {
		// Proposer un format absent de la liste reviendrait à enregistrer une carte qu'on ne sait
		// pas redessiner.
		for (const value of ['3017620422003', 'ABC-123', 'café@2026']) {
			expect(CODE_TYPES).toContain(guessCodeType(value));
		}
	});
});
