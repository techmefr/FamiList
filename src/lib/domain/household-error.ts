/**
 * Les refus de la base, dits dans la langue de la personne.
 *
 * Les fonctions du foyer lèvent des exceptions écrites pour un journal, en français sans accents
 * et jamais traduites : « code invalide ou expire », « compte non valide ». Affichées telles
 * quelles, elles se ressemblent toutes — on ne sait pas si le code est mauvais, s'il faut d'abord
 * quitter son foyer, ou s'il manque un code de vérification.
 *
 * Le code SQLSTATE ne suffit pas à les séparer : deux refus très différents partagent `22023`.
 * On lit donc le message, et on retombe sur un texte générique pour ce qu'on ne reconnaît pas —
 * jamais sur le message brut, qui ne veut rien dire pour qui n'a pas écrit la base.
 */
export type HouseholdErrorKey =
	| 'household.errorCode'
	| 'household.errorSecondFactor'
	| 'household.errorNotApproved'
	| 'household.errorLeaveFirst'
	| 'household.errorLastMember'
	| 'household.errorUnknown';

export function householdErrorKey(message: string, needsSecondFactor = false): HouseholdErrorKey {
	const said = message.toLowerCase();

	if (said.includes('code invalide') || said.includes('expire')) return 'household.errorCode';

	if (said.includes('quittez')) return 'household.errorLeaveFirst';

	if (said.includes('sans membre')) return 'household.errorLastMember';

	// « compte non valide » recouvre deux situations très différentes : un compte que
	// l'administrateur n'a pas encore approuvé, et une session qui s'est arrêtée au mot de passe
	// alors que le compte exige un deuxième facteur. La seconde a une sortie, il faut la dire.
	if (said.includes('compte non valide') || said.includes('foyer inconnu') || said.includes('aucun foyer')) {
		return needsSecondFactor ? 'household.errorSecondFactor' : 'household.errorNotApproved';
	}

	return 'household.errorUnknown';
}
