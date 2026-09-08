import type { MotionPreference } from '$domain/motion';

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
 * Sept crans, jusqu'à 2,3. « Confort » est fait pour être lu à bout de bras, dans un rayon, par
 * quelqu'un qui a laissé ses lunettes chez lui. Les multiplicateurs eux-mêmes sont dans app.css,
 * sous [data-scale='<id>'] ; chaque cran doit tenir sur un écran de 375 px sans rien couper.
 */
export const FONT_SCALE_PRESETS: FontScalePreset[] = [
	{ id: 'xs', label: 'scale.xs' },
	{ id: 'sm', label: 'scale.sm' },
	{ id: 'md', label: 'scale.md' },
	{ id: 'lg', label: 'scale.lg' },
	{ id: 'xl', label: 'scale.xl' },
	{ id: 'xxl', label: 'scale.xxl' },
	{ id: 'comfort', label: 'scale.comfort' }
];

export interface FontPreset {
	id: string;
	label: string;
}

/**
 * « Système » d'abord, et par défaut : la pile du système reprend la police que la personne a
 * choisie sur son appareil. Quelqu'un qui a installé une police adaptée à sa dyslexie la retrouve
 * ici sans rien régler, et c'est toujours mieux que la meilleure des polices qu'on lui imposerait.
 *
 * Les deux autres sont là pour qui n'a rien réglé : Atkinson Hyperlegible a été dessinée pour la
 * basse vision, elle écarte les formes qui se confondent (I, l, 1 — O, 0). Le duo de la maquette
 * reste disponible pour retrouver l'allure d'origine.
 *
 * Comme pour les accents, les valeurs vivent dans src/app.css, sous [data-font='<id>'].
 */
export const FONT_PRESETS: FontPreset[] = [
	{ id: 'system', label: 'font.system' },
	{ id: 'atkinson', label: 'font.atkinson' },
	{ id: 'grotesk', label: 'font.grotesk' }
];

export const DEFAULT_ACCENT = 'terracotta';
export const DEFAULT_FONT_SCALE = 'sm';
export const DEFAULT_FONT = 'system';
export const DEFAULT_MOTION: MotionPreference = 'system';

/**
 * Son et vibration partent allumés. Les deux ne se déclenchent que sur un geste, durent moins d'un
 * tiers de seconde et se coupent d'un interrupteur dans le profil ; les découvrir en cochant un
 * article est plus probable que d'aller les chercher dans les réglages.
 */
export const DEFAULT_SOUND = true;
export const DEFAULT_HAPTICS = true;

/** Couleurs de fond de :root et .dark, pour la barre de statut du système. */
export const THEME_COLORS = { light: '#f1ede5', dark: '#0a0907' } as const;

export const STORAGE_KEY = 'familist:appearance';
