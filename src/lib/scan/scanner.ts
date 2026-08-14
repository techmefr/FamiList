import { Capacitor } from '@capacitor/core';
import type { CodeType } from '$domain/code-format';

export interface ScanResult {
	value: string;
	codeType: CodeType | null;
}

/**
 * Trois façons de lire un code-barres, de la meilleure à la moins bonne :
 *
 * - sur l'application installée, l'appareil photo natif via ML Kit ;
 * - dans un navigateur qui expose BarcodeDetector (Chrome Android, Chrome de bureau) ;
 * - nulle part ailleurs, et l'écran propose alors la saisie à la main.
 *
 * La saisie manuelle n'est pas un pis-aller honteux : c'est aussi ce qui permet d'enregistrer une
 * carte dont le code est illisible ou abîmé.
 */
export type ScanSupport = 'native' | 'browser' | 'none';

const BARCODE_FORMATS = ['qr_code', 'ean_13', 'code_39'] as const;

/** Les noms de formats diffèrent d'une couche à l'autre ; on ne garde que ceux qu'on sait dessiner. */
function normalizeFormat(raw: string): CodeType | null {
	const lower = raw.toLowerCase().replace(/[^a-z0-9]/g, '');

	if (lower.includes('qr')) return 'qr_code';
	if (lower.includes('ean13')) return 'ean_13';
	if (lower.includes('code39')) return 'code_39';

	return null;
}

export function scanSupport(): ScanSupport {
	if (Capacitor.isNativePlatform()) return 'native';
	if (typeof window !== 'undefined' && 'BarcodeDetector' in window) return 'browser';

	return 'none';
}

async function scanNative(): Promise<ScanResult | null> {
	const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');

	const { camera } = await BarcodeScanner.requestPermissions();
	if (camera !== 'granted' && camera !== 'limited') return null;

	const { barcodes } = await BarcodeScanner.scan();
	// Un code sans valeur textuelle (image seule, format non décodé) n'est pas exploitable :
	// mieux vaut ne rien remplir que de remplir avec du vide.
	const first = barcodes.find((barcode) => barcode.rawValue);
	if (!first?.rawValue) return null;

	return { value: first.rawValue, codeType: normalizeFormat(first.format) };
}

/**
 * Lecture par le navigateur : on ouvre le flux vidéo, on regarde chaque image jusqu'à trouver un
 * code, et on rend la caméra dans tous les cas — y compris en cas d'erreur, sinon le voyant reste
 * allumé et l'appareil photo reste pris.
 */
async function scanBrowser(video: HTMLVideoElement, signal: AbortSignal): Promise<ScanResult | null> {
	interface DetectedBarcode {
		rawValue: string;
		format: string;
	}
	type DetectorConstructor = new (options: { formats: string[] }) => {
		detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
	};

	const Detector = (window as unknown as { BarcodeDetector: DetectorConstructor }).BarcodeDetector;
	const detector = new Detector({ formats: [...BARCODE_FORMATS] });

	const stream = await navigator.mediaDevices.getUserMedia({
		video: { facingMode: 'environment' }
	});

	video.srcObject = stream;
	await video.play();

	try {
		while (!signal.aborted) {
			const [found] = await detector.detect(video);

			if (found) return { value: found.rawValue, codeType: normalizeFormat(found.format) };

			await new Promise((resolve) => setTimeout(resolve, 150));
		}

		return null;
	} finally {
		stream.getTracks().forEach((track) => track.stop());
		video.srcObject = null;
	}
}

export async function scan(
	video: HTMLVideoElement | null,
	signal: AbortSignal
): Promise<ScanResult | null> {
	const support = scanSupport();

	if (support === 'native') return scanNative();
	if (support === 'browser' && video) return scanBrowser(video, signal);

	return null;
}
