/**
 * L'appui long : maintenir le doigt sur une chose pour l'ouvrir, sans lui ajouter un bouton.
 *
 * Le geste n'a de sens que s'il se distingue nettement de ses voisins. Trois d'entre eux passent
 * par le même doigt au même endroit : la tape, le glisser pour réordonner, et le défilement de la
 * liste. D'où les deux seuils ci-dessous, et la règle qui les relie — le moindre déplacement
 * franc annule l'appui, parce que c'est alors un glissement, pas une pression.
 */

/** Le temps de maintien avant que le geste compte. */
export const LONGPRESS_MS = 500;

/**
 * Le déplacement toléré pendant ce temps, en pixels. Un doigt posé ne tient pas parfaitement
 * immobile ; au-delà, c'est que la personne fait défiler ou déplace la ligne.
 */
export const LONGPRESS_TOLERANCE = 10;

export function movedTooFar(
	from: { x: number; y: number },
	to: { x: number; y: number },
	tolerance = LONGPRESS_TOLERANCE
) {
	return Math.abs(to.x - from.x) > tolerance || Math.abs(to.y - from.y) > tolerance;
}
