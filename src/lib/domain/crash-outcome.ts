/**
 * Ce que la base répond quand on lui dépose un plantage.
 *
 * `report_crash` ne lève pas : une exception annulerait la transaction, donc le nettoyage de
 * rétention et l'incrémentation du compteur avec elle. Elle renvoie un objet, comme
 * `submit_bug_report` et `redeem_invite`.
 *
 * Rien de tout cela n'arrive sous les yeux de qui que ce soit — un rapporteur d'erreurs qui
 * afficherait ses propres échecs serait pire que pas de rapporteur du tout. La seule chose qu'on
 * lit ici, c'est s'il faut cesser d'appeler.
 *
 * Tout ce qu'on ne reconnaît pas est traité comme un simple échec et non comme un plafond : une
 * fonction mise à jour ou un cache de schéma en retard ne doivent pas éteindre le rapporteur pour
 * le reste de la session.
 */
export interface CrashOutcome {
	/** Le compte a épuisé son quota du jour : inutile de rappeler avant le prochain chargement. */
	exhausted: boolean;
}

export function readCrashOutcome(payload: unknown): CrashOutcome {
	if (payload === null || typeof payload !== 'object') return { exhausted: false };

	return { exhausted: (payload as { status?: unknown }).status === 'rate_limited' };
}
