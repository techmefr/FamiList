import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { base32Decode, counterBytes, totpCounter, truncate } from './totp';

/**
 * Les vecteurs de la RFC 6238, secret « 12345678901234567890 » en SHA-1. Sans eux, un calcul faux
 * rendrait simplement un code refusé, et on croirait la deuxième étape cassée alors que c'est le
 * test qui l'est.
 */
const SECRET_RFC = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

const code = (secondes: number) => {
	const digest = createHmac('sha1', Buffer.from(base32Decode(SECRET_RFC)))
		.update(Buffer.from(counterBytes(totpCounter(secondes * 1000))))
		.digest();

	return truncate(new Uint8Array(digest), 8);
};

describe('base32Decode', () => {
	it('decode le secret tel qu il est affiche', () => {
		expect([...base32Decode('MZXW6===')]).toEqual([...Buffer.from('foo')]);
	});

	it('ignore les espaces, les tirets et la casse', () => {
		expect([...base32Decode('mzxw 6-')]).toEqual([...base32Decode('MZXW6')]);
	});

	it('refuse un caractere hors alphabet plutot que de rendre des octets faux', () => {
		expect(() => base32Decode('MZXW1')).toThrow(/base32/);
	});
});

describe('totpCounter', () => {
	it('compte les fenetres de trente secondes', () => {
		expect(totpCounter(0)).toBe(0n);
		expect(totpCounter(29_999)).toBe(0n);
		expect(totpCounter(30_000)).toBe(1n);
		expect(totpCounter(59_000_000_000)).toBe(1_966_666n);
	});
});

describe('counterBytes', () => {
	it('ecrit le compteur sur huit octets en gros-boutien', () => {
		expect([...counterBytes(1n)]).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
		expect([...counterBytes(0x0102030405060708n)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
	});
});

describe('les vecteurs de la RFC 6238', () => {
	it('rend les codes attendus', () => {
		expect(code(59)).toBe('94287082');
		expect(code(1_111_111_109)).toBe('07081804');
		expect(code(1_234_567_890)).toBe('89005924');
		expect(code(2_000_000_000)).toBe('69279037');
	});

	it('complete a gauche pour garder six chiffres', () => {
		expect(truncate(new Uint8Array([0, 0, 0, 0, 0]))).toHaveLength(6);
	});
});
