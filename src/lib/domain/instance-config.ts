/**
 * Which Supabase instance the app talks to, read when the page opens rather than baked into the bundle.
 *
 * The two values used to come from `$env/static/public`, which Vite replaces at build time. That is fine
 * when whoever builds is whoever deploys, and it is exactly what stops a published image from existing:
 * every family would have to rebuild the app to point it at their own database. Reading them at start-up
 * instead is what lets the same files be handed to everybody and configured on the machine that runs them.
 *
 * The values stay public — they ship in what the browser downloads either way. It is the database rules
 * that protect the data, not the secrecy of these two lines.
 */
export type InstanceConfig = {
	url: string;
	anonKey: string;
};

/**
 * Reads a configuration object, or null if it says nothing usable.
 *
 * Null rather than an exception, and rather than a half-filled object: the caller has a screen to show for
 * "not configured yet", which is the normal state of a container started without its variables. An
 * exception here would give a blank page and a stack trace in the console — the two things that teach an
 * installer nothing.
 *
 * A placeholder left as it was in the example file counts as absent. Otherwise the app would try to reach
 * a host that does not exist and report a network error, sending whoever installed it looking at their
 * firewall for a value they simply never set.
 */
const PLACEHOLDERS = new Set(['', 'changeme', 'your-supabase-url', 'your-anon-key']);

export function readInstanceConfig(source: unknown): InstanceConfig | null {
	if (!source || typeof source !== 'object') return null;

	const raw = source as Record<string, unknown>;
	const url = clean(raw.url);
	const anonKey = clean(raw.anonKey);

	if (!url || !anonKey) return null;
	if (!isHttpUrl(url)) return null;

	return { url, anonKey };
}

function clean(value: unknown): string {
	const text = typeof value === 'string' ? value.trim() : '';
	return PLACEHOLDERS.has(text.toLowerCase()) ? '' : text;
}

/**
 * An address the browser can actually call. A value pasted with its quotes, a path alone, or the name of
 * the variable copied instead of its content all land here — and each one would otherwise surface much
 * later as an opaque fetch failure.
 */
function isHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}
