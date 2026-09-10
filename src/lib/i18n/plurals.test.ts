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
 * Les formes plurielles sont le seul endroit où une traduction peut être présente et pourtant
 * inutilisable : la catégorie que réclame la langue — `one` en malgache, `zero` en arabe — n'a
 * rien à voir avec celles du français, et une catégorie absente retombe sur `other`, une phrase
 * juste au singulier près. Dans l'autre sens, une catégorie que la langue ignore (`one` en
 * chinois) ne sera jamais lue : c'est du texte mort qu'on croit avoir traduit.
 */
const MESSAGES: Record<string, unknown> = { fr, en, es, de, it: italiano, pt, ru, ar, zh, mg };

const CATEGORIES: Intl.LDMLPluralRule[] = ['zero', 'one', 'two', 'few', 'many', 'other'];

type Node = Record<string, unknown>;

/** Un nœud pluriel : rien que des chaînes, sous des noms de catégories CLDR. */
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
		expect(PATHS).toEqual(['lists.remaining', 'chat.votes', 'chat.pushed', 'security.backupLeft']);
	});

	describe.each(Object.keys(MESSAGES))('%s', (code) => {
		const supported = new Intl.PluralRules(code).resolvedOptions().pluralCategories;

		it.each(PATHS)('%s couvre le singulier et le pluriel de la langue', (path) => {
			const node = at(MESSAGES[code], path);
			expect(isPluralNode(node)).toBe(true);

			const written = Object.keys(node as Record<string, string>);

			// `other` est le filet : c'est sur lui que retombe toute catégorie absente.
			expect(written).toContain('other');

			// La catégorie de 1, celle qu'une liste de courses affiche le plus souvent.
			expect(written).toContain(new Intl.PluralRules(code).select(1));

			// Aucune catégorie que la langue n'emploie jamais : elle ne serait jamais lue.
			expect(
				written.filter((category) => !supported.includes(category as Intl.LDMLPluralRule))
			).toEqual([]);
		});
	});
});
