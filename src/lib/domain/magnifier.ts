/**
 * Loupe : agrandir une étiquette de produit à l'écran.
 *
 * Deux grossissements se combinent. Celui de l'objectif, quand l'appareil photo l'accepte, donne
 * une image nette ; celui du navigateur, un simple agrandissement de l'image reçue, dépanne au-delà
 * mais devient vite flou. On demande donc à l'objectif tout ce qu'il sait faire, et on complète.
 */
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 5;
export const ZOOM_STEP = 0.5;

export interface ZoomRange {
	min: number;
	max: number;
}

export function clampZoom(value: number): number {
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
