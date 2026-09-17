import { Capacitor } from '@capacitor/core';
import { SCAN_FORMATS, normalizeFormat, normalizeValue, scanScale } from '$domain/scan-image';
import { SCAN_TIMEOUT_MS } from '$domain/scan-timing';
import type { CodeType } from '$domain/code-format';

export interface ScanResult {
	value: string;
	codeType: CodeType | null;
}

/**
 * `onTrack` reports the video track while it lives, and `null` as soon as it is released. It is the only
 * way for the screen to switch the light on: torch capabilities belong to the track, which the reader
 * opens and closes itself.
 */
export interface ScanOptions {
	timeoutMs?: number;
	onTrack?: (track: MediaStreamTrack | null) => void;
}

/**
 * Three ways to read a barcode, from best to worst:
 *
 * - in the installed application, the native camera through ML Kit;
 * - in a browser exposing BarcodeDetector (Chrome Android, desktop Chrome);
 * - everywhere else, a JavaScript decoder loaded on demand.
 *
 * The third exists because the second is missing where you would least expect it: Chrome on Windows does
 * not expose BarcodeDetector, and that is precisely the machine you sit at to register a stack of cards
 * in one go. It only loads if you scan — a hundred or so kilobytes there is no reason to charge the other
 * screens for.
 *
 * Typing it by hand stays, and is no shameful last resort: it is also what makes it possible to register
 * a card whose code is unreadable or damaged.
 */
export type ScanSupport = 'native' | 'browser' | 'none';

/** The result of any decoder, brought back to the card's model. */
const resultOf = (value: string, format: string): ScanResult => ({
	value: normalizeValue(value, format),
	codeType: normalizeFormat(format)
});

export function scanSupport(): ScanSupport {
	if (Capacitor.isNativePlatform()) return 'native';
	if (typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices)) return 'browser';

	return 'none';
}

/** True when the browser can decode by itself, without us loading the fallback decoder. */
const aBarcodeDetector = () => typeof window !== 'undefined' && 'BarcodeDetector' in window;

interface DetectedBarcode {
	rawValue: string;
	format: string;
}

type DetectorConstructor = {
	new (options: { formats: string[] }): {
		detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
	};
	getSupportedFormats?: () => Promise<string[]>;
};

const constructeurDetecteur = () =>
	(window as unknown as { BarcodeDetector: DetectorConstructor }).BarcodeDetector;

/**
 * Asking for a format the implementation does not know makes it refuse outright. So we intersect our
 * list with its own, once — and if it cannot answer, we stick to the three formats everybody handles.
 */
let formatsUtilisables: Promise<string[]> | null = null;

function formatsDemandes() {
	formatsUtilisables ??= Promise.resolve(constructeurDetecteur().getSupportedFormats?.())
		.then((supported) =>
			supported
				? SCAN_FORMATS.filter((format) => supported.includes(format))
				: ['qr_code', 'ean_13', 'code_39']
		)
		.catch(() => ['qr_code', 'ean_13', 'code_39']);

	return formatsUtilisables;
}

async function newDetector() {
	return new (constructeurDetecteur())({ formats: await formatsDemandes() });
}

/** The fallback decoder, loaded once and kept. */
let backup: Promise<import('@zxing/browser').BrowserMultiFormatReader> | null = null;

function fallbackReader() {
	backup ??= import('@zxing/browser').then(
		({ BrowserMultiFormatReader }) => new BrowserMultiFormatReader()
	);

	return backup;
}

async function scanNative(): Promise<ScanResult | null> {
	const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');

	const { camera } = await BarcodeScanner.requestPermissions();
	if (camera !== 'granted' && camera !== 'limited') return null;

	const { barcodes } = await BarcodeScanner.scan();
	// A code with no text value (image only, undecoded format) cannot be used: better to fill nothing than
	// to fill with emptiness.
	const first = barcodes.find((barcode) => barcode.rawValue);
	if (!first?.rawValue) return null;

	return resultOf(first.rawValue, first.format);
}

/**
 * Reading through the browser: we open the video stream, look at each frame until we find a code, and
 * give the camera back in every case — errors included, otherwise the light stays on and the camera stays
 * taken.
 *
 * The search has an end. In front of a card the decoder will never read — a screen too glossy, a code
 * worn away — the endless loop left only "Stop": no message, no other route offered, and the camera on
 * for as long as you were willing to believe in it.
 */
