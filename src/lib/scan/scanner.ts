import { Capacitor } from '@capacitor/core';
import { SCAN_FORMATS, normalizeFormat, normalizeValue, scanScale } from '$domain/scan-image';
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

/** Le résultat d'un décodeur, quel qu'il soit, ramené au modèle de la carte. */
const resultatDe = (value: string, format: string): ScanResult => ({
	value: normalizeValue(value, format),
	codeType: normalizeFormat(format)
});

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

type DetectorConstructor = {
	new (options: { formats: string[] }): {
		detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
	};
	getSupportedFormats?: () => Promise<string[]>;
};

const constructeurDetecteur = () =>
	(window as unknown as { BarcodeDetector: DetectorConstructor }).BarcodeDetector;

/**
 * Demander un format que l'implémentation ne connaît pas la fait refuser en bloc. On croise donc
 * notre liste avec la sienne, une seule fois — et si elle ne sait pas répondre, on s'en tient aux
 * trois formats que tout le monde gère.
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

	return resultatDe(first.rawValue, first.format);
}

/**
 * Lecture par le navigateur : on ouvre le flux vidéo, on regarde chaque image jusqu'à trouver un
 * code, et on rend la caméra dans tous les cas — y compris en cas d'erreur, sinon le voyant reste
 * allumé et l'appareil photo reste pris.
 */
async function scanBrowser(video: HTMLVideoElement, signal: AbortSignal): Promise<ScanResult | null> {
	const detector = aBarcodeDetector() ? await nouveauDetecteur() : null;
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
				if (found) return resultatDe(found.rawValue, found.format);
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

	return decoderLaToile(lecteur, toile);
}

/** Le décodage lui-même, commun au flux vidéo et à l'image importée. */
function decoderLaToile(
	lecteur: import('@zxing/browser').BrowserMultiFormatReader,
	toile: HTMLCanvasElement
): ScanResult | null {
	try {
		const resultat = lecteur.decodeFromCanvas(toile);
		return resultatDe(resultat.getText(), resultat.getBarcodeFormat().toString());
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
		// Le détecteur du navigateur d'abord, parce qu'il est rapide et qu'il ne coûte aucun
		// téléchargement. Mais on ne s'arrête pas à son silence : il ignore des formats courants
		// sur les cartes de fidélité, et le décodeur de secours, lui, les lit. Rendre `null` ici
		// laissait ce dernier inutilisé sur tout Chrome, c'est-à-dire sur presque tout Android.
		if (aBarcodeDetector()) {
			const [found] = await (await nouveauDetecteur()).detect(image).catch(() => []);
			if (found) return resultatDe(found.rawValue, found.format);
		}

		// Une photo de téléphone en pleine résolution échoue souvent sur un code à barres, là où
		// la même image réduite passe.
		const scale = scanScale(image.width, image.height);
		const toile = document.createElement('canvas');
		toile.width = Math.max(1, Math.round(image.width * scale));
		toile.height = Math.max(1, Math.round(image.height * scale));
		toile.getContext('2d')?.drawImage(image, 0, 0, toile.width, toile.height);

		const lecteur = await lecteurDeSecours();
		const reduit = decoderLaToile(lecteur, toile);
		if (reduit || scale === 1) return reduit;

		// Un code déjà petit dans l'image peut au contraire souffrir de la réduction : on redonne
		// sa chance à la taille d'origine avant d'abandonner.
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
	signal: AbortSignal
): Promise<ScanResult | null> {
	const support = scanSupport();

	if (support === 'native') return scanNative();
	if (support === 'browser' && video) return scanBrowser(video, signal);

	return null;
}
