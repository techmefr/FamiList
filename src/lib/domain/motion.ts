/**
 * Réglage du mouvement, et sens des transitions de page.
 *
 * Trois valeurs comme pour le thème : « système » suit `prefers-reduced-motion`, les deux autres
 * tranchent. Système est la valeur par défaut — une personne qui a déjà demandé moins d'animations
 * à son téléphone n'a pas à le redemander ici.
 */
export type MotionPreference = 'system' | 'full' | 'none';

export const MOTION_PREFERENCES: MotionPreference[] = ['system', 'full', 'none'];

export const isMotionPreference = (value: unknown): value is MotionPreference =>
	MOTION_PREFERENCES.includes(value as MotionPreference);

export function animates(preference: MotionPreference, prefersReducedMotion: boolean): boolean {
	if (preference === 'none') return false;
	if (preference === 'full') return true;

	return !prefersReducedMotion;
}

export type NavDirection = 'forward' | 'back' | 'none';

const depth = (path: string) => path.split('/').filter(Boolean).length;

/**
 * De quel côté la page suivante entre.
 *
 * Entre deux onglets, c'est l'ordre de la barre de navigation qui décide : aller vers la droite de
 * la barre fait entrer par la droite. Ailleurs, c'est la profondeur du chemin — `/l/xyz` est un
 * cran plus loin que `/`, donc en avant, et le retour ressort par la gauche. Un aller-retour donne
 * ainsi deux mouvements opposés, ce qui est la seule chose que l'utilisateur lit vraiment dans une
 * transition de page.
 */
export function navDirection(from: string, to: string, order: string[] = []): NavDirection {
	if (from === to) return 'none';

	const fromIndex = order.indexOf(from);
	const toIndex = order.indexOf(to);

	if (fromIndex !== -1 && toIndex !== -1) return toIndex > fromIndex ? 'forward' : 'back';

	return depth(to) < depth(from) ? 'back' : 'forward';
}
