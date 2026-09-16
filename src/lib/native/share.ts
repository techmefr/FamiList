import { Capacitor } from '@capacitor/core';

/**
 * Sortir un texte de l'application vers ce que la personne veut : messagerie, WhatsApp, courriel.
 *
 * Trois étages, du plus juste au plus sûr :
 * - l'application installée passe par `@capacitor/share`, qui ouvre la vraie feuille du système —
 *   `navigator.share` n'existe pas dans une WebView Android ;
 * - un navigateur qui sait partager utilise `navigator.share`, même feuille, sans plugin ;
 * - partout ailleurs (ordinateur de bureau, Firefox), le presse-papier : le texte est prêt, la
 *   personne le colle où elle veut. C'est le seul étage où rien ne s'ouvre à l'écran, d'où le
 *   résultat rendu à l'appelant — il lui revient de le dire.
 */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Une feuille refermée sans choisir n'est pas une panne : rien à annoncer, rien à réessayer. */
const isCancel = (error: unknown) =>
	error instanceof Error && (error.name === 'AbortError' || /cancel/i.test(error.message));

async function copy(text: string): Promise<ShareOutcome> {
	try {
		await navigator.clipboard.writeText(text);
		return 'copied';
	} catch {
		return 'failed';
	}
}

export async function shareText(title: string, text: string): Promise<ShareOutcome> {
	if (Capacitor.isNativePlatform()) {
		try {
			const { Share } = await import('@capacitor/share');
			await Share.share({ title, text, dialogTitle: title });
			return 'shared';
		} catch (error) {
			if (isCancel(error)) return 'cancelled';
			return copy(text);
		}
	}

	if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
		try {
			await navigator.share({ title, text });
			return 'shared';
		} catch (error) {
			if (isCancel(error)) return 'cancelled';
			return copy(text);
		}
	}

	return copy(text);
}
