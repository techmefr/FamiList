import { Capacitor } from '@capacitor/core';

/**
 * Opening a link outside the application.
 *
 * Natively, `target="_blank"` opens inside the app's own webview — there is no separate tab to switch to, so
 * the person is stuck on someone else's page with no way back short of the system's back gesture, and the
 * app itself feels like it has left. `@capacitor/browser` opens the platform's own in-app browser (Custom
 * Tabs on Android, SFSafariViewController on iOS) instead, a real overlay with its own address bar and close
 * button.
 *
 * On the web, `target="_blank"` already does the right thing, so this only steps in natively.
 */
export async function openExternal(url: string): Promise<void> {
	if (!Capacitor.isNativePlatform()) {
		window.open(url, '_blank', 'noopener,noreferrer');
		return;
	}

	const { Browser } = await import('@capacitor/browser');
	await Browser.open({ url });
}
