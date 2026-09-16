/**
 * Les refus des écritures d'administration, dits dans la langue de la personne.
 *
 * Deux d'entre eux se ressemblent et ne demandent pas du tout le même geste : « reserve aux
 * administrateurs » veut dire que le rôle a été retiré, et il n'y a rien à faire ; « elevation
 * requise » veut dire que le rôle est toujours là mais que la session s'est arrêtée au mot de
 * passe, et là il suffit de finir de se connecter. Affichés bruts, tous deux se lisent comme une
 * porte fermée.
 *
 * Le reste est laissé tel quel — `null`. Les autres refus du panneau sont précis et utiles
 * (« le compte doit etre valide avant d etre promu », « il doit rester au moins un
 * administrateur ») : les remplacer par un texte générique ferait perdre plus qu'il ne traduirait.
 */
export type AdminErrorKey = 'admin.errorDenied' | 'admin.errorSecondFactor';

export function adminErrorKey(message: string): AdminErrorKey | null {
	const said = message.toLowerCase();

	if (said.includes('elevation requise')) return 'admin.errorSecondFactor';

	if (said.includes('reserve aux administrateurs')) return 'admin.errorDenied';

	return null;
}

/** La seule des deux causes qui ait une sortie : le dire à l'écran plutôt que le redéduire. */
export function needsElevation(messages: string[]): boolean {
	return messages.some((message) => adminErrorKey(message) === 'admin.errorSecondFactor');
}
