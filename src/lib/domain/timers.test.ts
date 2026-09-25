import { describe, expect, it } from 'vitest';
import { STALE_AFTER_MS, extendedEnd, isRinging, parseStoredTimers, remainingSeconds, timerLabel } from './timers';

const now = 1_000_000_000_000;
const timer = {
	id: 't1',
	recipeId: 'r1',
	recipeName: 'Gratin',
	stepIndex: 1,
	label: 'Enfourner',
	durationSeconds: 600,
	endsAt: now + 90_000
};

describe('timers', () => {
	it('compte le temps restant et sonne à la fin', () => {
		expect(remainingSeconds(timer, now)).toBe(90);
		expect(isRinging(timer, now)).toBe(false);
		expect(remainingSeconds(timer, now + 100_000)).toBe(0);
		expect(isRinging(timer, now + 90_000)).toBe(true);
	});

	it('ajoute une minute à la fin prévue, ou à maintenant s il sonne déjà', () => {
		expect(extendedEnd(timer, now)).toBe(now + 150_000);
		expect(extendedEnd(timer, now + 200_000)).toBe(now + 260_000);
	});

	it('raccourcit une étape longue pour l étiquette', () => {
		expect(timerLabel('  Cuire   à feu doux ')).toBe('Cuire à feu doux');
		const label = timerLabel('Faire revenir les oignons émincés dans le beurre jusqu à ce qu ils soient dorés');
		expect(label.length).toBeLessThanOrEqual(48);
		expect(label.endsWith('…')).toBe(true);
	});

	it('relit le stockage en écartant l invalide et l oublié', () => {
		const forgotten = { ...timer, id: 't2', endsAt: now - STALE_AFTER_MS - 1 };
		const broken = { ...timer, id: 3 };
		const tooLong = { ...timer, id: 't4', durationSeconds: 100_000 };

		expect(parseStoredTimers([timer, forgotten, broken, tooLong, null], now)).toEqual([timer]);
		expect(parseStoredTimers('nope', now)).toEqual([]);
	});
});
