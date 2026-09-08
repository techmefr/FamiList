/**
 * Unités de quantité proposées à l'ajout d'un article.
 *
 * On stocke un identifiant stable, pas le mot affiché : « pièce » écrit tel quel en base restait
 * en français pour quelqu'un qui lit l'app en arabe, et changer de langue n'y pouvait rien.
 * L'étiquette vient de la traduction, la base ne garde que la clef.
 *
 * L'ordre est celui de la liste déroulante : la pièce d'abord parce que c'est le cas courant,
 * puis les poids, les volumes, et enfin les conditionnements.
 */
export const UNITS = [
	'piece',
	'g',
	'kg',
	'ml',
	'l',
	'pack',
	'box',
	'bottle',
	'jar',
	'bag',
	'bunch',
	'slice',
	'tray',
	'roll',
	'brick'
] as const;

export type UnitId = (typeof UNITS)[number];

export const DEFAULT_UNIT: UnitId = 'piece';

/**
 * Ce qui a pu être saisi à la main avant que le champ devienne une liste, et les pluriels que
 * quelqu'un écrit naturellement. Sans cette table, un article créé hier afficherait « pièce » en
 * dur pendant que ses voisins se traduisent — l'incohérence se verrait plus que le problème
 * d'origine.
 */
const ALIASES: Record<string, UnitId> = {
	pièce: 'piece',
	pièces: 'piece',
	pieces: 'piece',
	pce: 'piece',
	pcs: 'piece',
	unité: 'piece',
	unite: 'piece',
	gr: 'g',
	gramme: 'g',
	grammes: 'g',
	kilo: 'kg',
	kilos: 'kg',
	kilogramme: 'kg',
	litre: 'l',
	litres: 'l',
	paquet: 'pack',
	paquets: 'pack',
	boîte: 'box',
	boite: 'box',
	boîtes: 'box',
	boites: 'box',
	bouteille: 'bottle',
	bouteilles: 'bottle',
	pot: 'jar',
	pots: 'jar',
	sachet: 'bag',
	sachets: 'bag',
	botte: 'bunch',
	bottes: 'bunch',
	tranche: 'slice',
	tranches: 'slice',
	barquette: 'tray',
	barquettes: 'tray',
	rouleau: 'roll',
	rouleaux: 'roll',
	brique: 'brick',
	briques: 'brick'
};

const KNOWN = new Set<string>(UNITS);

/**
 * Rend l'identifiant correspondant à une valeur stockée, ou null si personne ne la reconnaît.
 * Le null est utile : l'appelant réaffiche alors le texte d'origine plutôt que de le remplacer par
 * une unité approchante, ce qui trahirait ce que la personne avait écrit.
 */
export function resolveUnit(raw: string | null | undefined): UnitId | null {
	const value = (raw ?? '').trim().toLowerCase();
	if (!value) return null;
	if (KNOWN.has(value)) return value as UnitId;
	return ALIASES[value] ?? null;
}

/** Clef de traduction d'une unité reconnue, sinon null. */
export function unitKey(raw: string | null | undefined): string | null {
	const id = resolveUnit(raw);
	return id ? `units.${id}` : null;
}

/**
 * Les mêmes unités, rangées par famille, pour être choisies en deux temps.
 *
 * Quinze entrées dans une liste déroulante, c'est quinze mots à lire pour en garder un — et sur un
 * téléphone, la liste s'ouvre par-dessus le reste du formulaire. On demande donc d'abord de quoi
 * on parle (des pièces, un poids, un liquide, un conditionnement), et seulement ensuite laquelle :
 * jamais plus de dix choix à la fois, et deux la plupart du temps.
 *
 * Une famille qui ne contient qu'une unité n'en demande pas une deuxième : choisir « Pièces » puis
 * « pièce » serait un pas pour rien.
 *
 * L'ordre à l'intérieur d'une famille va du plus petit au plus grand — g puis kg, ml puis L — et
 * non par fréquence : c'est celui qu'on lit sur un emballage, et il se retient.
 */
export const UNIT_GROUPS = [
	{ id: 'count', units: ['piece'] },
	{ id: 'weight', units: ['g', 'kg'] },
	{ id: 'volume', units: ['ml', 'l'] },
	{ id: 'pack', units: ['pack', 'box', 'bottle', 'jar', 'bag', 'bunch', 'slice', 'tray', 'roll', 'brick'] }
] as const satisfies readonly { id: string; units: readonly UnitId[] }[];

export type UnitGroupId = (typeof UNIT_GROUPS)[number]['id'];

export const DEFAULT_UNIT_GROUP: UnitGroupId = 'count';

/**
 * La famille d'une unité déjà enregistrée, pour rouvrir le choix là où on l'avait laissé.
 *
 * Ce qui n'est pas reconnu retombe sur les pièces, pas sur une erreur : un article importé avec
 * une unité fantaisiste doit rester modifiable, et « pièce » est le cas de loin le plus courant.
 */
export function unitGroupOf(raw: string | null | undefined): UnitGroupId {
	const id = resolveUnit(raw);
	if (!id) return DEFAULT_UNIT_GROUP;

	const group = UNIT_GROUPS.find((candidate) => (candidate.units as readonly string[]).includes(id));
	return group ? group.id : DEFAULT_UNIT_GROUP;
}

/** Les unités d'une famille. Une famille inconnue rend la première : l'écran affiche toujours
 * quelque chose plutôt qu'une rangée vide. */
export function unitsOf(group: UnitGroupId): readonly UnitId[] {
	const found = UNIT_GROUPS.find((candidate) => candidate.id === group);
	return found ? found.units : UNIT_GROUPS[0].units;
}
