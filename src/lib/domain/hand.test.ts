import { describe, expect, it } from 'vitest';
import { HANDS, isHand } from './hand';

describe('isHand', () => {
	it('accepte les deux mains', () => {
		expect(HANDS.every(isHand)).toBe(true);
	});

	it('rejette ce que la base pourrait renvoyer de travers', () => {
		expect(isHand('rtl')).toBe(false);
		expect(isHand('start')).toBe(false);
		expect(isHand('')).toBe(false);
		expect(isHand(null)).toBe(false);
		expect(isHand(undefined)).toBe(false);
	});
});
