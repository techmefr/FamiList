import { textOfLines, type PlacedLine } from '$domain/recipe-ocr';

/**
 * Reading the text of a photo on the device itself (#312): no AI key, no upload, and it keeps working
 * offline once the engine is there.
 *
 * The engine is behind this small interface on purpose: Tesseract.js (web, PWA and Android alike) is the
 * one shipped, ML Kit text recognition could replace it natively through `provideOcrEngine` without
 * anything else in the app changing. The screen says plainly when there is no way to read text here.
 */
export interface OcrOptions {
	/** The app's language (`fr`, `ar`, `zh`…): the engine picks its own models from it. */
	locale: string;
	/** From 0 to 1 while this image is read, for a progress bar that moves. */
	onProgress?: (ratio: number) => void;
}

export interface OcrEngine {
	readonly id: string;
	/** The text of one image, one line per line of the page, a blank line between paragraphs. */
	recognize(image: Blob, options: OcrOptions): Promise<string>;
}

let provided: OcrEngine | null = null;

/** Called once at start-up by whichever engine the build bundles; the last one wins. */
export function provideOcrEngine(engine: OcrEngine | null): void {
	provided = engine;
}

interface DetectedText {
	rawValue: string;
	boundingBox: { x: number; y: number; width: number; height: number };
}

type TextDetectorConstructor = new () => { detect(source: ImageBitmapSource): Promise<DetectedText[]> };

function textDetector(): TextDetectorConstructor | null {
	if (typeof window === 'undefined' || !('TextDetector' in window)) return null;
	return (window as unknown as { TextDetector: TextDetectorConstructor }).TextDetector;
}

/** The Shape Detection API: one call per image, no progress to report, so only the end is signalled. */
const textDetectorEngine = (Detector: TextDetectorConstructor): OcrEngine => ({
	id: 'text-detector',
	async recognize(image, { onProgress }) {
		const bitmap = await createImageBitmap(image);
		try {
			const found = await new Detector().detect(bitmap);
			onProgress?.(1);
			return textOfLines(
				found.map(
					(line): PlacedLine => ({
						text: line.rawValue,
						top: line.boundingBox.y,
						left: line.boundingBox.x,
						height: line.boundingBox.height
					})
				)
			);
		} finally {
			bitmap.close();
		}
	}
});

const canRunTesseract = () =>
	typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof WebAssembly === 'object';

/**
 * The engine to read with, or null when this device has none: the screen then offers the AI instead.
 *
 * A browser's own `TextDetector` goes first when it exists: it costs no download. Otherwise Tesseract, only
 * imported now — the first scan pays for it, not every start of the app.
 */
export async function loadOcrEngine(): Promise<OcrEngine | null> {
	if (provided) return provided;

	const Detector = textDetector();
	if (Detector) return textDetectorEngine(Detector);
	if (!canRunTesseract()) return null;

	try {
		const { tesseractEngine } = await import('./tesseract');
		provided = tesseractEngine;
		return provided;
	} catch {
		return null;
	}
}
