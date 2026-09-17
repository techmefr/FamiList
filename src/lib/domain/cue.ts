/**
 * Action feedback: a short sound, and the vibration going with it.
 *
 * The sounds are synthesised at runtime, not loaded. One file per action would mean network on the first
 * gesture in a shop with no coverage, and weight in the application, for a hundred milliseconds of beep. So
 * the timbres are described here in plain terms: that is also what makes them checkable without a browser.
 */
export type Cue = 'check' | 'uncheck' | 'add' | 'remove' | 'success' | 'error' | 'tap';

export interface Tone {
	/** Starting frequency, in hertz. */
	from: number;
	/** Ending frequency: a glide says "taken" or "put back" better than a held note. */
	to: number;
	ms: number;
	/** Peak volume, from 0 to 1. Deliberately low: this is used in a shop, next to somebody. */
	gain: number;
	wave: 'sine' | 'triangle' | 'square';
}

export type Haptic = 'light' | 'medium' | 'heavy';

/**
 * No sound lasts longer than a third of a second: above that, ticking ten items in a row turns the list into
 * a chime. The bounds are held by a test.
 */
export const TONE_MAX_MS = 300;
export const TONE_MAX_GAIN = 0.2;

const TONES: Record<Cue, Tone> = {
	check: { from: 660, to: 990, ms: 90, gain: 0.16, wave: 'sine' },
	uncheck: { from: 520, to: 390, ms: 90, gain: 0.1, wave: 'sine' },
	add: { from: 590, to: 780, ms: 110, gain: 0.14, wave: 'triangle' },
	remove: { from: 300, to: 190, ms: 130, gain: 0.12, wave: 'triangle' },
	success: { from: 700, to: 1180, ms: 220, gain: 0.16, wave: 'sine' },
	error: { from: 260, to: 200, ms: 260, gain: 0.18, wave: 'square' },
	tap: { from: 880, to: 880, ms: 40, gain: 0.07, wave: 'sine' }
};

const HAPTICS: Record<Cue, Haptic> = {
	check: 'light',
	uncheck: 'light',
	add: 'light',
	remove: 'medium',
	success: 'medium',
	error: 'heavy',
	tap: 'light'
};

export const CUES = Object.keys(TONES) as Cue[];

export const toneFor = (cue: Cue): Tone => TONES[cue];

export const hapticFor = (cue: Cue): Haptic => HAPTICS[cue];
