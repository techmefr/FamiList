import { describe, expect, it } from 'vitest';
import { readCrashOutcome } from './crash-outcome';

describe('readCrashOutcome', () => {
	it('reconnait le plafond quotidien', () => {
		expect(readCrashOutcome({ status: 'rate_limited' })).toEqual({ exhausted: true });
	});

	it('laisse le rapporteur parler apres un enregistrement ou un rejet ponctuel', () => {
		expect(readCrashOutcome({ status: 'recorded' }).exhausted).toBe(false);
		expect(readCrashOutcome({ status: 'throttled' }).exhausted).toBe(false);
		expect(readCrashOutcome({ status: 'ignored' }).exhausted).toBe(false);
	});

	it('ne s eteint pas sur une reponse qu il ne comprend pas', () => {
		expect(readCrashOutcome(null).exhausted).toBe(false);
		expect(readCrashOutcome('rate_limited').exhausted).toBe(false);
		expect(readCrashOutcome({}).exhausted).toBe(false);
	});
});
