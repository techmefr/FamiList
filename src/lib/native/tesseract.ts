import { Capacitor } from '@capacitor/core';
import { createWorker, OEM, type Worker } from 'tesseract.js';
import { NATIVE_OCR_LANGUAGES, ocrLanguagesFor } from '$domain/ocr-languages';
import type { OcrEngine } from './ocr';

/**
 * Tesseract.js as the recipe scanner's engine (#312), loaded only when "Scan a recipe" is opened: its
 * worker, core and models are several megabytes nobody else should pay for.
 *
 * Everything comes from the app's own origin (`static/tesseract/`, filled by `scripts/ocr-assets.mjs`):
 * without explicit paths the library would fetch all of it from jsDelivr. The models are cached by
 * Tesseract in IndexedDB after the first reading, so the next one works offline.
 */

/** Once a reading is over, the worker and its model stay in memory this long, for the next page. */
const IDLE_MS = 60_000;

/** Loading the core and the model is the slow first part; recognising the page is the rest of the bar. */
const LOADING_SHARE = 0.2;

const asset = (path: string) => new URL(`/tesseract/${path}`, window.location.href).href;

let current: { key: string; worker: Promise<Worker> } | null = null;
let idle: ReturnType<typeof setTimeout> | null = null;
let report: ((ratio: number) => void) | undefined;

function progressOf(status: string, progress: number): number {
	if (status === 'recognizing text') return LOADING_SHARE + (1 - LOADING_SHARE) * progress;
	return LOADING_SHARE * Math.min(1, Math.max(0, progress)) * 0.9;
}

function workerFor(languages: string[]): Promise<Worker> {
	const key = languages.join('+');
	if (current?.key === key) return current.worker;

	void current?.worker.then((worker) => worker.terminate()).catch(() => {});
	const worker = createWorker(languages, OEM.LSTM_ONLY, {
		workerPath: asset('worker.min.js'),
		corePath: asset('tesseract-core-simd-lstm.wasm.js'),
		langPath: asset('lang'),
		gzip: true,
		logger: ({ status, progress }) => report?.(progressOf(status, progress))
	});
	current = { key, worker };
	// A failed start must not stay cached: the next reading tries again from scratch.
	worker.catch(() => {
		if (current?.worker === worker) current = null;
	});
	return worker;
}

function releaseLater() {
	if (idle) clearTimeout(idle);
	idle = setTimeout(() => {
		const done = current;
		current = null;
		void done?.worker.then((worker) => worker.terminate()).catch(() => {});
	}, IDLE_MS);
}

export const tesseractEngine: OcrEngine = {
	id: 'tesseract',
	async recognize(image, { locale, onProgress }) {
		if (idle) clearTimeout(idle);
		const languages = ocrLanguagesFor(locale, Capacitor.isNativePlatform() ? NATIVE_OCR_LANGUAGES : undefined);

		report = onProgress;
		try {
			const worker = await workerFor(languages);
			const { data } = await worker.recognize(image);
			onProgress?.(1);
			return data.text ?? '';
		} finally {
			report = undefined;
			releaseLater();
		}
	}
};
