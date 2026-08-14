export type Theme = 'light' | 'dark' | 'system';

export interface AccentPreset {
	id: string;
	/** Clé i18n du libellé. */
	label: string;
}

/**
 * Les valeurs de couleur vivent dans src/app.css, sous [data-accent='<id>']. Ce fichier ne porte
 * que la liste et l'ordre d'affichage : ajouter un preset, c'est ajouter une entrée ici et un bloc
 * là-bas, jamais une valeur en double.
 */
export const ACCENT_PRESETS: AccentPreset[] = [
	{ id: 'terracotta', label: 'accent.terracotta' },
	{ id: 'forest', label: 'accent.forest' },
	{ id: 'blue', label: 'accent.blue' },
	{ id: 'plum', label: 'accent.plum' },
	{ id: 'teal', label: 'accent.teal' },
	{ id: 'ink', label: 'accent.ink' }
];

export interface FontScalePreset {
	id: string;
	label: string;
}

/**
 * Cinq crans, jusqu'à 1,6 pour les personnes malvoyantes qui zooment fortement. Les
 * multiplicateurs eux-mêmes sont dans app.css, sous [data-scale='<id>'].
 */
export const FONT_SCALE_PRESETS: FontScalePreset[] = [
	{ id: 'xs', label: 'scale.xs' },
	{ id: 'sm', label: 'scale.sm' },
	{ id: 'md', label: 'scale.md' },
	{ id: 'lg', label: 'scale.lg' },
	{ id: 'xl', label: 'scale.xl' }
];

export const DEFAULT_ACCENT = 'terracotta';
export const DEFAULT_FONT_SCALE = 'sm';

export const STORAGE_KEY = 'familist:appearance';
