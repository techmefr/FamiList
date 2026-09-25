import { describe, expect, it } from 'vitest';
import {
	CARD_GRADIENT_END,
	CARD_TINTS,
	cardBackground,
	contrastWithWhite,
	parseHex,
	tintForWhiteText
} from './tint';

const contrast = (hex: string) => contrastWithWhite(parseHex(hex)!);

describe('parseHex', () => {
	it('lit la forme longue et la forme courte', () => {
		expect(parseHex('#c8532a')).toEqual({ r: 200, g: 83, b: 42 });
		expect(parseHex('#abc')).toEqual({ r: 170, g: 187, b: 204 });
	});

	it('ignore la casse et les espaces', () => {
		expect(parseHex('  #C8532A ')).toEqual({ r: 200, g: 83, b: 42 });
	});

	it('rend null sur ce qui n est pas un hexadecimal', () => {
		expect(parseHex('oklch(0.5 0.15 42)')).toBeNull();
		expect(parseHex('rebeccapurple')).toBeNull();
		expect(parseHex('#12345')).toBeNull();
		expect(parseHex('')).toBeNull();
		expect(parseHex(null)).toBeNull();
	});
});

describe('tintForWhiteText', () => {
	it('assombrit la teracotta qui echouait de peu', () => {
		expect(contrast('#c8532a')).toBeLessThan(4.5);
		expect(contrast(tintForWhiteText('#c8532a'))).toBeGreaterThanOrEqual(4.5);
	});

	it('laisse intacte une teinte deja assez sombre', () => {
		expect(tintForWhiteText('#5a4a2f')).toBe('#5a4a2f');
	});

	it('fait passer meme une teinte tres claire', () => {
		expect(contrast(tintForWhiteText('#ffe08a'))).toBeGreaterThanOrEqual(4.5);
	});

	it('rend la valeur telle quelle quand ce n est pas un hexadecimal', () => {
		expect(tintForWhiteText('oklch(0.5 0.15 42)')).toBe('oklch(0.5 0.15 42)');
		expect(tintForWhiteText(null)).toBe('');
	});

	it('verifie le contraste sur la couleur arrondie qu elle rend', () => {
		expect(contrast(tintForWhiteText('#78be20'))).toBeGreaterThanOrEqual(4.5);
	});

	it('ne s emballe pas sur du noir', () => {
		expect(tintForWhiteText('#000000')).toBe('#000000');
	});
});

describe('CARD_TINTS', () => {
	it('porte du texte blanc a 4.5:1 sans ajustement', () => {
		for (const tint of CARD_TINTS) {
			expect(contrast(tint.hex), tint.id).toBeGreaterThanOrEqual(4.5);
			expect(tintForWhiteText(tint.hex), tint.id).toBe(tint.hex.toLowerCase());
		}
	});

	it('nomme chaque couleur une seule fois', () => {
		expect(new Set(CARD_TINTS.map((tint) => tint.id)).size).toBe(CARD_TINTS.length);
		expect(new Set(CARD_TINTS.map((tint) => tint.hex)).size).toBe(CARD_TINTS.length);
	});
});

describe('cardBackground', () => {
	const stops = (background: string) =>
		[...background.matchAll(/#[0-9a-f]{6}/gi)].map((match) => match[0]);

	const mix = (a: string, b: string, t: number) => {
		const from = parseHex(a)!;
		const to = parseHex(b)!;
		return {
			r: from.r + (to.r - from.r) * t,
			g: from.g + (to.g - from.g) * t,
			b: from.b + (to.b - from.b) * t
		};
	};

	it('assombrit une couleur claire avant d en faire un degrade', () => {
		const [start, end] = stops(cardBackground('#e1a925'));
		expect(contrast(start)).toBeGreaterThanOrEqual(4.5);
		expect(end).toBe(CARD_GRADIENT_END);
	});

	it('garde du texte blanc lisible sur tout le degrade', () => {
		for (const tint of ['#e1a925', '#ffffff', '#78be20', '#c8532a', '#00ffff']) {
			const [start, end] = stops(cardBackground(tint));
			for (let t = 0; t <= 1; t += 0.05) {
				expect(contrastWithWhite(mix(start, end, t)), `${tint} a ${t}`).toBeGreaterThanOrEqual(4.5);
			}
		}
	});

	it('prend la teinte par defaut quand la carte n en a pas', () => {
		expect(cardBackground('')).toBe(cardBackground('#5A4A2F'));
	});
});
