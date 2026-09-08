/**
 * La palette proposée pour illustrer un rayon.
 *
 * Une liste choisie, pas le jeu complet d'Unicode : un rayon de courses se dit avec une
 * cinquantaine de dessins, et une grille de trois mille demanderait une recherche pour être
 * utilisable là où deux écrans de défilement suffisent. Rien n'empêche de coller n'importe quel
 * autre caractère dans le champ — la palette propose, elle n'enferme pas.
 *
 * Chaque entrée porte une clé de traduction plutôt qu'un nom : c'est ce nom, dans la langue
 * affichée, que la recherche interroge. Chercher « carotte » doit trouver 🥕 pour qui lit en
 * français, et « carrot » pour qui lit en anglais.
 */
export type EmojiGroup =
	| 'fruits'
	| 'boulangerie'
	| 'laitier'
	| 'viande'
	| 'epicerie'
	| 'boissons'
	| 'maison'
	| 'divers';

export type EmojiEntry = { char: string; key: string; group: EmojiGroup };

export const EMOJI_GROUPS: EmojiGroup[] = [
	'fruits',
	'boulangerie',
	'laitier',
	'viande',
	'epicerie',
	'boissons',
	'maison',
	'divers'
];

export const EMOJIS: EmojiEntry[] = [
	{ char: '🍎', key: 'apple', group: 'fruits' },
	{ char: '🍌', key: 'banana', group: 'fruits' },
	{ char: '🍓', key: 'strawberry', group: 'fruits' },
	{ char: '🍇', key: 'grapes', group: 'fruits' },
	{ char: '🍋', key: 'lemon', group: 'fruits' },
	{ char: '🥕', key: 'carrot', group: 'fruits' },
	{ char: '🥦', key: 'broccoli', group: 'fruits' },
	{ char: '🍅', key: 'tomato', group: 'fruits' },
	{ char: '🥬', key: 'salad', group: 'fruits' },
	{ char: '🥔', key: 'potato', group: 'fruits' },

	{ char: '🥖', key: 'baguette', group: 'boulangerie' },
	{ char: '🍞', key: 'bread', group: 'boulangerie' },
	{ char: '🥐', key: 'croissant', group: 'boulangerie' },
	{ char: '🥯', key: 'bagel', group: 'boulangerie' },
	{ char: '🍰', key: 'cake', group: 'boulangerie' },

	{ char: '🥛', key: 'milk', group: 'laitier' },
	{ char: '🧀', key: 'cheese', group: 'laitier' },
	{ char: '🧈', key: 'butter', group: 'laitier' },
	{ char: '🥚', key: 'egg', group: 'laitier' },
	{ char: '🍦', key: 'iceCream', group: 'laitier' },

	{ char: '🥩', key: 'meat', group: 'viande' },
	{ char: '🍗', key: 'chicken', group: 'viande' },
	{ char: '🥓', key: 'bacon', group: 'viande' },
	{ char: '🐟', key: 'fish', group: 'viande' },
	{ char: '🍤', key: 'shrimp', group: 'viande' },
	{ char: '🌭', key: 'sausage', group: 'viande' },

	{ char: '🍝', key: 'pasta', group: 'epicerie' },
	{ char: '🍚', key: 'rice', group: 'epicerie' },
	{ char: '🥫', key: 'cannedFood', group: 'epicerie' },
	{ char: '🧂', key: 'salt', group: 'epicerie' },
	{ char: '🍯', key: 'honey', group: 'epicerie' },
	{ char: '🍫', key: 'chocolate', group: 'epicerie' },
	{ char: '🍪', key: 'cookie', group: 'epicerie' },
	{ char: '🥜', key: 'peanuts', group: 'epicerie' },

	{ char: '☕', key: 'coffee', group: 'boissons' },
	{ char: '🍵', key: 'tea', group: 'boissons' },
	{ char: '🧃', key: 'juice', group: 'boissons' },
	{ char: '🍷', key: 'wine', group: 'boissons' },
	{ char: '🍺', key: 'beer', group: 'boissons' },

	{ char: '🧼', key: 'soap', group: 'maison' },
	{ char: '🧻', key: 'toiletPaper', group: 'maison' },
	{ char: '🧽', key: 'sponge', group: 'maison' },
	{ char: '🧹', key: 'broom', group: 'maison' },
	{ char: '🪥', key: 'toothbrush', group: 'maison' },
	{ char: '🧺', key: 'laundry', group: 'maison' },
	{ char: '💊', key: 'medicine', group: 'maison' },

	{ char: '🛒', key: 'cart', group: 'divers' },
	{ char: '🐾', key: 'pets', group: 'divers' },
	{ char: '🌱', key: 'plant', group: 'divers' },
	{ char: '🎁', key: 'gift', group: 'divers' },
	{ char: '🧊', key: 'frozen', group: 'divers' },
	{ char: '📦', key: 'other', group: 'divers' }
];

/**
 * Rend la recherche indifférente aux accents et à la casse : « pates » doit trouver « Pâtes »,
 * parce que personne ne pose les accents dans un champ de recherche.
 */
export function foldForSearch(value: string): string {
	return value
		.normalize('NFD')
		.replaceAll(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.trim();
}

/**
 * Les emoji dont le nom contient la recherche. Une recherche vide rend toute la palette, ce qui
 * est le bon comportement : la grille est le mode normal, la recherche un raccourci.
 *
 * `name` est fourni par l'appelant plutôt que lu ici : le domaine ne connaît pas la langue
 * affichée, et cette fonction reste testable sans monter l'i18n.
 */
export function searchEmojis(
	query: string,
	name: (entry: EmojiEntry) => string,
	entries: EmojiEntry[] = EMOJIS
): EmojiEntry[] {
	const needle = foldForSearch(query);
	if (!needle) return entries;

	// Le caractère lui-même compte comme une correspondance : coller un emoji dans la recherche
	// pour le retrouver dans la grille est un geste naturel.
	return entries.filter(
		(entry) => entry.char === query.trim() || foldForSearch(name(entry)).includes(needle)
	);
}
