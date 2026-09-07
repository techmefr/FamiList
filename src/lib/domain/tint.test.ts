import { describe, expect, it } from 'vitest';
import { contrastWithWhite, parseHex, tintForWhiteText } from './tint';

const contraste = (hex: string) => contrastWithWhite(parseHex(hex)!);

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
		expect(contraste('#c8532a')).toBeLessThan(4.5);
		expect(contraste(tintForWhiteText('#c8532a'))).toBeGreaterThanOrEqual(4.5);
	});

	it('laisse intacte une teinte deja assez sombre', () => {
		expect(tintForWhiteText('#5a4a2f')).toBe('#5a4a2f');
	});

	it('fait passer meme une teinte tres claire', () => {
		expect(contraste(tintForWhiteText('#ffe08a'))).toBeGreaterThanOrEqual(4.5);
	});

	it('rend la valeur telle quelle quand ce n est pas un hexadecimal', () => {
		expect(tintForWhiteText('oklch(0.5 0.15 42)')).toBe('oklch(0.5 0.15 42)');
		expect(tintForWhiteText(null)).toBe('');
	});

	it('ne s emballe pas sur du noir', () => {
		expect(tintForWhiteText('#000000')).toBe('#000000');
	});
});
