/**
 * Ce qui décide qu'un plantage vaut un appel réseau.
 *
 * Une boucle de rendu qui échoue ne lève pas une fois : elle lève à chaque image, des centaines de
 * fois par seconde. La base sait déjà se défendre — elle ne réécrit pas la même empreinte deux fois
 * en trente secondes — mais elle ne se défend qu'après avoir reçu l'appel. Un appareil qui part en
 * boucle enverrait alors des centaines de requêtes par seconde depuis un navigateur déjà en
 * difficulté, ce qui est exactement le moment où il ne faut rien lui demander de plus.
 *
 * D'où ce filtre, en mémoire, avant le réseau. Il est volontairement pur et sans horloge : le temps
 * lui est passé, ce qui le rend testable sans attendre.
 *
 * Il ne survit pas au rechargement de la page, et c'est voulu. Le persister demanderait d'écrire
 * dans le stockage local depuis un chemin de plantage, c'est-à-dire d'ajouter une écriture qui peut
 * elle-même échouer là où plus rien ne doit échouer.
 */

/** Deux occurrences de la même empreinte envoyées au plus une fois par minute. */
export const CRASH_REPEAT_DELAY_MS = 60_000;

/**
 * Plafond d'envois sur la durée de vie de l'onglet. Vingt plantages distincts, c'est déjà une
 * session inutilisable : au-delà, on n'apprend plus rien et on n'ajoute que du bruit.
 */
export const CRASH_SESSION_LIMIT = 20;

export class CrashThrottle {
	#lastSent = new Map<string, number>();
	#sent = 0;
	#stopped = false;

	/**
	 * Vrai si ce plantage doit partir maintenant. Un appel qui répond vrai compte comme envoyé :
	 * l'appelant n'a pas à le signaler ensuite, et un chemin d'erreur avec deux étapes à ne pas
	 * oublier est un chemin d'erreur qu'on oublie.
	 */
	allow(fingerprint: string, now: number): boolean {
		if (this.#stopped) return false;

		const previous = this.#lastSent.get(fingerprint);
		if (previous !== undefined && now - previous < CRASH_REPEAT_DELAY_MS) return false;

		if (this.#sent >= CRASH_SESSION_LIMIT) return false;

		this.#lastSent.set(fingerprint, now);
		this.#sent += 1;
		return true;
	}

	/**
	 * Arrête tout jusqu'au prochain chargement.
	 *
	 * Appelé quand la base répond qu'un plafond quotidien est atteint : continuer d'appeler une
	 * fonction qui a déjà dit non est du bruit pur, et cet appareil-là a manifestement autre chose
	 * à faire.
	 */
	stop() {
		this.#stopped = true;
	}

	get stopped() {
		return this.#stopped;
	}
}
