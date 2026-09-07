import { Capacitor } from '@capacitor/core';
import type { Haptic } from '$domain/cue';

/**
 * Retour tactile. Sur l'application installée, le moteur du téléphone via Capacitor ; dans un
 * navigateur, `navigator.vibrate`, qui ne connaît que des durées et n'existe pas partout.
 *
 * Rien de tout ça n'est essentiel : une plateforme sans vibreur, une permission refusée ou un
 * navigateur qui l'ignore ne doivent pas empêcher l'action qui vient de la déclencher.
 */
const WEB_MS: Record<Haptic, number> = { light: 10, medium: 20, heavy: 35 };

export async function vibrate(haptic: Haptic) {
	try {
		if (Capacitor.isNativePlatform()) {
			const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
			const style =
				haptic === 'heavy'
					? ImpactStyle.Heavy
					: haptic === 'medium'
						? ImpactStyle.Medium
						: ImpactStyle.Light;

			await Haptics.impact({ style });
			return;
		}

		navigator.vibrate?.(WEB_MS[haptic]);
	} catch {
		// pas de vibreur, ou permission refusée : le geste a déjà eu son effet à l'écran
	}
}
