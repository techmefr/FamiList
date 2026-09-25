import { describe, expect, it } from 'vitest';
import fr from '../i18n/locales/fr.json';
import en from '../i18n/locales/en.json';
import de from '../i18n/locales/de.json';
import es from '../i18n/locales/es.json';
import itLocale from '../i18n/locales/it.json';
import pt from '../i18n/locales/pt.json';
import ru from '../i18n/locales/ru.json';
import ar from '../i18n/locales/ar.json';
import zh from '../i18n/locales/zh.json';
import mg from '../i18n/locales/mg.json';
import {
	SETTINGS_CATEGORIES,
	categoryById,
	normalizeSearch,
	searchSettings,
	settingHref,
	visibleCategories
} from './settings-categories';

const LOCALES = { fr, en, de, es, it: itLocale, pt, ru, ar, zh, mg };

const lookup = (locale: unknown, key: string): unknown =>
	key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locale);

const translate = (key: string) => {
	const value = lookup(fr, key);
	return typeof value === 'string' ? value : key;
};

const allKeys = SETTINGS_CATEGORIES.flatMap((category) => [
	category.title,
	category.hint,
	category.keywords,
	...category.settings.flatMap((setting) => [setting.label, ...(setting.hint ? [setting.hint] : [])])
]);

describe('settings categories', () => {
	it('gives every category and every setting a single home', () => {
		const ids = SETTINGS_CATEGORIES.map((category) => category.id);
		expect(new Set(ids).size).toBe(ids.length);

		const routes = SETTINGS_CATEGORIES.map((category) => category.route);
		expect(new Set(routes).size).toBe(routes.length);

		const anchors = SETTINGS_CATEGORIES.flatMap((category) => category.settings.map((s) => s.anchor));
		expect(new Set(anchors).size).toBe(anchors.length);
	});

	it('translates every label, hint and keyword list in all ten locales', () => {
		for (const [code, locale] of Object.entries(LOCALES)) {
			for (const key of allKeys) {
				expect(typeof lookup(locale, key), `missing ${key} in ${code}`).toBe('string');
			}
		}
	});

	it('only shows the administration to administrators', () => {
		expect(visibleCategories(false).map((c) => c.id)).not.toContain('admin');
		expect(visibleCategories(true).map((c) => c.id)).toContain('admin');
		expect(visibleCategories(true)).toHaveLength(SETTINGS_CATEGORIES.length);
	});

	it('points a setting at its anchor on the category screen', () => {
		expect(settingHref(categoryById('display'), 'setting-font')).toBe('/profile/display#setting-font');
		expect(settingHref(categoryById('connection'))).toBe('/profile/connection');
	});

	it('throws on an unknown category', () => {
		expect(() => categoryById('nope' as never)).toThrow();
	});
});

describe('settings search', () => {
	const everyone = visibleCategories(false);

	it('ignores case and accents', () => {
		expect(normalizeSearch('  THÈME ')).toBe('theme');
	});

	it('returns nothing for an empty query', () => {
		expect(searchSettings('   ', everyone, translate)).toEqual([]);
	});

	it('finds a setting by its label and links to its anchor', () => {
		const [match] = searchSettings('taille du texte', everyone, translate);
		expect(match.href).toBe('/profile/display#setting-text-size');
		expect(match.label).toBe('Taille du texte');
		expect(match.category).toBe('Affichage et lecture');
	});

	it('finds a setting by its hint', () => {
		const hrefs = searchSettings('bip', everyone, translate).map((m) => m.href);
		expect(hrefs).toContain('/profile/feedback#setting-sound');
	});

	it('requires every word, in any order', () => {
		const hrefs = searchSettings('texte taille', everyone, translate).map((m) => m.href);
		expect(hrefs).toContain('/profile/display#setting-text-size');
		expect(searchSettings('taille zzz', everyone, translate)).toEqual([]);
	});

	it('matches the start of a word, not its middle', () => {
		const keys = searchSettings('son', everyone, translate).map((m) => m.key);
		expect(keys).not.toContain('legal');
	});

	it('puts whole words before mere starts of words', () => {
		const keys = searchSettings('son', everyone, translate).map((m) => m.key);
		expect(keys[0]).toBe('feedback:setting-sound');
		expect(keys).toContain('account:setting-avatar');
	});

	it('matches anywhere in a script written without spaces', () => {
		const translateZh = (key: string) => {
			const value = lookup(zh, key);
			return typeof value === 'string' ? value : key;
		};
		const hrefs = searchSettings('大小', everyone, translateZh).map((m) => m.href);
		expect(hrefs).toContain('/profile/display#setting-text-size');
	});

	it('falls back on the category when only its keywords match', () => {
		const matches = searchSettings('sombre', everyone, translate);
		expect(matches).toEqual([
			expect.objectContaining({ key: 'display', href: '/profile/display' })
		]);
	});

	it('does not list the category again once one of its settings matched', () => {
		const keys = searchSettings('police', everyone, translate).map((m) => m.key);
		expect(keys).toContain('display:setting-font');
		expect(keys).not.toContain('display');
	});

	it('never offers the administration to someone who is not an administrator', () => {
		const title = translate('profile.administration');
		expect(searchSettings(title, everyone, translate)).toEqual([]);
		expect(searchSettings(title, visibleCategories(true), translate).map((m) => m.key)).toContain('admin');
	});
});
