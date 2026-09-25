import { textOfLines, type PlacedLine } from '$domain/recipe-ocr';

/**
 * Reading the text of a photo on the device itself (#312): no AI key, no upload, and it keeps working
 * offline once the engine is there.
 *
 * The engine is behind this small interface on purpose. The decided one is Tesseract.js (web, PWA and
 * Android alike), with ML Kit text recognition as a possible native alternative; neither ships yet, so
 * the app registers whichever it bundles through `provideOcrEngine`, and nothing else in the app changes.
 * Until then the browser's own `TextDetector` is used where it exists (Chromium with the Shape Detection
 * API), and the screen says plainly when there is no way to read text here.
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

/** The engine to read with, or null when this device has none: the screen then offers the AI instead. */
export function ocrEngine(): OcrEngine | null {
	if (provided) return provided;

	const Detector = textDetector();
	return Detector ? textDetectorEngine(Detector) : null;
}
