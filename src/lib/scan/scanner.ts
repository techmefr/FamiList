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
 * - partout ailleurs, un décodeur en JavaScript chargé à la demande.
 *
 * Le troisième existe parce que le deuxième manque là où on s'y attendrait le moins : Chrome sur
 * Windows n'expose pas BarcodeDetector, et c'est précisément la machine devant laquelle on
 * s'installe pour enregistrer une pile de cartes d'un coup. Il ne se charge que si on scanne —
 * une centaine de kilo-octets qu'il n'y a aucune raison de faire payer aux autres écrans.
 *
 * La saisie manuelle reste, et n'est pas un pis-aller honteux : c'est aussi ce qui permet
 * d'enregistrer une carte dont le code est illisible ou abîmé.
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
	if (typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices)) return 'browser';

	return 'none';
}

/** Vrai quand le navigateur sait décoder lui-même, sans qu'on charge le décodeur de secours. */
const aBarcodeDetector = () => typeof window !== 'undefined' && 'BarcodeDetector' in window;

interface DetectedBarcode {
	rawValue: string;
	format: string;
}

type DetectorConstructor = new (options: { formats: string[] }) => {
	detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
};

const nouveauDetecteur = () =>
	new (window as unknown as { BarcodeDetector: DetectorConstructor }).BarcodeDetector({
		formats: [...BARCODE_FORMATS]
	});

/** Le décodeur de secours, chargé une seule fois et gardé. */
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
	const detector = aBarcodeDetector() ? nouveauDetecteur() : null;
	const lecteur = detector ? null : await lecteurDeSecours();

	const stream = await navigator.mediaDevices.getUserMedia({
		video: { facingMode: 'environment' }
	});

	video.srcObject = stream;
	await video.play();

	try {
		while (!signal.aborted) {
			if (detector) {
				const [found] = await detector.detect(video);
				if (found) return { value: found.rawValue, codeType: normalizeFormat(found.format) };
			} else if (lecteur) {
				// Une image à la fois, plutôt que `decodeOnce` : celui-ci prendrait la caméra lui-même
				// et ne rendrait la main qu'au premier code trouvé, donc jamais sur un arrêt voulu.
				const resultat = await decoderUneImage(lecteur, video);
				if (resultat) return resultat;
			}

			await new Promise((resolve) => setTimeout(resolve, 150));
		}

		return null;
	} finally {
		stream.getTracks().forEach((track) => track.stop());
		video.srcObject = null;
	}
}

/** Une image du flux, décodée par le lecteur de secours. Rend null quand il n'y a rien à lire. */
async function decoderUneImage(
	lecteur: import('@zxing/browser').BrowserMultiFormatReader,
	source: HTMLVideoElement
): Promise<ScanResult | null> {
	const toile = document.createElement('canvas');
	toile.width = source.videoWidth || source.clientWidth;
	toile.height = source.videoHeight || source.clientHeight;
	if (!toile.width || !toile.height) return null;

	toile.getContext('2d')?.drawImage(source, 0, 0, toile.width, toile.height);

	try {
		const resultat = lecteur.decodeFromCanvas(toile);
		return { value: resultat.getText(), codeType: normalizeFormat(resultat.getBarcodeFormat().toString()) };
	} catch {
		// Pas de code sur cette image : c'est le cas courant, pas une panne.
		return null;
	}
}

/**
 * Lire le code sur une photo ou une capture d'écran.
 *
 * C'est souvent la seule façon d'enregistrer une carte devant un ordinateur : la carte est dans un
 * courriel, dans une photo prise il y a un mois, ou dans l'application de l'enseigne. Demander de
 * la présenter à une webcam de portable, à l'envers et à bout de bras, ne marche pas.
 */
export async function scanImage(file: File): Promise<ScanResult | null> {
	const image = await createImageBitmap(file);

	try {
		if (aBarcodeDetector()) {
			const [found] = await nouveauDetecteur().detect(image);
			return found ? { value: found.rawValue, codeType: normalizeFormat(found.format) } : null;
		}

		const toile = document.createElement('canvas');
		toile.width = image.width;
		toile.height = image.height;
		toile.getContext('2d')?.drawImage(image, 0, 0);

		const lecteur = await lecteurDeSecours();
		try {
			const resultat = lecteur.decodeFromCanvas(toile);
			return {
				value: resultat.getText(),
				codeType: normalizeFormat(resultat.getBarcodeFormat().toString())
			};
		} catch {
			return null;
		}
	} finally {
		image.close();
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
