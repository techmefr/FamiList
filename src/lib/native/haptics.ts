import { Capacitor } from '@capacitor/core';
import type { Haptic } from '$domain/cue';

/**
 * Haptic feedback. On the installed application, the phone's motor through Capacitor; in a browser,
 * `navigator.vibrate`, which only knows durations and does not exist everywhere.
 *
 * None of this is essential: a platform with no vibrator, a refused permission or a browser ignoring it
 * must not prevent the action that has just triggered it.
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
		// no vibrator, or permission refused: the gesture has already had its effect on screen
	}
}
