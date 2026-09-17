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
const resultatDe = (value: string, format: string): ScanResult => ({
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
		.then((supportes) =>
			supportes
				? SCAN_FORMATS.filter((format) => supportes.includes(format))
				: ['qr_code', 'ean_13', 'code_39']
		)
		.catch(() => ['qr_code', 'ean_13', 'code_39']);

	return formatsUtilisables;
}

async function nouveauDetecteur() {
	return new (constructeurDetecteur())({ formats: await formatsDemandes() });
}

/** The fallback decoder, loaded once and kept. */
let secours: Promise<import('@zxing/browser').BrowserMultiFormatReader> | null = null;

function lecteurDeSecours() {
	secours ??= import('@zxing/browser').then(
		({ BrowserMultiFormatReader }) => new BrowserMultiFormatReader()
	);

	return secours;
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

	return resultatDe(first.rawValue, first.format);
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
	const detector = aBarcodeDetector() ? await nouveauDetecteur() : null;
	const lecteur = detector ? null : await lecteurDeSecours();

	const stream = await navigator.mediaDevices.getUserMedia({
		video: { facingMode: 'environment' }
	});

	video.srcObject = stream;
	await video.play();
	onTrack?.(stream.getVideoTracks()[0] ?? null);

	const fin = Date.now() + timeoutMs;

	try {
		while (!signal.aborted && Date.now() < fin) {
			if (detector) {
				const [found] = await detector.detect(video);
				if (found) return resultatDe(found.rawValue, found.format);
			} else if (lecteur) {
				// One frame at a time, rather than `decodeOnce`: that one would take the camera itself and only hand
				// back at the first code found, so never on a deliberate stop.
				const resultat = await decoderUneImage(lecteur, video);
				if (resultat) return resultat;
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
async function decoderUneImage(
	lecteur: import('@zxing/browser').BrowserMultiFormatReader,
	source: HTMLVideoElement
): Promise<ScanResult | null> {
	const toile = document.createElement('canvas');
	toile.width = source.videoWidth || source.clientWidth;
	toile.height = source.videoHeight || source.clientHeight;
	if (!toile.width || !toile.height) return null;

	toile.getContext('2d')?.drawImage(source, 0, 0, toile.width, toile.height);

	return decoderLaToile(lecteur, toile);
}

/** The decoding itself, shared by the video stream and the imported image. */
function decoderLaToile(
	lecteur: import('@zxing/browser').BrowserMultiFormatReader,
	toile: HTMLCanvasElement
): ScanResult | null {
	try {
		const resultat = lecteur.decodeFromCanvas(toile);
		return resultatDe(resultat.getText(), resultat.getBarcodeFormat().toString());
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
			const [found] = await (await nouveauDetecteur()).detect(image).catch(() => []);
			if (found) return resultatDe(found.rawValue, found.format);
		}

		// A full-resolution phone photo often fails on a barcode, where the same image scaled down passes.
		const scale = scanScale(image.width, image.height);
		const toile = document.createElement('canvas');
		toile.width = Math.max(1, Math.round(image.width * scale));
		toile.height = Math.max(1, Math.round(image.height * scale));
		toile.getContext('2d')?.drawImage(image, 0, 0, toile.width, toile.height);

		const lecteur = await lecteurDeSecours();
		const reduit = decoderLaToile(lecteur, toile);
		if (reduit || scale === 1) return reduit;

		// A code already small in the image can conversely suffer from the downscaling: we give the original
		// size one more chance before giving up.
		const entiere = document.createElement('canvas');
		entiere.width = image.width;
		entiere.height = image.height;
		entiere.getContext('2d')?.drawImage(image, 0, 0);

		return decoderLaToile(lecteur, entiere);
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
