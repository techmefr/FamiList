export type Theme = 'light' | 'dark' | 'system';

export interface AccentPreset {
	id: string;
	/** Clé i18n du libellé. */
	label: string;
	light: string;
	dark: string;
	tint: string;
	tintDark: string;
}

/**
 * Le premier preset reproduit exactement la terracotta du prototype. Les autres sont dérivés en
 * OKLCH à clarté fixée par thème, ce qui garde un contraste comparable quelle que soit la teinte :
 * clarté basse en clair (texte blanc lisible dessus), clarté haute en sombre (texte foncé lisible).
 *
 * Ces valeurs sont dupliquées dans le script anti-flash de src/app.html, qui s'exécute avant que ce
 * module ne soit chargé. Toute modification ici doit y être répercutée.
 */
export const ACCENT_PRESETS: AccentPreset[] = [
	{
		id: 'terracotta',
		label: 'accent.terracotta',
		light: '#c8532a',
		dark: '#e8885e',
		tint: 'rgb(200 83 42 / 0.10)',
		tintDark: 'rgb(232 136 94 / 0.14)'
	},
	{
		id: 'forest',
		label: 'accent.forest',
		light: 'oklch(0.45 0.11 155)',
		dark: 'oklch(0.75 0.11 155)',
		tint: 'oklch(0.45 0.11 155 / 0.10)',
		tintDark: 'oklch(0.75 0.11 155 / 0.14)'
	},
	{
		id: 'blue',
		label: 'accent.blue',
		light: 'oklch(0.5 0.15 250)',
		dark: 'oklch(0.75 0.13 250)',
		tint: 'oklch(0.5 0.15 250 / 0.10)',
		tintDark: 'oklch(0.75 0.13 250 / 0.14)'
	},
	{
		id: 'plum',
		label: 'accent.plum',
		light: 'oklch(0.48 0.16 330)',
		dark: 'oklch(0.75 0.14 330)',
		tint: 'oklch(0.48 0.16 330 / 0.10)',
		tintDark: 'oklch(0.75 0.14 330 / 0.14)'
	},
	{
		id: 'teal',
		label: 'accent.teal',
		light: 'oklch(0.48 0.1 195)',
		dark: 'oklch(0.76 0.1 195)',
		tint: 'oklch(0.48 0.1 195 / 0.10)',
		tintDark: 'oklch(0.76 0.1 195 / 0.14)'
	},
	{
		id: 'ink',
		label: 'accent.ink',
		light: 'oklch(0.35 0.03 60)',
		dark: 'oklch(0.82 0.02 60)',
		tint: 'oklch(0.35 0.03 60 / 0.10)',
		tintDark: 'oklch(0.82 0.02 60 / 0.14)'
	}
];

export interface FontScalePreset {
	id: string;
	label: string;
	/**
	 * Multiplicateur du 16px racine. Tous les tokens typographiques et les espacements Tailwind
	 * étant en rem, ils grandissent ensemble et les proportions du prototype sont préservées.
	 */
	scale: number;
}

/** Cinq crans, jusqu'à 1,6 pour les personnes malvoyantes qui zooment fortement. */
export const FONT_SCALE_PRESETS: FontScalePreset[] = [
	{ id: 'xs', label: 'scale.xs', scale: 0.9 },
	{ id: 'sm', label: 'scale.sm', scale: 1 },
	{ id: 'md', label: 'scale.md', scale: 1.15 },
	{ id: 'lg', label: 'scale.lg', scale: 1.35 },
	{ id: 'xl', label: 'scale.xl', scale: 1.6 }
];

export const DEFAULT_ACCENT = ACCENT_PRESETS[0].id;
export const DEFAULT_FONT_SCALE = 'sm';

export const STORAGE_KEY = 'familist:appearance';
