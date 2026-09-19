import type { Crash } from '$domain/crash';

/**
 * Envoi facultatif vers Sentry, second sinistre pour le seul proprietaire qui a rempli `PUBLIC_SENTRY_DSN`.
 *
 * Pas de `@sentry/sveltekit` ici : le SDK embarque un plugin de build, l'upload de source maps et une
 * instrumentation cote serveur dont une SPA statique n'a rien a faire, pour un projet qui n'a par ailleurs
 * aucune dependance vers Sentry. L'API d'ingestion de Sentry est un simple `POST` HTTP documente (le format
 * "envelope") ; quelques lignes suffisent, et elles restent aussi synchrones et silencieuses que le reste
 * du reporter — jamais de `throw`, jamais rien a l'ecran.
 */

interface ParsedDsn {
	envelopeUrl: string;
	publicKey: string;
}

/**
 * Un DSN Sentry ressemble a `https://<cle>@<host>/<projet>`. On en tire l'URL d'ingestion "envelope" :
 * `https://<host>/api/<projet>/envelope/?sentry_key=<cle>&sentry_version=7`.
 */
function parseDsn(dsn: string): ParsedDsn | null {
	try {
		const url = new URL(dsn);
		const publicKey = url.username;
		const projectId = url.pathname.replace(/^\//, '');
		if (!publicKey || !projectId) return null;

		return {
			publicKey,
			envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`
		};
	} catch {
		return null;
	}
}

function eventId(): string {
	return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Construit l'enveloppe attendue par Sentry : une ligne d'en-tete, une ligne d'en-tete d'item, puis
 * l'evenement lui-meme. Le `crash` fourni est deja celui, scrubbe, ecrit dans `client_errors` — meme
 * fingerprint, meme message, meme pile, un seul appelant pour les deux sinistres.
 */
function buildEnvelope(crash: Crash, id: string): string {
	const itemHeader = { type: 'event', content_type: 'application/json' };

	const event = {
		event_id: id,
		timestamp: new Date().toISOString(),
		platform: 'javascript',
		level: 'error',
		message: crash.message,
		tags: { source: crash.source, fingerprint: crash.fingerprint },
		extra: { stack: crash.stack },
		request: { url: crash.path }
	};

	return `${JSON.stringify({ event_id: id, sent_at: new Date().toISOString() })}\n${JSON.stringify(itemHeader)}\n${JSON.stringify(event)}`;
}

/**
 * Point d'entree unique. Ne renvoie rien, n'attend rien du site appelant : comme `reportCrash`, elle doit
 * pouvoir etre invoquee depuis un gestionnaire synchrone sans jamais faire echouer l'appelant.
 */
export function forwardToSentry(dsn: string, crash: Crash): void {
	try {
		const parsed = parseDsn(dsn);
		if (!parsed) return;

		const body = buildEnvelope(crash, eventId());

		void fetch(parsed.envelopeUrl, {
			method: 'POST',
			headers: { 'content-type': 'application/x-sentry-envelope' },
			body
		}).catch(() => {});
	} catch {
		// Un DSN mal forme ou un `fetch` indisponible ne doit jamais remonter jusqu'a l'appelant.
	}
}
