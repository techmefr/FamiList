/**
 * La géométrie d'un réordonnancement au doigt.
 *
 * Le glisser-déposer HTML5 ignore le tactile : sur téléphone, il ne se passait rien. Ce qui suit
 * remplace ce mécanisme par des événements de pointeur, qui eux couvrent doigt, stylet et souris
 * d'un même geste. Le calcul est ici, sans DOM, pour être vérifiable : c'est lui qui décide où la
 * ligne saisie retombe, et de combien les autres s'écartent pour lui faire place.
 */

/** Déplace un élément d'une position à une autre, sans toucher au tableau d'origine. */
export function move<T>(items: T[], from: number, to: number): T[] {
	const next = [...items];
	const [moved] = next.splice(from, 1);
	next.splice(to, 0, moved);
	return next;
}

/**
 * Où retombe la ligne saisie, d'après le centre qu'elle occupe maintenant.
 *
 * On compare à la moitié de chaque ligne plutôt qu'à son bord : franchir la moitié d'un voisin,
 * c'est avoir pris sa place. Comparer aux bords ferait sauter l'ordre dès le premier millimètre,
 * et hésiter entre deux positions au moindre tremblement de la main.
 */
export function dropIndex(
	centre: number,
	tops: number[],
	hauteurs: number[],
	depart: number
): number {
	let cible = depart;

	for (let i = 0; i < tops.length; i++) {
		const milieu = tops[i] + hauteurs[i] / 2;
		if (i < depart && centre < milieu) cible = Math.min(cible, i);
		else if (i > depart && centre > milieu) cible = Math.max(cible, i);
	}

	return cible;
}

/**
 * De combien chaque ligne doit se décaler pour que l'ordre visé se lise déjà à l'écran.
 *
 * Les hauteurs ne sont pas égales — un article avec une note est plus haut qu'un autre — donc on
 * ne peut pas décaler d'un « pas » constant : on recompose les positions de tout le monde dans
 * l'ordre visé, et on en déduit le déplacement de chacun. Le décalage rendu pour la ligne saisie
 * est celui de sa case d'arrivée ; l'appelant lui préfère la position réelle du doigt.
 */
export function slotShifts(
	tops: number[],
	hauteurs: number[],
	ecart: number,
	depart: number,
	cible: number
): number[] {
	const ordre = move(
		tops.map((_, i) => i),
		depart,
		cible
	);

	const decalages = new Array<number>(tops.length).fill(0);
	let y = tops[0] ?? 0;

	for (const index of ordre) {
		decalages[index] = y - tops[index];
		y += hauteurs[index] + ecart;
	}

	return decalages;
}

/** À quelle distance du bord de l'écran la page commence à défiler d'elle-même. */
export const BORD = 88;

/** Le pas maximal d'un défilement automatique, par image. */
export const VITESSE = 14;

/**
 * De combien la page doit défiler quand le doigt tient une ligne près d'un bord.
 *
 * Sans ce défilement, une ligne ne peut pas dépasser la hauteur de l'écran : on tient la carte, on
 * arrive en bas, et il n'y a nulle part où aller. Le pas croît avec l'enfoncement dans la zone de
 * bord, pour qu'un effleurement ne parte pas en fuite ; il est négatif vers le haut.
 */
export function edgeScrollStep(
	y: number,
	hauteur: number,
	bord = BORD,
	vitesse = VITESSE
): number {
	const dessus = y - bord;
	if (dessus < 0) return Math.max(-vitesse, dessus / 6);

	const dessous = hauteur - bord - y;
	if (dessous < 0) return Math.min(vitesse, -dessous / 6);

	return 0;
}
