import { describe, expect, it } from 'vitest';
import fr from './locales/fr.json';
import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';
import italiano from './locales/it.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import ar from './locales/ar.json';
import zh from './locales/zh.json';
import mg from './locales/mg.json';

/**
 * Plural forms are the only place where a translation can be present and yet unusable: the category the
 * language demands — `one` in Malagasy, `zero` in Arabic — has nothing to do with French's, and a missing
 * category falls back on `other`, a sentence that is right except in the singular. The other way round, a
 * category the language never uses (`one` in Chinese) will never be read: it is dead text we think we have
 * translated.
 */
const MESSAGES: Record<string, unknown> = { fr, en, es, de, it: italiano, pt, ru, ar, zh, mg };

const CATEGORIES: Intl.LDMLPluralRule[] = ['zero', 'one', 'two', 'few', 'many', 'other'];

type Node = Record<string, unknown>;

/** A plural node: nothing but strings, under CLDR category names. */
function isPluralNode(value: unknown): value is Record<string, string> {
	if (typeof value !== 'object' || value === null) return false;

	const entries = Object.entries(value as Node);
	return (
		entries.length > 0 &&
		entries.every(
			([key, item]) => typeof item === 'string' && CATEGORIES.includes(key as Intl.LDMLPluralRule)
		)
	);
}

function pluralPaths(node: Node, prefix = ''): string[] {
	return Object.entries(node).flatMap(([key, value]) => {
		const path = prefix ? `${prefix}.${key}` : key;

		if (isPluralNode(value)) return [path];
		if (typeof value === 'object' && value !== null) return pluralPaths(value as Node, path);
		return [];
	});
}

function at(node: unknown, path: string): unknown {
	return path.split('.').reduce<unknown>((current, key) => {
		if (typeof current !== 'object' || current === null) return undefined;
		return (current as Node)[key];
	}, node);
}

const PATHS = pluralPaths(fr as unknown as Node);

describe('formes plurielles', () => {
	it('relève les phrases comptées du français', () => {
		expect(PATHS).toEqual([
			'lists.remaining',
			'prices.shopCount',
			'recipes.servingsCount',
			'admin.crashOccurrences',
			'admin.crashPeople',
			'chat.votes',
			'chat.pushed',
			'security.backupLeft',
			'search.count',
			'ai.willSend'
		]);
	});

	describe.each(Object.keys(MESSAGES))('%s', (code) => {
		const supported = new Intl.PluralRules(code).resolvedOptions().pluralCategories;

		it.each(PATHS)('%s couvre le singulier et le pluriel de la langue', (path) => {
			const node = at(MESSAGES[code], path);
			expect(isPluralNode(node)).toBe(true);

			const written = Object.keys(node as Record<string, string>);

			// `other` is the net: it is what any missing category falls back on.
			expect(written).toContain('other');

			// The category of 1, the one a shopping list shows most often.
			expect(written).toContain(new Intl.PluralRules(code).select(1));

			// No category the language never uses: it would never be read.
			expect(
				written.filter((category) => !supported.includes(category as Intl.LDMLPluralRule))
			).toEqual([]);
		});
	});
});