async function scanBrowser(
	video: HTMLVideoElement,
	signal: AbortSignal,
	{ timeoutMs = SCAN_TIMEOUT_MS, onTrack }: ScanOptions = {}
): Promise<ScanResult | null> {
	const detector = aBarcodeDetector() ? await newDetector() : null;
	const reader = detector ? null : await fallbackReader();

	const stream = await navigator.mediaDevices.getUserMedia({
		video: { facingMode: 'environment' }
	});

	video.srcObject = stream;
	await video.play();
	onTrack?.(stream.getVideoTracks()[0] ?? null);

	const end = Date.now() + timeoutMs;

	try {
		while (!signal.aborted && Date.now() < end) {
			if (detector) {
				const [found] = await detector.detect(video);
				if (found) return resultOf(found.rawValue, found.format);
			} else if (reader) {
				// One frame at a time, rather than `decodeOnce`: that one would take the camera itself and only hand
				// back at the first code found, so never on a deliberate stop.
				const result = await decodeOneFrame(reader, video);
				if (result) return result;
			}

			await new Promise((resolve) => setTimeout(resolve, 150));
		}

		return null;
	} finally {
		onTrack?.(null);
		stream.getTracks().forEach((track) => track.stop());
		video.srcObject = null;
	}
}

/** One frame of the stream, decoded by the fallback reader. Returns null when there is nothing to read. */
async function decodeOneFrame(
	reader: import('@zxing/browser').BrowserMultiFormatReader,
	source: HTMLVideoElement
): Promise<ScanResult | null> {
	const canvas = document.createElement('canvas');
	canvas.width = source.videoWidth || source.clientWidth;
	canvas.height = source.videoHeight || source.clientHeight;
	if (!canvas.width || !canvas.height) return null;

	canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);

	return decodeCanvas(reader, canvas);
}

/** The decoding itself, shared by the video stream and the imported image. */
function decodeCanvas(
	reader: import('@zxing/browser').BrowserMultiFormatReader,
	canvas: HTMLCanvasElement
): ScanResult | null {
	try {
		const result = reader.decodeFromCanvas(canvas);
		return resultOf(result.getText(), result.getBarcodeFormat().toString());
	} catch {
		// No code on this frame: that is the common case, not a failure.
		return null;
	}
}

/**
 * Reading the code on a photo or a screenshot.
 *
 * This is often the only way to register a card in front of a computer: the card is in an email, in a
 * photo taken a month ago, or in the retailer's app. Asking to hold it up to a laptop webcam, upside down
 * and at arm's length, does not work.
 */
export async function scanImage(file: File): Promise<ScanResult | null> {
	const image = await createImageBitmap(file);

	try {
		// The browser detector first, because it is fast and costs no download. But we do not stop at its
		// silence: it ignores formats common on loyalty cards, which the fallback decoder does read. Returning
		// `null` here left the latter unused on all of Chrome, that is, on almost all of Android.
		if (aBarcodeDetector()) {
			const [found] = await (await newDetector()).detect(image).catch(() => []);
			if (found) return resultOf(found.rawValue, found.format);
		}

		// A full-resolution phone photo often fails on a barcode, where the same image scaled down passes.
		const scale = scanScale(image.width, image.height);
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(image.width * scale));
		canvas.height = Math.max(1, Math.round(image.height * scale));
		canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);

		const reader = await fallbackReader();
		const small = decodeCanvas(reader, canvas);
		if (small || scale === 1) return small;

		// A code already small in the image can conversely suffer from the downscaling: we give the original
		// size one more chance before giving up.
		const whole = document.createElement('canvas');
		whole.width = image.width;
		whole.height = image.height;
		whole.getContext('2d')?.drawImage(image, 0, 0);

		return decodeCanvas(reader, whole);
	} finally {
		image.close();
	}
}

export async function scan(
	video: HTMLVideoElement | null,
	signal: AbortSignal,
	options?: ScanOptions
): Promise<ScanResult | null> {
	const support = scanSupport();

	if (support === 'native') return scanNative();
	if (support === 'browser' && video) return scanBrowser(video, signal, options);

	return null;
}
