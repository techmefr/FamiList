/**
 * Making white text readable on a tint chosen by somebody else.
 *
 * Member and shop tints are data: they come from the database, nobody validated them against a contrast
 * ratio. The one set as the default, the old terracotta #C8532A, gave 4.44:1 under white — just under the
 * 4.5:1 required. And darkening the text would not have saved that case: on that tint, dark ink only
 * reaches 3.97:1. No text colour passes on a mid-range tint, so the background has to move.
 *
 * We darken in steps until white passes. The tint stays recognisable — it is the same colour, darker —
 * and convergence is guaranteed since black gives 21:1.
 */
/**
 * Palette of the tints given to shops, cards and lists.
 *
 * These are identifying colours, not the accent colour: two shops must be told apart, and aligning them on
 * the accent would make them all identical. We cycle through them at creation so the first few creations
 * stand out straight away.
 *
 * They all go through `tintForWhiteText` at display time, which darkens them if needed: the list
 * therefore does not have to be checked for contrast, only its tint legibility matters.
 */
export const TINTS = ['#5A4A2F', '#8B3A62', '#4A6B3A', '#C67A3E', '#2563EB', '#1F5C3A'];

/** Tint used when the database carries none, for a shop, a card or a list. */
export const DEFAULT_TINT = TINTS[0];

/**
 * A member's fallback tint: the default terracotta, copied from --primary in app.css. A member with no
 * colour is a member who has not chosen yet, so they may as well get the app's.
 */
export const DEFAULT_MEMBER_TINT = '#A94008';

/** Bottom of a loyalty card's gradient, shared by every tint. */
export const CARD_GRADIENT_END = '#2E2518';

const CIBLE = 4.5;
const PALIER = 0.04;

const canal = (v: number) => {
	const s = v / 255;
	return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

/** WCAG relative luminance. */
export const luminance = ({ r, g, b }: Rgb) =>
	0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);

/** WCAG contrast between pure white and a colour. */
export const contrastWithWhite = (couleur: Rgb) => 1.05 / (luminance(couleur) + 0.05);

export interface Rgb {
	r: number;
	g: number;
	b: number;
}

/**
 * Accepts `#rgb` and `#rrggbb`. Returns null on everything else — an `oklch(...)` or a CSS name stored in
 * the database must not be guessed, the caller will let it through as it is.
 */
export function parseHex(value: string | null | undefined): Rgb | null {
	const brut = (value ?? '').trim();
	const court = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(brut);
	if (court) {
		const [, r, g, b] = court;
		return { r: parseInt(r + r, 16), g: parseInt(g + g, 16), b: parseInt(b + b, 16) };
	}
	const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(brut);
	if (!long) return null;
	return { r: parseInt(long[1], 16), g: parseInt(long[2], 16), b: parseInt(long[3], 16) };
}

const octet = (v: number) =>
	Math.round(Math.max(0, Math.min(255, v)))
		.toString(16)
		.padStart(2, '0');

const toHex = ({ r, g, b }: Rgb) => '#' + octet(r) + octet(g) + octet(b);

/**
 * A tint dark enough to carry white text at 4.5:1. A tint already dark enough comes out unchanged, and so
 * does a value we cannot read: better to show the colour asked for than to invent.
 */
export function tintForWhiteText(value: string | null | undefined): string {
	const rgb = parseHex(value);
	if (!rgb) return (value ?? '').trim();

	let couleur = rgb;
	// 40 steps of 4% are far more than enough to reach black, the loop is bounded for safety.
	for (let i = 0; i < 40 && contrastWithWhite(couleur) < CIBLE; i++) {
		couleur = {
			r: couleur.r * (1 - PALIER),
			g: couleur.g * (1 - PALIER),
			b: couleur.b * (1 - PALIER)
		};
	}

	return toHex(couleur);
}
