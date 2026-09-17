import { browser } from '$app/environment';
import { hapticFor, toneFor, type Cue } from '$domain/cue';
import { vibrate } from '$native/haptics';
import { settings } from './settings.svelte';

/**
 * Sound and vibration, at the place of the gesture.
 *
 * A browser refuses to produce sound before the user's first gesture: the audio context is therefore born
 * on the first call, never on load, and merely resumes if it has been suspended (coming back from the
 * background on a phone). Everything is wrapped: feedback that fails must not take down the action that
 * asked for it.
 */
class Feedback {
	#context: AudioContext | null = null;

	play(cue: Cue) {
		if (!browser) return;

		if (settings.sound) this.#tone(cue);
		if (settings.haptics) void vibrate(hapticFor(cue));
	}

	#audio(): AudioContext | null {
		if (this.#context) return this.#context;

		const Ctor =
			window.AudioContext ??
			(window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!Ctor) return null;

		try {
			this.#context = new Ctor();
		} catch {
			return null;
		}

		return this.#context;
	}

	#tone(cue: Cue) {
		const context = this.#audio();
		if (!context) return;
		if (context.state === 'suspended') void context.resume();

		try {
			const { from, to, ms, gain, wave } = toneFor(cue);
			const start = context.currentTime;
			const end = start + ms / 1000;

			const oscillator = context.createOscillator();
			oscillator.type = wave;
			oscillator.frequency.setValueAtTime(from, start);
			if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(to, end);

			// Short attack and gradual fade: an oscillator cut dead makes a click.
			const envelope = context.createGain();
			envelope.gain.setValueAtTime(0, start);
			envelope.gain.linearRampToValueAtTime(gain, start + 0.012);
			envelope.gain.exponentialRampToValueAtTime(0.0001, end);

			oscillator.connect(envelope).connect(context.destination);
			oscillator.start(start);
			oscillator.stop(end + 0.02);
		} catch {
			// audio unavailable (tab in the background, browser policy)
		}
	}
}

export const feedback = new Feedback();
