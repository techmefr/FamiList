import { browser } from '$app/environment';
import fr from './locales/fr.json';

export type Locale = 'fr' | 'en' | 'es' | 'de' | 'it' | 'ru' | 'ar' | 'zh' | 'mg' | 'pt';

export interface LocaleMeta {
	code: Locale;
	/** Nom de la langue dans la langue elle-même, jamais traduit. */
	native: string;
	dir: 'ltr' | 'rtl';
}

export const LOCALES: LocaleMeta[] = [
	{ code: 'fr', native: 'Français', dir: 'ltr' },
	{ code: 'en', native: 'English', dir: 'ltr' },
	{ code: 'es', native: 'Español', dir: 'ltr' },
	{ code: 'de', native: 'Deutsch', dir: 'ltr' },
	{ code: 'it', native: 'Italiano', dir: 'ltr' },
	{ code: 'pt', native: 'Português', dir: 'ltr' },
	{ code: 'ru', native: 'Русский', dir: 'ltr' },
	{ code: 'ar', native: 'العربية', dir: 'rtl' },
	{ code: 'zh', native: '中文', dir: 'ltr' },
	{ code: 'mg', native: 'Malagasy', dir: 'ltr' }
];

export const DEFAULT_LOCALE: Locale = 'fr';
export const LOCALE_STORAGE_KEY = 'familist:locale';

type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>>;
type MessageNode = string | PluralForms | { [key: string]: MessageNode };
export type Messages = typeof fr;

/** `fr` est empaqueté comme repli, il n'a pas de chargeur : le charger le sortirait de son chunk. */
const loaders: Record<Exclude<Locale, 'fr'>, () => Promise<{ default: unknown }>> = {
	en: () => import('./locales/en.json'),
	es: () => import('./locales/es.json'),
	de: () => import('./locales/de.json'),
	it: () => import('./locales/it.json'),
	pt: () => import('./locales/pt.json'),
	ru: () => import('./locales/ru.json'),
	ar: () => import('./locales/ar.json'),
	zh: () => import('./locales/zh.json'),
	mg: () => import('./locales/mg.json')
};

const isLocale = (value: unknown): value is Locale =>
	typeof value === 'string' && LOCALES.some((l) => l.code === value);

function detectLocale(): Locale {
	if (!browser) return DEFAULT_LOCALE;

	const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
	if (isLocale(stored)) return stored;

	for (const candidate of navigator.languages ?? []) {
		const base = candidate.split('-')[0];
		if (isLocale(base)) return base;
	}

	return DEFAULT_LOCALE;
}

function lookup(source: MessageNode, path: string[]): MessageNode | undefined {
	let node: MessageNode | undefined = source;

	for (const segment of path) {
		if (typeof node !== 'object' || node === null) return undefined;
		node = (node as Record<string, MessageNode>)[segment];
	}

	return node;
}

class I18n {
	locale = $state<Locale>(DEFAULT_LOCALE);
	#messages = $state<MessageNode>(fr as MessageNode);
	#fallback = fr as MessageNode;

	dir = $derived(LOCALES.find((l) => l.code === this.locale)?.dir ?? 'ltr');

	async init() {
		if (!browser) return;
		await this.setLocale(detectLocale());
	}

	async setLocale(locale: Locale) {
		if (!isLocale(locale)) return;

		if (locale !== DEFAULT_LOCALE) {
			try {
				const module = await loaders[locale as Exclude<Locale, 'fr'>]();
				this.#messages = module.default as MessageNode;
			} catch {
				// traduction manquante ou illisible : on reste sur la langue de repli
				this.#messages = this.#fallback;
				return;
			}
		} else {
			this.#messages = this.#fallback;
		}

		this.locale = locale;

		if (browser) {
			localStorage.setItem(LOCALE_STORAGE_KEY, locale);
			document.documentElement.lang = locale;
			document.documentElement.dir = this.dir;
		}
	}

	t(key: string, params: Record<string, string | number> = {}): string {
		const path = key.split('.');
		let node = lookup(this.#messages, path) ?? lookup(this.#fallback, path);

		if (node && typeof node === 'object') {
			const count = Number(params.count);
			if (!Number.isNaN(count)) {
				const rule = new Intl.PluralRules(this.locale).select(count);
				node = (node as PluralForms)[rule] ?? (node as PluralForms).other;
			}
		}

		if (typeof node !== 'string') return key;

		return node.replace(/\{(\w+)\}/g, (match, name: string) =>
			name in params ? String(params[name]) : match
		);
	}

	number(value: number, options?: Intl.NumberFormatOptions) {
		return new Intl.NumberFormat(this.locale, options).format(value);
	}
}

export const i18n = new I18n();
export const t = (key: string, params?: Record<string, string | number>) => i18n.t(key, params);
