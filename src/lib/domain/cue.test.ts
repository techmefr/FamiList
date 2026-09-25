import { describe, expect, it } from 'vitest';
import { CUES, hapticFor, TONE_MAX_GAIN, TONE_MAX_MS, toneFor } from './cue';

describe('cue', () => {
	it('couvre les huit retours, sans doublon', () => {
		expect(CUES).toHaveLength(8);
		expect(new Set(CUES).size).toBe(CUES.length);
	});

	it('donne un son et une vibration a chaque retour', () => {
		for (const cue of CUES) {
			expect(toneFor(cue)).toBeDefined();
			expect(hapticFor(cue)).toBeDefined();
		}
	});

	it('garde des sons courts et discrets', () => {
		for (const cue of CUES) {
			const tone = toneFor(cue);

			expect(tone.ms).toBeGreaterThan(0);
			expect(tone.ms).toBeLessThanOrEqual(TONE_MAX_MS);
			expect(tone.gain).toBeGreaterThan(0);
			expect(tone.gain).toBeLessThanOrEqual(TONE_MAX_GAIN);
		}
	});

	/**
	 * A frequency of zero would forbid the player's exponential ramp, and above 4 kHz a beep becomes shrill —
	 * which the person ticking fifty items suffers first.
	 */
	it('reste dans une plage audible et supportable', () => {
		for (const cue of CUES) {
			const { from, to } = toneFor(cue);

			expect(from).toBeGreaterThanOrEqual(100);
			expect(to).toBeGreaterThanOrEqual(100);
			expect(from).toBeLessThanOrEqual(4000);
			expect(to).toBeLessThanOrEqual(4000);
		}
	});

	it('fait monter le son quand on prend, descendre quand on repose', () => {
		expect(toneFor('check').to).toBeGreaterThan(toneFor('check').from);
		expect(toneFor('uncheck').to).toBeLessThan(toneFor('uncheck').from);
		expect(toneFor('add').to).toBeGreaterThan(toneFor('add').from);
		expect(toneFor('remove').to).toBeLessThan(toneFor('remove').from);
	});

	it('reserve la vibration franche a l erreur', () => {
		expect(hapticFor('error')).toBe('heavy');
		expect(hapticFor('tap')).toBe('light');
		expect(hapticFor('check')).toBe('light');
	});
});
