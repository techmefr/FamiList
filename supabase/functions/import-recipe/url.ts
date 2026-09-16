/**
 * Ce qu on accepte d aller chercher, et surtout ce qu on refuse.
 *
 * Une fonction qui recupere une page pour le compte de qui la demande est un proxy ouvert tant
 * qu on ne la borne pas : depuis le reseau Supabase, `http://169.254.169.254/` rend les jetons de
 * l infrastructure, et `http://10.0.0.5/` atteint des services que personne n a jamais exposes.
 * La verification est donc une liste blanche — https, port par defaut, nom qui n est pas une
 * adresse privee — et non une liste noire de motifs a eviter.
 *
 * Aucune dependance Deno ici : la garde est la piece la plus sensible du lot, elle doit se tester
 * par vitest comme n importe quelle fonction pure, et se rejouer a chaque redirection.
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

/** Noms qui designent la machine elle-meme ou son reseau local, quelle que soit la resolution. */
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
	// Espace partage des operateurs (RFC 6598), routable nulle part ailleurs.
	if (a === 100 && b >= 64 && b <= 127) return true;
	return a >= 224;
}

function isPrivateIpv6(host: string): boolean {
	const address = host.replace(/^\[|\]$/g, '').toLowerCase();
	if (!address.includes(':')) return false;
	if (address === '::' || address === '::1') return true;
	// fc00::/7 (adresses locales uniques) et fe80::/10 (lien local).
	if (/^f[cd][0-9a-f]{2}:/.test(address)) return true;
	if (/^fe[89ab][0-9a-f]:/.test(address)) return true;
	// ::ffff:10.0.0.1 — une adresse v4 deguisee reste une adresse v4.
	const mapped = address.match(/^::ffff:([0-9.]+)$/);
	return mapped ? isPrivateIpv4(mapped[1]) : false;
}

/**
 * Rend l URL a aller chercher, ou la raison du refus.
 *
 * Le port est contraint au 443 implicite : un `https://exemple.test:22/` ne sert pas une page de
 * recette, il sert a balayer des ports depuis une adresse de confiance.
 *
 * Le nom doit contenir un point. Ce n est pas de la coquetterie : `https://intranet/` resout, dans
 * un reseau d entreprise, vers une machine interne, et c est exactement ce qu on refuse ici.
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
