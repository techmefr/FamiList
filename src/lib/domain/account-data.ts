/**
 * Emporter ses données, puis fermer son compte.
 *
 * Le geste de confirmation est la saisie de sa propre adresse de courriel. Une case à cocher se
 * coche sans lire, et un mot à recopier devrait être traduit dans dix langues — donc être lu dans
 * la bonne. L'adresse, elle, n'appartient qu'à la personne, ne se devine pas depuis l'écran d'un
 * autre, et la retaper prend le temps qu'il faut pour changer d'avis.
 */
export type DeleteAccountErrorKey =
	| 'security.deleteErrorLastAdmin'
	| 'security.deleteErrorDemo'
	| 'security.deleteErrorSecondFactor'
	| 'security.deleteErrorUnknown';

/**
 * La comparaison ignore la casse et les espaces autour : une adresse de courriel n'est pas sensible
 * à la casse, et un clavier de téléphone ajoute volontiers une majuscule ou une espace finale. Ce
 * n'est pas un secret à deviner, c'est une confirmation à écrire — la durcir ne protégerait rien et
 * bloquerait la personne au moment où elle a le plus besoin que ça marche.
 */
export function matchesConfirmation(typed: string, email: string | null): boolean {
	const target = (email ?? '').trim().toLowerCase();

	return target !== '' && typed.trim().toLowerCase() === target;
}

export function deleteAccountErrorKey(message: string): DeleteAccountErrorKey {
	const said = message.toLowerCase();

	if (said.includes('administrateur')) return 'security.deleteErrorLastAdmin';

	if (said.includes('demonstration')) return 'security.deleteErrorDemo';

	if (said.includes('deuxieme facteur')) return 'security.deleteErrorSecondFactor';

	return 'security.deleteErrorUnknown';
}

/** Un nom de fichier qui se retrouve dans un dossier de téléchargements six mois plus tard. */
export function exportFileName(at: Date): string {
	const day = [
		at.getFullYear(),
		String(at.getMonth() + 1).padStart(2, '0'),
		String(at.getDate()).padStart(2, '0')
	].join('-');

	return `familiste-mes-donnees-${day}.json`;
}
