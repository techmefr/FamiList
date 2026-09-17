/**
 * Un cercle actif, parmi plusieurs lus en même temps.
 *
 * Le compte appartient à autant de cercles qu'il veut — la famille, le conjoint, les collègues — et
 * le cache les porte tous : c'est ce qui rend la bascule instantanée et utilisable hors réseau, et
 * ce qui permet au temps réel de poser un article d'un cercle qu'on ne regarde pas.
 *
 * Ce qui est lu partout n'est pas pour autant montré partout. Un seul cercle est actif à la fois, et
 * c'est lui qui décide de ce que l'écran affiche comme de l'endroit où atterrit ce qu'on crée. Trois
 * raisons, dans l'ordre :
 *
 * - les rayons sont propres à chaque cercle, et portent des identifiants distincts pour des noms
 *   identiques. Les fondre donnerait deux « Fruits et légumes » dans le même écran de rangement, et
 *   la détection automatique choisirait l'un des deux au hasard ;
 * - le parcours appris vit dans un magasin, donc dans un cercle. Mélanger les magasins ferait
 *   ranger une liste de famille selon un trajet appris au bureau ;
 * - créer une liste, un magasin ou une carte exige de toute façon un cercle cible. Un affichage
 *   fondu obligerait à le demander à chaque geste, au lieu d'une fois.
 *
 * La liste personnelle est la seule exception, et elle est dans le modèle : elle n'a pas de cercle,
 * donc aucun ne peut la cacher. Elle suit son auteur d'un cercle à l'autre.
 */

export interface CircleScoped {
	householdId?: string;
}

export interface Named {
	id: string;
	name: string;
}

/** Ce qui appartient au cercle actif, et rien d'autre. */
export const ofCircle = <T extends CircleScoped>(rows: readonly T[], circle: string): T[] =>
	circle === '' ? [] : rows.filter((row) => row.householdId === circle);

/**
 * Les listes visibles : celles du cercle actif, et les personnelles, qui n'en ont aucun.
 *
 * Sans le second terme, partager une liste la ferait apparaître et basculer de cercle la ferait
 * disparaître — alors que personne ne l'a fermée.
 */
export const visibleLists = <T extends CircleScoped>(lists: readonly T[], circle: string): T[] =>
	lists.filter((list) => !list.householdId || list.householdId === circle);

/**
 * Le rayon à afficher pour un article.
 *
 * Une liste personnelle traverse les cercles, ses articles gardent le rayon du cercle où on les a
 * saisis, et ce rayon-là n'existe pas dans le cercle d'à côté. On les range alors dans le rayon que
 * la détection propose ici plutôt que de les laisser tomber dans un groupe sans nom en fin de
 * liste. Rien n'est réécrit : revenir au cercle d'origine retrouve le rangement d'origine.
 */
export const resolveAisle = (
	aisleId: string,
	known: ReadonlySet<string>,
	suggested: string
): string => (known.has(aisleId) ? aisleId : suggested);

/**
 * Le cercle à montrer à l'ouverture : celui qu'on regardait, s'il est toujours à nous.
 *
 * On a pu en être sorti depuis un autre appareil ; on retombe alors sur le plus ancien plutôt que
 * sur un écran vide décrivant un cercle auquel on n'appartient plus.
 */
export const defaultCircle = (circles: readonly Named[], remembered: string | null): string => {
	if (remembered && circles.some((circle) => circle.id === remembered)) return remembered;
	return circles[0]?.id ?? '';
};
