/**
 * What we agree to go and fetch, and above all what we refuse.
 *
 * A function fetching a page on behalf of whoever asks is an open proxy as long as it is not bounded: from
 * the Supabase network, `http://169.254.169.254/` returns the infrastructure's tokens, and `http://10.0.0.5/`
 * reaches services nobody ever exposed. The check is therefore an allow list — https, default port, a name
 * that is not a private address — and not a deny list of patterns to avoid.
 *
 * No Deno dependency here: the guard is the most sensitive piece of the lot, it must be testable by vitest
 * like any pure function, and replayed at every redirect.
 */

export const REFUSAL_REASONS = [
	'invalid',
	'scheme',
	'credentials',
	'port',
	'private_host'
] as const;

export type RefusalReason = (typeof REFUSAL_REASONS)[number];

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: RefusalReason };

/** Names designating the machine itself or its local network, whatever the resolution. */
const BLOCKED_HOSTS = new Set([
	'localhost',
	'localhost.localdomain',
	'ip6-localhost',
	'ip6-loopback',
	'metadata',
	'metadata.google.internal'
]);

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.onion'];

function isPrivateIpv4(host: string): boolean {
	const parts = host.split('.');
	if (parts.length !== 4) return false;

	const bytes = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : -1));
	if (bytes.some((byte) => byte < 0 || byte > 255)) return false;

	const [a, b] = bytes;
	if (a === 0 || a === 10 || a === 127) return true;
	if (a === 169 && b === 254) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	// Carrier-grade shared space (RFC 6598), routable nowhere else.
	if (a === 100 && b >= 64 && b <= 127) return true;
	return a >= 224;
}

function isPrivateIpv6(host: string): boolean {
	const address = host.replace(/^\[|\]$/g, '').toLowerCase();
	if (!address.includes(':')) return false;
	if (address === '::' || address === '::1') return true;
	// fc00::/7 (unique local addresses) and fe80::/10 (link local).
	if (/^f[cd][0-9a-f]{2}:/.test(address)) return true;
	if (/^fe[89ab][0-9a-f]:/.test(address)) return true;
	// ::ffff:10.0.0.1 — a disguised v4 address is still a v4 address.
	const mapped = address.match(/^::ffff:([0-9.]+)$/);
	return mapped ? isPrivateIpv4(mapped[1]) : false;
}

/**
 * Returns the URL to fetch, or the reason for the refusal.
 *
 * The port is constrained to the implicit 443: an `https://example.test:22/` does not serve a recipe page,
 * it serves to scan ports from a trusted address.
 *
 * The name must contain a dot. That is not fussiness: `https://intranet/` resolves, inside a company
 * network, to an internal machine, and that is exactly what we refuse here.
 */
export function checkUrl(raw: string): UrlCheck {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return { ok: false, reason: 'invalid' };
	}

	if (url.protocol !== 'https:') return { ok: false, reason: 'scheme' };
	if (url.username !== '' || url.password !== '') return { ok: false, reason: 'credentials' };
	if (url.port !== '') return { ok: false, reason: 'port' };

	const host = url.hostname.toLowerCase();
	if (host === '') return { ok: false, reason: 'invalid' };
	if (BLOCKED_HOSTS.has(host)) return { ok: false, reason: 'private_host' };
	if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
		return { ok: false, reason: 'private_host' };
	}
	if (isPrivateIpv4(host) || isPrivateIpv6(host)) return { ok: false, reason: 'private_host' };
	if (!host.includes('.')) return { ok: false, reason: 'private_host' };

	return { ok: true, url };
}
