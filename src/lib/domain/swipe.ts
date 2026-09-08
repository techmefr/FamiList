/**
 * Le glissement latéral d'une ligne : de quel côté, à partir de quand, et de combien elle suit
 * le doigt.
 *
 * Tout est ici plutôt que dans le composant parce que c'est là que se cachent les décisions —
 * quand un geste cesse d'être un défilement, quand il compte comme déclenché — et qu'elles se
 * vérifient bien mieux avec des nombres qu'avec un doigt sur un écran.
 */

/** En deçà, on ne sait pas encore si l'intention est de faire défiler la page ou de glisser. */
export const SWIPE_SLOP = 12;

/** La distance qui déclenche l'action ordinaire — cocher. */
export const SWIPE_THRESHOLD = 72;

/**
 * Celle qui déclenche la suppression. Plus loin, exprès : le bouton corbeille demande de viser
 * une cible de 44 px, un glissement part tout seul d'un pouce posé de travers. Supprimer un
 * article par mégarde coûte plus cher que d'avoir à glisser un centimètre de plus.
 */
export const SWIPE_DESTRUCTIVE = 110;

/** La course maximale : au-delà la ligne ne bouge plus, elle a dit tout ce qu'elle avait à dire. */
export const SWIPE_MAX = 140;

/**
 * Le côté d'où vient l'action, en propriétés logiques : `start` est révélé en glissant vers la
 * fin de la ligne, `end` en glissant vers son début. En arabe, la ligne se lit dans l'autre sens
 * et les deux gestes s'inversent d'eux-mêmes.
 */
export type SwipeSide = 'start' | 'end';

export interface SwipeLimits {
	rtl?: boolean;
	startAt?: number;
	endAt?: number;
}

/**
 * Un geste horizontal, ou un défilement vertical ?
 *
 * On ne prend la main que si le mouvement est franchement horizontal : sur un téléphone, la même
 * surface sert à faire défiler la liste, et un défilement qui se transforme en suppression est
 * la pire chose qu'on puisse faire ici.
 */
export function isHorizontalGesture(dx: number, dy: number, slop = SWIPE_SLOP): boolean {
	return Math.abs(dx) > slop && Math.abs(dx) > Math.abs(dy);
}

/**
 * De combien la ligne se décale.
 *
 * Elle suit le doigt tant qu'on n'a rien déclenché, puis résiste : la course se comprime au-delà
 * du seuil et s'arrête net au maximum. C'est ce ralentissement qui fait sentir qu'on est allé
 * assez loin, sans avoir à lire quoi que ce soit.
 */
export function swipeOffset(dx: number, threshold = SWIPE_THRESHOLD, max = SWIPE_MAX): number {
	const distance = Math.abs(dx);
	if (distance <= threshold) return dx;

	const signe = Math.sign(dx);
	const reste = distance - threshold;

	return signe * Math.min(max, threshold + reste * 0.35);
}

/**
 * Le côté déclenché au relâchement, ou rien si on n'est pas allé assez loin — auquel cas la ligne
 * revient à sa place et il ne s'est rien passé.
 */
export function swipeSide(offset: number, limits: SwipeLimits = {}): SwipeSide | null {
	const { rtl = false, startAt = SWIPE_THRESHOLD, endAt = SWIPE_THRESHOLD } = limits;
	const logique = rtl ? -offset : offset;

	if (logique >= startAt) return 'start';
	if (logique <= -endAt) return 'end';
	return null;
}
