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
