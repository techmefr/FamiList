/**
 * Combien de temps laisser la caméra chercher avant de proposer autre chose.
 *
 * Une carte bien présentée est lue en une seconde ou deux. Passé six secondes, ce n'est plus une
 * question de patience : c'est le reflet de l'écran, la pellicule froissée ou la lumière qui
 * empêchent la lecture, et attendre davantage n'y change rien. On propose donc la photo à ce
 * moment-là, sans rien couper — le scan peut encore aboutir pendant qu'on lit la suggestion.
 *
 * L'arrêt à trente secondes est là pour celui qui a reposé le téléphone : au-delà, la caméra
 * chauffe et vide la batterie pour rien. C'est long à dessein, parce qu'une coupure au moment où
 * l'on cherche le bon angle serait plus agaçante que le balayage lui-même.
 */
export const SCAN_SUGGEST_MS = 6_000;
export const SCAN_TIMEOUT_MS = 30_000;

export type ScanOutcome = 'stopped' | 'timeout';

/**
 * Un arrêt demandé n'est pas un échec : afficher « aucun code trouvé » parce qu'on vient d'appuyer
 * sur « Arrêter » ferait passer un geste volontaire pour une panne.
 */
export function scanOutcome(aborted: boolean): ScanOutcome {
	return aborted ? 'stopped' : 'timeout';
}
