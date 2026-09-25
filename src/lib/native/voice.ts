import { Capacitor } from '@capacitor/core';
import {
	isSpeechRecognitionSupported,
	speechRecognitionCtor,
	type SpeechRecognitionGlobals
} from '$domain/speech-dictation';

/**
 * Continuous listening for hands-free cook-along (#309). In a browser, the Web Speech API; in the
 * installed app, the Android WebView has none, so the native recogniser through Capacitor.
 *
 * Both engines stop on their own after a silence: the loop starts them again for as long as the session
 * is open, and only a refusal or repeated failures end it. Every phrase arrives as the list of guesses
 * the engine made, so the matching can pick the one addressed to Famy.
 */
export type ListenEnd = 'denied' | 'unsupported' | 'failed';

export interface ListenSession {
	stop(): void;
}

export interface ListenHandlers {
	onPhrase: (alternatives: string[]) => void;
	/** Only called when listening ends without `stop()`. */
	onEnd: (reason: ListenEnd) => void;
}

/** Failures in a row before giving up: a recogniser that keeps erroring would otherwise spin forever. */
const MAX_FAILURES = 5;

export function canListen(): boolean {
	if (typeof window === 'undefined') return false;
	if (Capacitor.isNativePlatform()) return true;

	return isSpeechRecognitionSupported(window as unknown as SpeechRecognitionGlobals);
}

export async function listen(lang: string, handlers: ListenHandlers): Promise<ListenSession> {
	return Capacitor.isNativePlatform() ? listenNative(lang, handlers) : listenWeb(lang, handlers);
}

interface WebRecognitionResult {
	isFinal: boolean;
	length: number;
	[index: number]: { transcript: string };
}

interface WebRecognition {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	onresult: ((event: { resultIndex: number; results: ArrayLike<WebRecognitionResult> }) => void) | null;
	onerror: ((event: { error: string }) => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}

function listenWeb(lang: string, { onPhrase, onEnd }: ListenHandlers): ListenSession {
	const Ctor = speechRecognitionCtor(window as unknown as SpeechRecognitionGlobals);
	if (!Ctor) {
		onEnd('unsupported');
		return { stop() {} };
	}

	const recognition = new Ctor() as WebRecognition;
	recognition.lang = lang;
	recognition.continuous = true;
	recognition.interimResults = false;
	recognition.maxAlternatives = 3;

	let stopped = false;
	let failures = 0;

	const finish = (reason: ListenEnd) => {
		if (stopped) return;
		stopped = true;
		recognition.abort();
		onEnd(reason);
	};

	recognition.onresult = (event) => {
		failures = 0;
		for (let i = event.resultIndex; i < event.results.length; i++) {
			const result = event.results[i];
			if (!result.isFinal) continue;

			const alternatives: string[] = [];
			for (let j = 0; j < result.length; j++) alternatives.push(result[j].transcript);
			onPhrase(alternatives);
		}
	};

	recognition.onerror = (event) => {
		if (event.error === 'not-allowed' || event.error === 'service-not-allowed') finish('denied');
		else if (event.error === 'language-not-supported') finish('unsupported');
		else if (event.error !== 'no-speech' && event.error !== 'aborted') failures++;
	};

	recognition.onend = () => {
		if (stopped) return;
		if (failures >= MAX_FAILURES) return finish('failed');

		try {
			recognition.start();
		} catch {
			finish('failed');
		}
	};

	try {
		recognition.start();
	} catch {
		finish('failed');
	}

	return {
		stop() {
			stopped = true;
			recognition.abort();
		}
	};
}

async function listenNative(lang: string, { onPhrase, onEnd }: ListenHandlers): Promise<ListenSession> {
	const { SpeechRecognition } = await import('@capgo/capacitor-speech-recognition');

	try {
		const { available } = await SpeechRecognition.available();
		if (!available) {
			onEnd('unsupported');
			return { stop() {} };
		}

		const { speechRecognition } = await SpeechRecognition.requestPermissions();
		if (speechRecognition !== 'granted') {
			onEnd('denied');
			return { stop() {} };
		}
	} catch {
		onEnd('unsupported');
		return { stop() {} };
	}

	let stopped = false;

	void (async () => {
		let failures = 0;

		while (!stopped) {
			try {
				const { matches } = await SpeechRecognition.start({
					language: lang,
					maxResults: 3,
					partialResults: false,
					popup: false,
					muteRecognizerBeep: true
				});
				failures = 0;
				if (!stopped && matches?.length) onPhrase(matches);
			} catch {
				// "No match" after a silence lands here too: only a run of them means the engine is broken.
				if (++failures >= MAX_FAILURES) {
					if (!stopped) onEnd('failed');
					return;
				}
				await new Promise((resolve) => setTimeout(resolve, 300));
			}
		}
	})();

	return {
		stop() {
			stopped = true;
			void SpeechRecognition.stop().catch(() => {});
		}
	};
}
