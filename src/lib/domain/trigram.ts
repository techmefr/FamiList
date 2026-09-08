import { slugify } from './slug';

/**
 * Les initiales d'un magasin, telles qu'elles s'affichent dans la pastille de couleur.
 *
 * Trois caractères et non deux, parce que les enseignes sont presque toutes en un seul mot :
 * prendre l'initiale de chaque mot donne « C » pour Carrefour comme pour Casino, et deux lettres
 * ne séparent toujours pas Leclerc de Lidl une fois abrégés côte à côte. CAR, CAS, LEC, LID se
 * distinguent du premier coup d'œil, et c'est exactement ce qu'on demande à une pastille.
 *
 * La règle tient en une phrase — les trois premiers caractères du nom —, ce qui compte : c'est ce
 * qui permet de deviner ce qui va s'afficher sans avoir à le vérifier. Deux enseignes qui
 * commencent pareil recevront le même trigramme ; la pastille n'est jamais seule, le nom complet
 * l'accompagne partout, et le champ reste modifiable.
 */
const LONGUEUR = 3;

export function trigram(name: string): string {
	// slugify enlève les accents, les ligatures et la ponctuation : « E.Leclerc » donne ELE et
	// « Éco Marché » donne ECO, sans qu'un point ou un accent ne prenne la place d'une lettre.
	const lettres = slugify(name).replaceAll('-', '');
	if (lettres) return lettres.slice(0, LONGUEUR).toUpperCase();

	// Un nom sans lettre ni chiffre — un emoji seul, « ### ». slugify le vide entièrement ; plutôt
	// qu'une pastille blanche, on garde ce qui a été tapé. Le découpage passe par les points de
	// code, sinon un emoji serait coupé en deux moitiés de paire de substitution.
	return [...name.trim().replaceAll(/\s+/g, '')].slice(0, LONGUEUR).join('').toUpperCase();
}
