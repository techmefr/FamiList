/**
 * Hands-free control of cook-along (#309): "Famy", then a command.
 *
 * Recognising speech is the platform's job; this file only decides what a transcript means, so the
 * matching can be tested without a microphone. The words themselves live in the locale files: every
 * command is a list of phrases, and the longest phrase heard wins, so "tous les ingrédients" is not
 * taken for "ingrédients".
 */

export const VOICE_COMMANDS = [
	'next',
	'previous',
	'repeat',
	'stepIngredients',
	'allIngredients',
	'louder',
	'quieter',
	'mute',
	'unmute',
	'stopListening',
	'startTimer',
	'stopTimer',
	'timeLeft',
	'help',
	'close'
] as const;

export type VoiceCommand = (typeof VOICE_COMMANDS)[number];

export interface VoiceVocabulary {
	/** How recognisers spell "Famy" in this language: "fami", "famie", "фами"… */
	wake: string[];
	commands: Record<VoiceCommand, string[]>;
}

export type Heard =
	| { kind: 'command'; command: VoiceCommand }
	/** "Famy" alone: the command is expected in the next phrase. */
	| { kind: 'wake' }
	/** Addressed to Famy but matching no command: worth telling the person, unlike background talk. */
	| { kind: 'unknown'; text: string }
	| null;

/** Scripts written without spaces between words, where a phrase can only be looked for as a substring. */
const UNSPACED = /[぀-ヿ㐀-鿿豈-﫿]/;

/**
 * Lower case, accents and apostrophes gone, punctuation turned into spaces: "Étape suivante !" and
 * "etape suivante" must read the same, whatever the recogniser chose to write.
 */
export function normalizeSpeech(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

/** Where `phrase` ends in `text`, as whole words, or -1. Both already normalised. */
function endOf(text: string, phrase: string): number {
	if (!phrase) return -1;
	if (UNSPACED.test(phrase)) {
		const at = text.lastIndexOf(phrase);
		return at < 0 ? -1 : at + phrase.length;
	}

	const at = ` ${text} `.lastIndexOf(` ${phrase} `);
	return at < 0 ? -1 : at + phrase.length;
}

/** What follows the last "Famy" in the phrase, or `null` when it was not said. */
export function afterWakeWord(text: string, wake: string[]): string | null {
	const normalized = normalizeSpeech(text);
	let end = -1;

	for (const word of wake) end = Math.max(end, endOf(normalized, normalizeSpeech(word)));

	return end < 0 ? null : normalized.slice(end).trim();
}

/** The command whose longest phrase appears in `text`, or `null`. */
export function matchCommand(text: string, commands: Record<VoiceCommand, string[]>): VoiceCommand | null {
	const normalized = normalizeSpeech(text);
	let best: VoiceCommand | null = null;
	let bestLength = 0;

	for (const command of VOICE_COMMANDS) {
		for (const phrase of commands[command] ?? []) {
			const wanted = normalizeSpeech(phrase);
			if (wanted.length > bestLength && endOf(normalized, wanted) >= 0) {
				best = command;
				bestLength = wanted.length;
			}
		}
	}

	return best;
}

/**
 * What a recognised phrase means. Recognisers hand back several guesses; the first one addressed to Famy
 * is kept. `awake` is set just after "Famy" was heard alone: the phrase that follows is then the command,
 * without the wake word, the way people naturally pause after calling someone.
 */
export function hear(alternatives: string[], vocabulary: VoiceVocabulary, awake = false): Heard {
	let addressed: string | null = null;

	for (const alternative of alternatives) {
		const rest = afterWakeWord(alternative, vocabulary.wake) ?? (awake ? normalizeSpeech(alternative) : null);
		if (rest === null) continue;

		const command = matchCommand(rest, vocabulary.commands);
		if (command) return { kind: 'command', command };
		addressed ??= rest;
	}

	if (addressed === null) return null;
	if (!addressed) return { kind: 'wake' };

	return { kind: 'unknown', text: addressed };
}

/** Speech volume moves by quarters, never down to silence: muting is its own command. */
const VOLUME_STEP = 0.25;

export function stepVolume(volume: number, direction: 'up' | 'down'): number {
	const next = volume + (direction === 'up' ? VOLUME_STEP : -VOLUME_STEP);
	return Math.min(1, Math.max(VOLUME_STEP, Math.round(next / VOLUME_STEP) * VOLUME_STEP));
}
