import { hear, type VoiceCommand, type VoiceVocabulary } from '$domain/voice-commands';
import { canListen, listen, type ListenSession } from '$native/voice';
import { feedback } from './feedback.svelte';

export type VoiceStatus = 'off' | 'starting' | 'listening' | 'awake' | 'denied' | 'unsupported' | 'failed';

export type LastHeard = { kind: 'command'; command: VoiceCommand } | { kind: 'unknown'; text: string } | null;

/** How long "Famy" alone keeps the ear open for the command that follows. */
const AWAKE_MS = 8000;

/**
 * One hands-free session of cook-along (#309). Listens, keeps only what is addressed to Famy, and hands
 * each command to the screen. Every outcome is also shown as text and played as a cue: a command
 * understood, "Famy" heard alone, or a request Famy could not place.
 */
export class VoiceControl {
	status = $state<VoiceStatus>('off');
	lastHeard = $state<LastHeard>(null);

	#session: ListenSession | null = null;
	#awakeTimer: ReturnType<typeof setTimeout> | null = null;
	#vocabulary: () => VoiceVocabulary;
	#lang: () => string;
	#onCommand: (command: VoiceCommand) => void;

	constructor(vocabulary: () => VoiceVocabulary, lang: () => string, onCommand: (command: VoiceCommand) => void) {
		this.#vocabulary = vocabulary;
		this.#lang = lang;
		this.#onCommand = onCommand;
	}

	get supported(): boolean {
		return canListen();
	}

	get active(): boolean {
		return this.status === 'starting' || this.status === 'listening' || this.status === 'awake';
	}

	async start() {
		if (this.active) return;
		if (!this.supported) {
			this.status = 'unsupported';
			return;
		}

		this.status = 'starting';
		this.lastHeard = null;

		const session = await listen(this.#lang(), {
			onPhrase: (alternatives) => this.#onPhrase(alternatives),
			onEnd: (reason) => {
				this.#session = null;
				this.#clearAwake();
				this.status = reason;
			}
		});

		if (this.status === 'starting') {
			this.#session = session;
			this.status = 'listening';
		} else if (!this.active) {
			session.stop();
		}
	}

	stop() {
		this.#session?.stop();
		this.#session = null;
		this.#clearAwake();
		this.status = 'off';
	}

	#onPhrase(alternatives: string[]) {
		if (!this.active) return;

		const heard = hear(alternatives, this.#vocabulary(), this.status === 'awake');
		if (!heard) return;

		this.#clearAwake();

		if (heard.kind === 'wake') {
			feedback.play('tap');
			this.status = 'awake';
			this.#awakeTimer = setTimeout(() => {
				if (this.status === 'awake') this.status = 'listening';
			}, AWAKE_MS);
			return;
		}

		this.status = 'listening';
		this.lastHeard = heard;

		if (heard.kind === 'unknown') {
			feedback.play('error');
			return;
		}

		feedback.play('success');
		this.#onCommand(heard.command);
	}

	#clearAwake() {
		if (this.#awakeTimer) clearTimeout(this.#awakeTimer);
		this.#awakeTimer = null;
	}
}
