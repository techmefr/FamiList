import { describe, expect, it } from 'vitest';
import { CRASH_REPEAT_DELAY_MS, CRASH_SESSION_LIMIT, CrashThrottle } from './crash-throttle';

describe('CrashThrottle', () => {
	it('laisse passer une empreinte inedite', () => {
		expect(new CrashThrottle().allow('aaaa', 0)).toBe(true);
	});

	it('retient une boucle qui leve cinq cents fois la meme erreur', () => {
		const throttle = new CrashThrottle();
		let passes = 0;

		for (let tour = 0; tour < 500; tour += 1) {
			if (throttle.allow('aaaa', tour)) passes += 1;
		}

		expect(passes).toBe(1);
	});

	it('laisse repartir la meme empreinte une fois le delai ecoule', () => {
		const throttle = new CrashThrottle();

		expect(throttle.allow('aaaa', 0)).toBe(true);
		expect(throttle.allow('aaaa', CRASH_REPEAT_DELAY_MS - 1)).toBe(false);
		expect(throttle.allow('aaaa', CRASH_REPEAT_DELAY_MS)).toBe(true);
	});

	it('plafonne le nombre d empreintes distinctes sur la session', () => {
		const throttle = new CrashThrottle();
		let passes = 0;

		for (let index = 0; index < CRASH_SESSION_LIMIT + 5; index += 1) {
			if (throttle.allow(`print-${index}`, 0)) passes += 1;
		}

		expect(passes).toBe(CRASH_SESSION_LIMIT);
	});

	it('se tait definitivement une fois arrete', () => {
		const throttle = new CrashThrottle();
		throttle.stop();

		expect(throttle.stopped).toBe(true);
		expect(throttle.allow('aaaa', 0)).toBe(false);
		expect(throttle.allow('bbbb', 10_000_000)).toBe(false);
	});
});
