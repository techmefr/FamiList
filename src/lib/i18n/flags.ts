import type { Locale } from './index.svelte';

/**
 * The flag standing beside the native name in the language picker.
 *
 * A flag stands for a country, never for a language: it can therefore only be decoration set next to the
 * name, and the name stays the sole carrier of the information. The rule kept is the language's country of
 * origin — Spain for Spanish, Portugal for Portuguese — and not the country with the most speakers, failing
 * which we would have to choose between Madrid and Mexico City, Lisbon and Brasilia, for a mere thumbnail.
 *
 * Two languages have no flag and will not get one: English, which belongs to neither the United Kingdom nor
 * the United States and where choosing would offend one of the two without adding anything, and Arabic,
 * spoken in some twenty countries none of which represents it. Their entry keeps its native name alone,
 * which is also what Android and Windows show when a flag is missing from their font: absence is a normal
 * case of the list, not an anomaly.
 */
const FLAGS: Partial<Record<Locale, string>> = {
	fr: '🇫🇷',
	es: '🇪🇸',
	de: '🇩🇪',
	it: '🇮🇹',
	pt: '🇵🇹',
	ru: '🇷🇺',
	zh: '🇨🇳',
	mg: '🇲🇬'
};

export function flagForLocale(code: Locale): string | null {
	return FLAGS[code] ?? null;
}
