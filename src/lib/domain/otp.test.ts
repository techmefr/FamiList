import { describe, expect, it } from 'vitest';
import {
	BACKUP_ALPHABET,
	backupCodesText,
	formatBackupCode,
	isCompleteBackupCode,
	isCompleteOtp,
	normalizeBackupCode,
	normalizeOtp
} from './otp';

describe('normalizeOtp', () => {
	it('garde les chiffres', () => {
		expect(normalizeOtp('123456')).toBe('123456');
	});

	it('écarte tout le reste', () => {
		expect(normalizeOtp('12 34-56')).toBe('123456');
		expect(normalizeOtp('code : 123 456')).toBe('123456');
	});

	it("survit à l'espace insécable des clients de messagerie", () => {
		expect(normalizeOtp('123 456')).toBe('123456');
	});

	it('coupe au-delà de six chiffres', () => {
		expect(normalizeOtp('1234567890')).toBe('123456');
	});

	it('rend une chaîne vide sans chiffre', () => {
		expect(normalizeOtp('abcdef')).toBe('');
	});
});

describe('isCompleteOtp', () => {
	it('reconnaît un code complet, même mal collé', () => {
		expect(isCompleteOtp(' 12-34-56 ')).toBe(true);
	});

	it('refuse un code trop court', () => {
		expect(isCompleteOtp('12345')).toBe(false);
	});
});

describe('normalizeBackupCode', () => {
	it('met en majuscules', () => {
		expect(normalizeBackupCode('abcdefghjk')).toBe('ABCDEFGHJK');
	});

	it('accepte le tiret de lecture', () => {
		expect(normalizeBackupCode('ABCDE-FGHJK')).toBe('ABCDEFGHJK');
	});

	it("laisse tomber ce que l'alphabet ne connaît pas", () => {
		// Ni O ni 1 ne sont dans l'alphabet : ce sont justement les caractères qu'on a exclus.
		expect(normalizeBackupCode('O1ABCDEFGHJK')).toBe('ABCDEFGHJK');
	});

	it('coupe au-delà de dix caractères', () => {
		expect(normalizeBackupCode('ABCDEFGHJKMNP')).toBe('ABCDEFGHJK');
	});

	it("n'invente rien à partir de rien", () => {
		expect(normalizeBackupCode('')).toBe('');
		expect(normalizeBackupCode('oui !')).toBe('');
	});
});

describe('isCompleteBackupCode', () => {
	it('reconnaît un code de dix caractères', () => {
		expect(isCompleteBackupCode('abcde-fghjk')).toBe(true);
	});

	it('refuse un code amputé', () => {
		expect(isCompleteBackupCode('ABCDEFGHJ')).toBe(false);
	});
});

describe('formatBackupCode', () => {
	it('coupe en deux moitiés de cinq', () => {
		expect(formatBackupCode('ABCDEFGHJK')).toBe('ABCDE-FGHJK');
	});

	it('laisse tel quel un code incomplet', () => {
		expect(formatBackupCode('ABC')).toBe('ABC');
	});
});

describe('backupCodesText', () => {
	it('met un code par ligne sous le titre', () => {
		const texte = backupCodesText(['ABCDEFGHJK', 'MNPQRSTVWX'], 'Codes de secours');

		expect(texte.split('\n')).toEqual([
			'Codes de secours',
			'',
			'ABCDE-FGHJK',
			'MNPQR-STVWX',
			''
		]);
	});
});

describe("l'alphabet", () => {
	it("n'a aucune lettre qui se confond à la lecture", () => {
		for (const interdit of ['O', 'I', 'L', 'U', '0', '1']) {
			expect(BACKUP_ALPHABET).not.toContain(interdit);
		}
	});

	it('ne répète aucun caractère', () => {
		expect(new Set(BACKUP_ALPHABET).size).toBe(BACKUP_ALPHABET.length);
	});
});
