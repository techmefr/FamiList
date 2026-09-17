import { describe, expect, it } from 'vitest';
import {
	EMOJIS,
	EMOJI_GROUPS,
	customEmoji,
	foldForSearch,
	searchEmojis,
	type EmojiEntry
} from './emoji';

type Translations = { emoji: Record<string, string>; emojiGroup: Record<string, string> };

/** A demonstration name, in place of the i18n: the domain does not know the displayed language. */
const NAMES: Record<string, string> = {
	carrot: 'Carotte',
	pasta: 'Pâtes',
	soap: 'Savon',
	cheese: 'Fromage',
	coffee: 'Café',
	potato: 'Pomme de terre',
	apple: 'Pomme'
};

const name = (entry: EmojiEntry) => NAMES[entry.key] ?? entry.key;

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
 * An emoji whose name is missing in a language cannot be found by search by whoever reads that language:
 * translation is the palette's real constraint, so the test may as well hold it.
 */
describe('traductions', () => {
	const locales = import.meta.glob<Translations>('../i18n/locales/*.json', {
		eager: true,
		import: 'default'
	});

	it('couvre les dix langues', () => {
		expect(Object.keys(locales)).toHaveLength(10);
	});

	it.each(Object.entries(locales))('nomme chaque emoji en %s', (_path, translations) => {
		for (const entry of EMOJIS) expect(translations.emoji[entry.key]).toBeTruthy();
		for (const group of EMOJI_GROUPS) expect(translations.emojiGroup[group]).toBeTruthy();
	});
});

describe('foldForSearch', () => {
	it.each([
		['Pâtes', 'pates'],
		['CAFÉ', 'cafe'],
		['  Savon  ', 'savon'],
		['Éponge', 'eponge']
	])('ramène %j à %j', (entry, expected) => {
		expect(foldForSearch(entry)).toBe(expected);
	});
});

describe('searchEmojis', () => {
	const palette = EMOJIS.filter((entry) => entry.key in NAMES);

	it('rend toute la palette quand la recherche est vide', () => {
		expect(searchEmojis('', name, palette)).toEqual(palette);
		expect(searchEmojis('   ', name, palette)).toEqual(palette);
	});

	it('trouve sans les accents ni la casse', () => {
		expect(searchEmojis('pates', name, palette).map((e) => e.char)).toEqual(['🍝']);
		expect(searchEmojis('CAFE', name, palette).map((e) => e.char)).toEqual(['☕']);
	});

	it('cherche partout dans le nom, pas seulement au début', () => {
		expect(searchEmojis('terre', name, palette).map((e) => e.char)).toEqual(['🥔']);
	});

	/** Pasting an emoji into the search to find it in the grid is a natural gesture. */
	it('accepte le caractère lui-même', () => {
		expect(searchEmojis('🧀', name, palette).map((e) => e.char)).toEqual(['🧀']);
	});

	it('rend plusieurs résultats quand plusieurs noms correspondent', () => {
		expect(searchEmojis('pomme', name, palette).map((e) => e.char)).toEqual(['🍎', '🥔']);
	});

	it('ne rend rien quand rien ne correspond', () => {
		expect(searchEmojis('zzz', name, palette)).toEqual([]);
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

	/** Without which typing the start of a name would offer the letter itself as an illustration. */
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
