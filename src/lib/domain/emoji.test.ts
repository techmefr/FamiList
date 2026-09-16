import { describe, expect, it } from 'vitest';
import {
	EMOJIS,
	EMOJI_GROUPS,
	customEmoji,
	foldForSearch,
	searchEmojis,
	type EmojiEntry
} from './emoji';

type Traductions = { emoji: Record<string, string>; emojiGroup: Record<string, string> };

/** Un nom de démonstration, à la place de l'i18n : le domaine ne connaît pas la langue affichée. */
const NOMS: Record<string, string> = {
	carrot: 'Carotte',
	pasta: 'Pâtes',
	soap: 'Savon',
	cheese: 'Fromage',
	coffee: 'Café',
	potato: 'Pomme de terre',
	apple: 'Pomme'
};

const nom = (entry: EmojiEntry) => NOMS[entry.key] ?? entry.key;

describe('palette', () => {
	it('ne contient pas deux fois le même caractère', () => {
		expect(new Set(EMOJIS.map((entry) => entry.char)).size).toBe(EMOJIS.length);
	});

	it('ne contient pas deux fois la même clé de traduction', () => {
		expect(new Set(EMOJIS.map((entry) => entry.key)).size).toBe(EMOJIS.length);
	});

	it('range chaque emoji dans un groupe déclaré', () => {
		for (const entry of EMOJIS) expect(EMOJI_GROUPS).toContain(entry.group);
	});

	it('ne laisse aucun groupe vide', () => {
		for (const group of EMOJI_GROUPS) {
			expect(EMOJIS.some((entry) => entry.group === group)).toBe(true);
		}
	});
});

/**
 * Un emoji dont le nom manque dans une langue est introuvable à la recherche pour qui lit cette
 * langue : la traduction est la vraie contrainte de la palette, autant que le test la tienne.
 */
describe('traductions', () => {
	const locales = import.meta.glob<Traductions>('../i18n/locales/*.json', {
		eager: true,
		import: 'default'
	});

	it('couvre les dix langues', () => {
		expect(Object.keys(locales)).toHaveLength(10);
	});

	it.each(Object.entries(locales))('nomme chaque emoji en %s', (_chemin, traductions) => {
		for (const entry of EMOJIS) expect(traductions.emoji[entry.key]).toBeTruthy();
		for (const group of EMOJI_GROUPS) expect(traductions.emojiGroup[group]).toBeTruthy();
	});
});

describe('foldForSearch', () => {
	it.each([
		['Pâtes', 'pates'],
		['CAFÉ', 'cafe'],
		['  Savon  ', 'savon'],
		['Éponge', 'eponge']
	])('ramène %j à %j', (entree, attendu) => {
		expect(foldForSearch(entree)).toBe(attendu);
	});
});

describe('searchEmojis', () => {
	const palette = EMOJIS.filter((entry) => entry.key in NOMS);

	it('rend toute la palette quand la recherche est vide', () => {
		expect(searchEmojis('', nom, palette)).toEqual(palette);
		expect(searchEmojis('   ', nom, palette)).toEqual(palette);
	});

	it('trouve sans les accents ni la casse', () => {
		expect(searchEmojis('pates', nom, palette).map((e) => e.char)).toEqual(['🍝']);
		expect(searchEmojis('CAFE', nom, palette).map((e) => e.char)).toEqual(['☕']);
	});

	it('cherche partout dans le nom, pas seulement au début', () => {
		expect(searchEmojis('terre', nom, palette).map((e) => e.char)).toEqual(['🥔']);
	});

	/** Coller un emoji dans la recherche pour le retrouver dans la grille est un geste naturel. */
	it('accepte le caractère lui-même', () => {
		expect(searchEmojis('🧀', nom, palette).map((e) => e.char)).toEqual(['🧀']);
	});

	it('rend plusieurs résultats quand plusieurs noms correspondent', () => {
		expect(searchEmojis('pomme', nom, palette).map((e) => e.char)).toEqual(['🍎', '🥔']);
	});

	it('ne rend rien quand rien ne correspond', () => {
		expect(searchEmojis('zzz', nom, palette)).toEqual([]);
	});
});

describe('customEmoji', () => {
	it('accepte un caractère absent de la palette', () => {
		expect(customEmoji('🦖')).toBe('🦖');
	});

	it('accepte un emoji composé de plusieurs points de code', () => {
		expect(customEmoji('👨‍🚒')).toBe('👨‍🚒');
	});

	it('ignore les espaces autour', () => {
		expect(customEmoji('  🦖  ')).toBe('🦖');
	});

	it('ne propose pas un caractère déjà dans la palette', () => {
		expect(customEmoji('🧀')).toBeNull();
	});

	/** Sans quoi taper le début d'un nom proposerait la lettre elle-même comme illustration. */
	it('refuse les lettres et les chiffres', () => {
		expect(customEmoji('a')).toBeNull();
		expect(customEmoji('7')).toBeNull();
	});

	it('refuse une recherche vide ou plus longue qu’un signe', () => {
		expect(customEmoji('')).toBeNull();
		expect(customEmoji('   ')).toBeNull();
		expect(customEmoji('🦖🦕')).toBeNull();
	});
});
