import { browser } from '$app/environment';
import { hapticFor, toneFor, type Cue } from '$domain/cue';
import { vibrate } from '$native/haptics';
import { settings } from './settings.svelte';

/**
 * Son et vibration, à l'endroit du geste.
 *
 * Un navigateur refuse de produire du son avant le premier geste de l'utilisateur : le contexte
 * audio naît donc au premier appel, jamais au chargement, et se contente d'être relancé s'il a été
 * suspendu (retour d'arrière-plan sur téléphone). Tout est enveloppé : un retour sonore qui échoue
 * ne doit pas emporter l'action qui l'a demandé.
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

			// Attaque brève et extinction progressive : un oscillateur coupé net claque.
			const envelope = context.createGain();
			envelope.gain.setValueAtTime(0, start);
			envelope.gain.linearRampToValueAtTime(gain, start + 0.012);
			envelope.gain.exponentialRampToValueAtTime(0.0001, end);

			oscillator.connect(envelope).connect(context.destination);
			oscillator.start(start);
			oscillator.stop(end + 0.02);
		} catch {
			// audio indisponible (onglet en arrière-plan, politique du navigateur)
		}
	}
}

export const feedback = new Feedback();
