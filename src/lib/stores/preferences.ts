import type { Hand } from '$domain/hand';
import type { MotionPreference } from '$domain/motion';

export type Theme = 'light' | 'dark' | 'system';

export interface AccentPreset {
	id: string;
	/** i18n key of the label. */
	label: string;
}

/**
 * The colour values live in src/app.css, under [data-accent='<id>']. This file only carries the list and
 * the display order: adding a preset means adding an entry here and a block over there, never a value
 * twice.
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
 * Seven steps, up to 2.3. "Comfort" is made to be read at arm's length, in an aisle, by somebody who left
 * their glasses at home. The multipliers themselves are in app.css, under [data-scale='<id>']; each step
 * must fit on a 375px screen without cutting anything off.
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
 * "System" first, and by default: the system stack takes the font the person chose on their device.
 * Somebody who installed a font suited to their dyslexia finds it here without setting anything, and that
 * is always better than the best font we could impose on them.
 *
 * The other two are there for those who set nothing: Atkinson Hyperlegible was drawn for low vision, it
 * pushes apart the shapes that blend (I, l, 1 — O, 0). The mockup's pair stays available to find the
 * original look.
 *
 * As for the accents, the values live in src/app.css, under [data-font='<id>'].
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

/** Right-handed by default: it is the place the create button already occupies. */
export const DEFAULT_HAND: Hand = 'right';

/**
 * Sound and vibration start on. Both only fire on a gesture, last less than a third of a second and are
 * switched off from the profile; discovering them by ticking an item is more likely than going to look for
 * them in the settings.
 */
export const DEFAULT_SOUND = true;
export const DEFAULT_HAPTICS = true;

/**
 * The card offer on approaching a shop starts off, unlike sound and vibration: it assumes letting the
 * device follow your position. That kind of consent is given, it is not taken back afterwards.
 */
export const DEFAULT_NEARBY_CARDS = false;

/** Background colours of :root and .dark, for the system status bar. */
export const THEME_COLORS = { light: '#f1ede5', dark: '#0a0907' } as const;

export const STORAGE_KEY = 'familist:appearance';
