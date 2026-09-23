import type { Locale } from '$i18n/index.svelte';

/**
 * Voice dictation for the free-text "ask the AI for a recipe" field (#265): recognising speech is entirely
 * the browser's job, through the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) — nothing
 * here ever calls a server or a third party, and nothing is stored beyond the text field itself.
 *
 * This file holds only what can be tested without a browser: feature detection on a given global object,
 * the locale the recognizer should listen in, and how a transcript joins whatever was already typed. The
 * component drives the actual `SpeechRecognition` instance, which cannot be unit-tested meaningfully since
 * jsdom has no such API.
 */

/** The two constructor names a browser may expose it under, never both. */
export interface SpeechRecognitionGlobals {
	SpeechRecognition?: unknown;
	webkitSpeechRecognition?: unknown;
}

/**
 * Whether this browser can dictate at all. Firefox and older browsers have neither constructor: the mic
 * button must then not appear, and the text field stays the only way in — never a dead end.
 */
export function isSpeechRecognitionSupported(target: SpeechRecognitionGlobals | undefined): boolean {
	if (!target) return false;

	return typeof target.SpeechRecognition === 'function' || typeof target.webkitSpeechRecognition === 'function';
}

/** The constructor to instantiate, preferring the unprefixed one when both exist. */
export function speechRecognitionCtor(
	target: SpeechRecognitionGlobals | undefined
): (new () => unknown) | undefined {
	if (!target) return undefined;

	const ctor = target.SpeechRecognition ?? target.webkitSpeechRecognition;
	return typeof ctor === 'function' ? (ctor as new () => unknown) : undefined;
}

/**
 * The BCP47 tag `SpeechRecognition.lang` expects, for each app locale. A recognizer given only "fr" often
 * falls back to whatever the OS is set to, so a full region tag is supplied even where the app itself only
 * tracks the language.
 */
const BCP47_BY_LOCALE: Record<Locale, string> = {
	fr: 'fr-FR',
	en: 'en-US',
	es: 'es-ES',
	de: 'de-DE',
	it: 'it-IT',
	pt: 'pt-PT',
	ru: 'ru-RU',
	ar: 'ar-SA',
	zh: 'zh-CN',
	mg: 'mg'
};

/** `recognition.lang` for the app's current locale. `mg` has no browser support to target; the tag is passed
 * through as-is so a recognizer that does understand it still can, and others fall back to their default. */
export function bcp47LocaleOf(locale: Locale): string {
	return BCP47_BY_LOCALE[locale] ?? 'fr-FR';
}

/** A raw transcript chunk, cleaned up: trimmed, and internal runs of whitespace collapsed to one space. */
export function normalizeTranscript(text: string): string {
	return text.trim().replace(/\s+/g, ' ');
}

/**
 * What the text field becomes once a transcript comes in, on top of whatever the person already typed or
 * dictated. A trailing dictation is appended after a space rather than replacing the field, so correcting a
 * word by hand and then dictating the rest still keeps both.
 */
export function appendTranscript(existing: string, transcript: string): string {
	const addition = normalizeTranscript(transcript);
	if (!addition) return existing;

	const base = existing.replace(/\s+$/, '');
	if (!base) return addition;

	return `${base} ${addition}`;
}
