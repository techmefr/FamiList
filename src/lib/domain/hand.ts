/**
 * Main dominante : de quel côté de l'écran se posent les commandes qu'on atteint au pouce.
 *
 * Deux valeurs seulement, et droitier par défaut : c'est le placement d'origine du bouton de
 * création, et la main la plus répandue. Un « système » n'aurait aucun sens ici — aucune plateforme
 * ne publie cette information.
 *
 * Attention, ce réglage n'est pas une propriété logique. Une main gauche reste une main gauche
 * quand l'interface se lit de droite à gauche : le côté visé est physique, il ne suit pas `dir`.
 */
export type Hand = 'right' | 'left';

export const HANDS: Hand[] = ['right', 'left'];

export const isHand = (value: unknown): value is Hand => HANDS.includes(value as Hand);
