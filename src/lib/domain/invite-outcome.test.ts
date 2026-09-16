import { describe, expect, it } from 'vitest';
import { readInviteOutcome } from './invite-outcome';

describe('readInviteOutcome', () => {
	it('rend le foyer rejoint', () => {
		expect(readInviteOutcome({ status: 'joined', household_id: 'f1' })).toEqual({
			householdId: 'f1',
			errorKey: null
		});
	});

	it('sépare le code refusé des tentatives épuisées', () => {
		expect(readInviteOutcome({ status: 'invalid' }).errorKey).toBe('household.errorCode');
		expect(readInviteOutcome({ status: 'rate_limited' }).errorKey).toBe(
			'household.errorTooManyAttempts'
		);
	});

	it('ne fait entrer personne sans identifiant de foyer', () => {
		expect(readInviteOutcome({ status: 'joined' })).toEqual({
			householdId: null,
			errorKey: 'household.errorUnknown'
		});
	});

	it('retombe sur le refus générique pour une réponse inattendue', () => {
		expect(readInviteOutcome(null).errorKey).toBe('household.errorUnknown');
		expect(readInviteOutcome('rejoint').errorKey).toBe('household.errorUnknown');
		expect(readInviteOutcome({ status: 'autre' }).errorKey).toBe('household.errorUnknown');
	});
});
