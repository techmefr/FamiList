/**
 * Loupe : agrandir une étiquette de produit à l'écran.
 *
 * Deux grossissements se combinent. Celui de l'objectif, quand l'appareil photo l'accepte, donne
 * une image nette ; celui du navigateur, un simple agrandissement de l'image reçue, dépanne au-delà
 * mais devient vite flou. On demande donc à l'objectif tout ce qu'il sait faire, et on complète.
 */
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 5;

export interface ZoomRange {
	min: number;
	max: number;
}

/**
 * Garde-fou commun aux deux calculs. Interne : le curseur borne déjà la valeur par ses attributs
 * min et max, plus rien à l'extérieur n'a de raison de reborner.
 */
function clampZoom(value: number): number {
	if (!Number.isFinite(value)) return ZOOM_MIN;

	return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 10) / 10));
}

/** Ce que l'objectif peut réellement appliquer, sans jamais sortir de ce qu'il déclare accepter. */
export function opticalZoom(requested: number, range: ZoomRange | null): number {
	if (!range || !(range.max > range.min)) return 1;

	return Math.min(range.max, Math.max(range.min, clampZoom(requested)));
}

/**
 * Le reste du chemin, à la charge du navigateur.
 *
 * Le prototype ajoutait ici un supplément fixe, indépendant de ce que l'objectif avait accordé :
 * sur un appareil dont le zoom s'arrête à 2×, demander 5× n'agrandissait presque plus rien. Le
 * rapport entre les deux donne à l'inverse le grossissement demandé, quel que soit l'appareil.
 */
export function digitalZoom(requested: number, applied: number): number {
	const target = clampZoom(requested);

	return applied > 0 ? Math.max(1, target / applied) : target;
}

/**
 * Ce qu'on applique à l'image pour la rendre lisible, en un seul filtre CSS.
 *
 * Deux besoins différents, et qui se cumulent. Sans torche matérielle, on éclaircit l'image
 * reçue : ce n'est pas un vrai éclairage, mais sur une étiquette mate un peu grise, cela suffit
 * souvent à décoller le texte du fond. Le mode contraste, lui, sert quand le texte est imprimé
 * en gris clair sur fond blanc, ou en couleur sur une photo : on retire la couleur, qui ne porte
 * ici aucune information, et on écarte les gris restants.
 *
 * Les deux contrastes ne s'empilent pas — celui de la torche est écrasé par celui du mode, qui
 * est plus fort. Cumulés, ils bouchaient les noirs et mangeaient les jambages.
 *
 * Assemblé ici plutôt que dans le balisage : deux états qui se combinent, c'est exactement ce
 * qu'on finit par écrire de travers dans une interpolation de chaîne.
 */
export interface ReadingAids {
	contrast: boolean;
	brighten: boolean;
}

export function viewFilter({ contrast, brighten }: ReadingAids): string {
	const filters: string[] = [];

	if (brighten) filters.push('brightness(1.35)');
	if (contrast) filters.push('grayscale(1)', 'contrast(1.9)');
	else if (brighten) filters.push('contrast(1.05)');

	return filters.length > 0 ? filters.join(' ') : 'none';
}
