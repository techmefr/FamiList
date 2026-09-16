/**
 * La palette proposée pour illustrer une liste ou un rayon.
 *
 * Une liste choisie, pas le jeu complet d'Unicode, mais assez large pour qu'un foyer y retrouve ce
 * qu'il range vraiment : les courses ne sont qu'une partie de la vie domestique, et une liste
 * « pharmacie » ou « rentrée des classes » a droit à son dessin. Ce qui rendait autrefois une
 * grande grille impraticable — l'absence de recherche — n'existe plus : `searchEmojis` trie la
 * palette dès la première lettre.
 *
 * Ce qui borne la palette aujourd'hui, c'est la traduction : chaque entrée porte une clé qu'il faut
 * écrire dans les dix langues de l'application, faute de quoi le dessin reste introuvable pour qui
 * le cherche dans la sienne. Mieux vaut cent dessins nommés partout que trois mille muets.
 *
 * Et pour ce que la palette n'a pas : `customEmoji` accepte un caractère collé dans la recherche.
 */
export type EmojiGroup =
	| 'fruits'
	| 'boulangerie'
	| 'laitier'
	| 'viande'
	| 'epicerie'
	| 'boissons'
	| 'maison'
	| 'sante'
	| 'bebe'
	| 'animaux'
	| 'jardin'
	| 'bricolage'
	| 'fete'
	| 'vetements'
	| 'bureau'
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
	'sante',
	'bebe',
	'animaux',
	'jardin',
	'bricolage',
	'fete',
	'vetements',
	'bureau',
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
	{ char: '🧄', key: 'garlic', group: 'fruits' },
	{ char: '🧅', key: 'onion', group: 'fruits' },
	{ char: '🍄', key: 'mushroom', group: 'fruits' },
	{ char: '🌽', key: 'corn', group: 'fruits' },
	{ char: '🥑', key: 'avocado', group: 'fruits' },
	{ char: '🥒', key: 'cucumber', group: 'fruits' },

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
	{ char: '🌶️', key: 'chili', group: 'epicerie' },
	{ char: '🥣', key: 'cereal', group: 'epicerie' },
	{ char: '🫘', key: 'beans', group: 'epicerie' },
	{ char: '🫒', key: 'oil', group: 'epicerie' },

	{ char: '☕', key: 'coffee', group: 'boissons' },
	{ char: '🍵', key: 'tea', group: 'boissons' },
	{ char: '🧃', key: 'juice', group: 'boissons' },
	{ char: '🍷', key: 'wine', group: 'boissons' },
	{ char: '🍺', key: 'beer', group: 'boissons' },
	{ char: '💧', key: 'water', group: 'boissons' },
	{ char: '🥤', key: 'soda', group: 'boissons' },

	{ char: '🧼', key: 'soap', group: 'maison' },
	{ char: '🧻', key: 'toiletPaper', group: 'maison' },
	{ char: '🧽', key: 'sponge', group: 'maison' },
	{ char: '🧹', key: 'broom', group: 'maison' },
	{ char: '🪥', key: 'toothbrush', group: 'maison' },
	{ char: '🧺', key: 'laundry', group: 'maison' },
	{ char: '🪒', key: 'razor', group: 'maison' },
	{ char: '🗑️', key: 'trash', group: 'maison' },

	{ char: '💊', key: 'medicine', group: 'sante' },
	{ char: '⚕️', key: 'pharmacy', group: 'sante' },
	{ char: '🏥', key: 'hospital', group: 'sante' },
	{ char: '💉', key: 'syringe', group: 'sante' },
	{ char: '🩹', key: 'bandage', group: 'sante' },
	{ char: '🩺', key: 'doctor', group: 'sante' },
	{ char: '🌡️', key: 'thermometer', group: 'sante' },
	{ char: '🧴', key: 'lotion', group: 'sante' },
	{ char: '😷', key: 'mask', group: 'sante' },
	{ char: '🦷', key: 'tooth', group: 'sante' },
	{ char: '👓', key: 'glasses', group: 'sante' },

	{ char: '🍼', key: 'babyBottle', group: 'bebe' },
	{ char: '👶', key: 'baby', group: 'bebe' },
	{ char: '🧸', key: 'teddyBear', group: 'bebe' },
	{ char: '🧷', key: 'diaper', group: 'bebe' },

	{ char: '🐕', key: 'dog', group: 'animaux' },
	{ char: '🐈', key: 'cat', group: 'animaux' },
	{ char: '🦴', key: 'bone', group: 'animaux' },
	{ char: '🐦', key: 'bird', group: 'animaux' },
	{ char: '🐰', key: 'rabbit', group: 'animaux' },
	{ char: '🐠', key: 'aquarium', group: 'animaux' },

	{ char: '🌻', key: 'sunflower', group: 'jardin' },
	{ char: '🪴', key: 'pottedPlant', group: 'jardin' },
	{ char: '🌳', key: 'tree', group: 'jardin' },
	{ char: '💐', key: 'bouquet', group: 'jardin' },
	{ char: '🌿', key: 'herb', group: 'jardin' },
	{ char: '🪣', key: 'bucket', group: 'jardin' },

	{ char: '🔨', key: 'hammer', group: 'bricolage' },
	{ char: '🔧', key: 'wrench', group: 'bricolage' },
	{ char: '🪛', key: 'screwdriver', group: 'bricolage' },
	{ char: '🔩', key: 'screw', group: 'bricolage' },
	{ char: '🪚', key: 'saw', group: 'bricolage' },
	{ char: '🧰', key: 'toolbox', group: 'bricolage' },
	{ char: '🪜', key: 'ladder', group: 'bricolage' },
	{ char: '🔌', key: 'plug', group: 'bricolage' },
	{ char: '🔋', key: 'battery', group: 'bricolage' },
	{ char: '💡', key: 'lightBulb', group: 'bricolage' },
	{ char: '🎨', key: 'paint', group: 'bricolage' },

	{ char: '🎉', key: 'party', group: 'fete' },
	{ char: '🎂', key: 'birthday', group: 'fete' },
	{ char: '🎈', key: 'balloon', group: 'fete' },
	{ char: '🕯️', key: 'candle', group: 'fete' },
	{ char: '🎄', key: 'christmas', group: 'fete' },
	{ char: '🎃', key: 'pumpkin', group: 'fete' },
	{ char: '🍾', key: 'champagne', group: 'fete' },
	{ char: '🎆', key: 'fireworks', group: 'fete' },

	{ char: '👕', key: 'tshirt', group: 'vetements' },
	{ char: '👖', key: 'trousers', group: 'vetements' },
	{ char: '🧦', key: 'socks', group: 'vetements' },
	{ char: '👟', key: 'shoes', group: 'vetements' },
	{ char: '🧥', key: 'coat', group: 'vetements' },
	{ char: '👗', key: 'dress', group: 'vetements' },
	{ char: '🧢', key: 'cap', group: 'vetements' },
	{ char: '🧤', key: 'gloves', group: 'vetements' },

	{ char: '✏️', key: 'pencil', group: 'bureau' },
	{ char: '🖊️', key: 'pen', group: 'bureau' },
	{ char: '📒', key: 'notebook', group: 'bureau' },
	{ char: '✂️', key: 'scissors', group: 'bureau' },
	{ char: '📎', key: 'paperclip', group: 'bureau' },
	{ char: '📏', key: 'ruler', group: 'bureau' },
	{ char: '🎒', key: 'backpack', group: 'bureau' },
	{ char: '📚', key: 'books', group: 'bureau' },

	{ char: '🛒', key: 'cart', group: 'divers' },
	{ char: '🐾', key: 'pets', group: 'divers' },
	{ char: '🌱', key: 'plant', group: 'divers' },
	{ char: '🎁', key: 'gift', group: 'divers' },
	{ char: '🧊', key: 'frozen', group: 'divers' },
	{ char: '🔑', key: 'keys', group: 'divers' },
	{ char: '🚗', key: 'car', group: 'divers' },
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

const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * Le caractère collé dans la recherche, quand la palette ne le propose pas : elle suggère, elle
 * n'enferme pas, et un foyer qui tient à son propre dessin ne dépend pas de nos choix.
 *
 * On exige un seul groupe de graphèmes — un emoji vaut souvent plusieurs points de code — et on
 * écarte lettres et chiffres, sans quoi taper le début d'un nom proposerait la lettre elle-même.
 */
export function customEmoji(query: string, entries: EmojiEntry[] = EMOJIS): string | null {
	const candidate = query.trim();
	if (!candidate) return null;
	if ([...GRAPHEMES.segment(candidate)].length !== 1) return null;
	if (/[\p{L}\p{N}]/u.test(candidate)) return null;
	if (entries.some((entry) => entry.char === candidate)) return null;

	return candidate;
}
