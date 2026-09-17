/**
 * Quantity units offered when adding an item.
 *
 * We store a stable id, not the displayed word: "pièce" written as is in the database stayed French for
 * somebody reading the app in Arabic, and changing language could do nothing about it. The label comes
 * from the translation, the database only keeps the key.
 *
 * The order is that of the dropdown: pieces first because it is the common case, then weights, volumes,
 * and finally packaging.
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
 * What may have been typed by hand before the field became a list, and the plurals somebody writes
 * naturally. Without this table, an item created yesterday would show "pièce" hard-coded while its
 * neighbours translate — the inconsistency would show more than the original problem.
 */
const ALIASES: Record<string, UnitId> = {
	pièce: 'piece',
	pièces: 'piece',
	pieces: 'piece',
	pce: 'piece',
	pcs: 'piece',
	unité: 'piece',
	unit: 'piece',
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
	box: 'box',
	boîtes: 'box',
	boxes: 'box',
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
 * Returns the id matching a stored value, or null if nobody recognises it. The null is useful: the caller
 * then shows the original text again rather than replacing it with an approximate unit, which would
 * betray what the person had written.
 */
export function resolveUnit(raw: string | null | undefined): UnitId | null {
	const value = (raw ?? '').trim().toLowerCase();
	if (!value) return null;
	if (KNOWN.has(value)) return value as UnitId;
	return ALIASES[value] ?? null;
}

/** Translation key of a recognised unit, otherwise null. */
export function unitKey(raw: string | null | undefined): string | null {
	const id = resolveUnit(raw);
	return id ? `units.${id}` : null;
}

/**
 * The same units, grouped by family, to be chosen in two steps.
 *
 * Fifteen entries in a dropdown is fifteen words to read in order to keep one — and on a phone, the list
 * opens over the rest of the form. So we first ask what we are talking about (pieces, a weight, a liquid,
 * packaging), and only then which one: never more than ten choices at a time, and two most of the time.
 *
 * A family containing a single unit does not ask for a second choice: picking "Pieces" then "piece" would
 * be a step for nothing.
 *
 * The order inside a family goes from smallest to largest — g then kg, ml then L — and not by frequency:
 * it is the one you read on a package, and it sticks.
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
 * The family of an already saved unit, to reopen the choice where it was left.
 *
 * What is not recognised falls back on pieces, not on an error: an item imported with a fanciful unit must
 * stay editable, and "piece" is by far the most common case.
 */
export function unitGroupOf(raw: string | null | undefined): UnitGroupId {
	const id = resolveUnit(raw);
	if (!id) return DEFAULT_UNIT_GROUP;

	const group = UNIT_GROUPS.find((candidate) => (candidate.units as readonly string[]).includes(id));
	return group ? group.id : DEFAULT_UNIT_GROUP;
}

/**
 * The units of a family. An unknown family returns the first one: the screen always shows something
 * rather than an empty row.
 */
export function unitsOf(group: UnitGroupId): readonly UnitId[] {
	const found = UNIT_GROUPS.find((candidate) => candidate.id === group);
	return found ? found.units : UNIT_GROUPS[0].units;
}
