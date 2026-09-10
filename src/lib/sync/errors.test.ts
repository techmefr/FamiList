import { describe, expect, it } from 'vitest';
import { describeError } from './errors';

describe('describeError', () => {
	it('prend le message d une Error', () => {
		expect(describeError(new Error('quota dépassé'))).toBe('quota dépassé');
	});

	it('retombe sur le nom quand le message est vide', () => {
		expect(describeError(new RangeError())).toBe('RangeError');
	});

	it('accepte une chaîne rejetée telle quelle', () => {
		expect(describeError('AbortError')).toBe('AbortError');
	});

	it('lit le message d un objet nu, comme en rendent Dexie et Supabase', () => {
		expect(describeError({ message: 'transaction avortée' })).toBe('transaction avortée');
	});

	it('dit toujours quelque chose, même sans rien à dire', () => {
		expect(describeError(undefined)).toBe('erreur inconnue');
		expect(describeError({})).toBe('erreur inconnue');
		expect(describeError({ message: 42 })).toBe('erreur inconnue');
	});
});
