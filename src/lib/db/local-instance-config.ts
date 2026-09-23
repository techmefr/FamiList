import { browser } from '$app/environment';
import { readLocalInstanceConfig, type LocalInstanceConfig } from '$domain/instance-config';

/**
 * Where the in-app connection screen keeps what it was told, on the device that typed it. `localStorage`
 * and not the Supabase-backed instance settings: those live in the database this very config points to,
 * which is exactly what is not reachable yet when nobody has connected the app to anything.
 */
const STORAGE_KEY = 'familist:instance-config';

/** What is currently saved on this device, or null when nobody has used the connection screen yet. */
export function loadLocalInstanceConfig(): LocalInstanceConfig | null {
	if (!browser) return null;

	try {
		return readLocalInstanceConfig(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
	} catch {
		return null;
	}
}

/**
 * Saves the connection typed in the screen. Rejected silently — returning false rather than throwing — so
 * the form can show its own message instead of an uncaught error reaching the crash reporter for a mistake
 * as ordinary as a pasted URL missing its scheme.
 */
export function saveLocalInstanceConfig(url: string, anonKey: string): boolean {
	if (!browser) return false;

	const parsed = readLocalInstanceConfig({ url, anonKey });
	if (!parsed) return false;

	localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
	return true;
}

/** Forgets the in-app connection, falling back to whatever the build shipped with on the next reload. */
export function clearLocalInstanceConfig(): void {
	if (!browser) return;

	localStorage.removeItem(STORAGE_KEY);
}
