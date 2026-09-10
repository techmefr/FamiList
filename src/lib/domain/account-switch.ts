/**
 * Que faire d'une identité que le serveur vient de renvoyer, quand le cache local est déjà à
 * l'écran.
 *
 * `getUser()` interroge le serveur : une coupure réseau répond par une erreur, pas par une absence
 * de compte. Les confondre ferait passer une panne passagère pour un changement de compte, et
 * viderait le cache hors-ligne de quelqu'un qui est pourtant toujours connecté.
 */
export type AccountDecision = 'ignore' | 'remember' | 'reload';

export type KnownAccount = { id: string; known: boolean };
export type AccountAnswer = { id: string; failed: boolean };

export function accountDecision(previous: KnownAccount, answer: AccountAnswer): AccountDecision {
	if (answer.failed) return 'ignore';

	// Premier démarrage sans réseau : on apprend l'identité au premier succès, sans rien vider.
	// Le cache est celui de ce compte, personne n'a changé.
	if (!previous.known) return 'remember';

	return answer.id === previous.id ? 'ignore' : 'reload';
}
