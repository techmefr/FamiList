import { browser } from '$app/environment';
import { supabase, sentryDsn } from '$db/supabase';
import { buildCrash, type CrashSource } from '$domain/crash';
import { CrashThrottle } from '$domain/crash-throttle';
import { readCrashOutcome } from '$domain/crash-outcome';
import { forwardToSentry } from '$crash/sentry';

/**
 * The crash reporter.
 *
 * Its first rule, before any other consideration: it must never itself become a problem. Nothing here
 * throws, rejects, or appears on screen. A device that has just crashed is already in a bad way; adding a
 * second error to it, or worse, a technical message across the page, would be replacing an invisible bug
 * with a visible one. Hence the empty `catch`es, which here are the right answer and not carelessness.
 *
 * It waits for nothing either: `reportCrash` is synchronous from the caller's point of view. The browser's
 * event handlers and SvelteKit's `handleError` cannot await a promise, and an error path that blocks is an
 * error path that makes things worse.
 */

const throttle = new CrashThrottle();

async function send(cause: unknown, source: CrashSource, path: string) {
	const crash = buildCrash(cause, source, path);
	if (!crash) return;

	if (!throttle.allow(crash.fingerprint, Date.now())) return;

	// Second sinistre facultatif : seul le proprietaire qui a rempli `PUBLIC_SENTRY_DSN` le recoit, sur le
	// meme evenement deja scrubbe. Sans DSN, `sentryDsn` vaut `null` et cette ligne ne fait rien de plus
	// qu'un appel de fonction qui retourne aussitot — aucun appel reseau supplementaire.
	if (sentryDsn) forwardToSentry(sentryDsn, crash);

	// With no session, the call would be refused: `report_crash` is only granted to `authenticated`. We
	// prefer to send nothing rather than hold crashes waiting for a sign-in that may never come — keeping
	// them would mean writing them somewhere, that is, adding one more write on a path that must not be able
	// to break anything.
	const { data: auth } = await supabase.auth.getSession();
	if (!auth.session) return;

	const { data } = await supabase.rpc('report_crash', {
		fingerprint: crash.fingerprint,
		source: crash.source,
		message: crash.message,
		stack: crash.stack,
		path: crash.path,
		user_agent: navigator.userAgent
	});

	if (readCrashOutcome(data).exhausted) throttle.stop();
}

/** The only entry point. It returns nothing and cannot make anything fail. */
export function reportCrash(cause: unknown, source: CrashSource, path: string) {
	if (!browser) return;

	try {
		void send(cause, source, path).catch(() => {});
	} catch {
		// Even building the report is protected: `buildCrash` reads properties of an arbitrary object, and a
		// booby-trapped getter on `message` would be enough to throw here.
	}
}

/**
 * Hooks up the browser's two nets.
 *
 * `error` catches what reaches the window — an event handler, a timer, a module loaded late.
 * `unhandledrejection` catches the other half, and it is by far the busier in this application: almost
 * everything here is asynchronous, and a forgotten `await` turns any failure into a silent rejection.
 *
 * Render and navigation errors do not come through here: SvelteKit intercepts them before the window and
 * hands them to `handleError`, in `src/hooks.client.ts`. Sync failures do not either: the engine already
 * catches them to feed its banner, and it forwards them from there — catching them here would count them
 * twice.
 */
export function watchCrashes() {
	if (!browser) return;

	addEventListener('error', (event) => {
		reportCrash(event.error ?? event.message, 'window', location.pathname);
	});

	addEventListener('unhandledrejection', (event) => {
		reportCrash(event.reason, 'promise', location.pathname);
	});
}
