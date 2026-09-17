import QRCode from 'qrcode';

export interface QrCode {
	size: number;
	/** true = dark module. */
	modules: boolean[][];
}

/**
 * QR encoding delegated to `qrcode`.
 *
 * The prototype carried an encoder written by hand. It produces an image that looks right — finder
 * patterns, grid — but the codes cannot be read back: checked by decoding one with an independent
 * implementation. A card that does not scan at the till is worse than no card, so encoding goes through a
 * proven library. It is bundled into the application: nothing is asked of the network when showing the
 * code.
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
