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

/**
 * The colours offered in the card form, each one named so the choice is not carried by the colour alone.
 *
 * Unlike `TINTS`, these are already dark enough for white text as they are: what the person picks is what
 * the card shows, not a darker cousin of it. The test holds every entry to 4.5:1.
 */
export const CARD_TINTS = [
	{ id: 'navy', hex: '#1E3A8A' },
	{ id: 'blue', hex: '#1D4ED8' },
	{ id: 'teal', hex: '#0F766E' },
	{ id: 'green', hex: '#166534' },
	{ id: 'red', hex: '#B91C1C' },
	{ id: 'orange', hex: '#C2410C' },
	{ id: 'plum', hex: '#8B3A62' },
	{ id: 'purple', hex: '#6D28D9' },
	{ id: 'brown', hex: '#5A4A2F' },
	{ id: 'slate', hex: '#334155' }
] as const;

export type CardTintId = (typeof CARD_TINTS)[number]['id'];

/**
 * A card's background, rebuilt from its tint at every display rather than read from the stored gradient:
 * a tint typed by somebody else, or a brand's light colour, is first darkened for white text.
 *
 * Both stops carry white at 4.5:1, and so does every point between them: relative luminance is convex in
 * each sRGB channel, so a mix is never lighter than the lighter of its two ends.
 */
export function cardBackground(tint: string | null | undefined): string {
	return `linear-gradient(135deg, ${tintForWhiteText(tint || DEFAULT_TINT)} 0%, ${CARD_GRADIENT_END} 100%)`;
}

const TARGET = 4.5;
const STEP = 0.04;

const channel = (v: number) => {
	const s = v / 255;
	return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

/** WCAG relative luminance. */
export const luminance = ({ r, g, b }: Rgb) =>
	0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG contrast between pure white and a colour. */
export const contrastWithWhite = (color: Rgb) => 1.05 / (luminance(color) + 0.05);

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
	const raw = (value ?? '').trim();
	const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(raw);
	if (short) {
		const [, r, g, b] = short;
		return { r: parseInt(r + r, 16), g: parseInt(g + g, 16), b: parseInt(b + b, 16) };
	}
	const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(raw);
	if (!long) return null;
	return { r: parseInt(long[1], 16), g: parseInt(long[2], 16), b: parseInt(long[3], 16) };
}

const byte = (v: number) =>
	Math.round(Math.max(0, Math.min(255, v)))
		.toString(16)
		.padStart(2, '0');

const toHex = ({ r, g, b }: Rgb) => '#' + byte(r) + byte(g) + byte(b);

/**
 * A tint dark enough to carry white text at 4.5:1. A tint already dark enough comes out unchanged, and so
 * does a value we cannot read: better to show the colour asked for than to invent.
 */
export function tintForWhiteText(value: string | null | undefined): string {
	const rgb = parseHex(value);
	if (!rgb) return (value ?? '').trim();

	let color = rgb;
	// The check runs on the rounded bytes that will be written, not on the fractions: rounding up could
	// otherwise land a hair under 4.5:1 — #78BE20 did, at 4.49:1.
	// 40 steps of 4% are far more than enough to reach black, the loop is bounded for safety.
	for (let i = 0; i < 40 && contrastWithWhite(parseHex(toHex(color))!) < TARGET; i++) {
		color = {
			r: color.r * (1 - STEP),
			g: color.g * (1 - STEP),
			b: color.b * (1 - STEP)
		};
	}

	return toHex(color);
}
