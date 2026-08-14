import QRCode from 'qrcode';

export interface QrCode {
	size: number;
	/** true = module sombre. */
	modules: boolean[][];
}

/**
 * Encodage QR délégué à `qrcode`.
 *
 * Le prototype embarquait un encodeur écrit à la main. Il produit une image d'allure correcte —
 * motifs de repérage, quadrillage — mais les codes ne se relisent pas : vérifié en le décodant
 * avec une implémentation indépendante. Une carte qui ne scanne pas à la caisse est pire
 * qu'absente, donc l'encodage passe par une bibliothèque éprouvée. Elle est empaquetée dans
 * l'application : rien n'est demandé au réseau au moment de montrer le code.
 */
export function qrEncode(text: string): QrCode {
	const { modules } = QRCode.create(String(text) || ' ', { errorCorrectionLevel: 'L' });
	const { size } = modules;

	return {
		size,
		modules: Array.from({ length: size }, (_, row) =>
			Array.from({ length: size }, (_, col) => Boolean(modules.get(row, col)))
		)
	};
}
