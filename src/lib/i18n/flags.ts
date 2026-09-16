import type { Locale } from './index.svelte';

/**
 * Le drapeau qui accompagne le nom natif dans le choix de la langue.
 *
 * Un drapeau désigne un pays, jamais une langue : il ne peut donc être qu'une décoration posée à
 * côté du nom, et le nom reste seul porteur de l'information. La règle retenue est le pays
 * d'origine de la langue — l'Espagne pour l'espagnol, le Portugal pour le portugais — et non le
 * pays qui compte le plus de locuteurs, sans quoi il faudrait arbitrer entre Madrid et Mexico,
 * Lisbonne et Brasilia, pour une simple vignette.
 *
 * Deux langues n'ont pas de drapeau et n'en auront pas : l'anglais, qui n'appartient ni au
 * Royaume-Uni ni aux États-Unis et dont le choix vexerait l'un des deux sans rien apporter, et
 * l'arabe, parlé dans une vingtaine de pays dont aucun ne le représente. Leur entrée garde son
 * seul nom natif, ce qui est aussi ce qu'affichent Android et Windows quand un drapeau manque à
 * leur police : l'absence est un cas normal de la liste, pas une anomalie.
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
