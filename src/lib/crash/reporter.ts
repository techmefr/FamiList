import { browser } from '$app/environment';
import { supabase } from '$db/supabase';
import { buildCrash, type CrashSource } from '$domain/crash';
import { CrashThrottle } from '$domain/crash-throttle';
import { readCrashOutcome } from '$domain/crash-outcome';

/**
 * Le rapporteur de plantages.
 *
 * Sa règle première, avant toute autre considération : il ne doit jamais devenir lui-même un
 * problème. Rien de ce qui se passe ici ne lève, ne rejette, ni n'apparaît à l'écran. Un appareil
 * qui vient de planter est déjà en mauvaise posture ; lui ajouter une seconde erreur, ou pire, un
 * message technique en travers de la page, serait remplacer un bug invisible par un bug visible.
 * D'où les `catch` vides, qui sont ici la bonne réponse et non une négligence.
 *
 * Il n'attend rien non plus : `reportCrash` est synchrone du point de vue de l'appelant. Les
 * gestionnaires d'événement du navigateur et `handleError` de SvelteKit ne peuvent pas attendre une
 * promesse, et un chemin d'erreur qui bloque est un chemin d'erreur qui aggrave.
 */

const throttle = new CrashThrottle();

async function send(cause: unknown, source: CrashSource, path: string) {
	const crash = buildCrash(cause, source, path);
	if (!crash) return;

	if (!throttle.allow(crash.fingerprint, Date.now())) return;

	// Sans session, l'appel serait refusé : `report_crash` n'est accordée qu'à `authenticated`.
	// On préfère ne rien envoyer plutôt que de mettre les plantages en attente d'une connexion qui
	// n'arrivera peut-être jamais — les garder demanderait de les écrire quelque part, c'est-à-dire
	// d'ajouter une écriture de plus sur un chemin qui ne doit rien pouvoir casser.
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

/** Le seul point d'entrée. Il ne rend rien et ne peut rien faire échouer. */
export function reportCrash(cause: unknown, source: CrashSource, path: string) {
	if (!browser) return;

	try {
		void send(cause, source, path).catch(() => {});
	} catch {
		// Même la construction du rapport est protégée : `buildCrash` lit des propriétés d'un objet
		// arbitraire, et un accesseur piégé sur `message` suffirait à relever ici.
	}
}

/**
 * Branche les deux filets du navigateur.
 *
 * `error` attrape ce qui remonte jusqu'à la fenêtre — un gestionnaire d'événement, une minuterie,
 * un module chargé tard. `unhandledrejection` attrape l'autre moitié, et c'est de loin la plus
 * fournie dans cette application : presque tout y est asynchrone, et un `await` oublié transforme
 * n'importe quel échec en rejet muet.
 *
 * Les erreurs de rendu et de navigation ne passent pas par ici : SvelteKit les intercepte avant la
 * fenêtre et les remet à `handleError`, dans `src/hooks.client.ts`. Les échecs de synchronisation
 * non plus : le moteur les rattrape déjà pour alimenter son bandeau, et c'est de là qu'il les
 * transmet — les reprendre ici les compterait deux fois.
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
