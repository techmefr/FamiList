import { Capacitor } from '@capacitor/core';

/**
 * Getting a text out of the application towards whatever the person wants: messaging, WhatsApp, email.
 *
 * Three tiers, from the most exact to the safest:
 * - the installed application goes through `@capacitor/share`, which opens the real system sheet —
 *   `navigator.share` does not exist in an Android WebView;
 * - a browser that can share uses `navigator.share`, same sheet, no plugin;
 * - everywhere else (desktop computer, Firefox), the clipboard: the text is ready, the person pastes it
 *   where they want. It is the only tier where nothing opens on screen, hence the result returned to the
 *   caller — it is up to them to say so.
 */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** A sheet closed without choosing is not a breakdown: nothing to announce, nothing to retry. */
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
