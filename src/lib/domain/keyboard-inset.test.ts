import { describe, expect, it } from 'vitest';
import { keyboardInset, MIN_KEYBOARD_PX } from './keyboard-inset';

describe('keyboardInset', () => {
	it('vaut zero sans clavier', () => {
		expect(keyboardInset(800, { height: 800, offsetTop: 0, scale: 1 })).toBe(0);
	});

	it('mesure la hauteur couverte par le clavier', () => {
		expect(keyboardInset(800, { height: 480.4, offsetTop: 0, scale: 1 })).toBe(320);
	});

	it('tient compte du defilement du viewport visuel', () => {
		expect(keyboardInset(800, { height: 400, offsetTop: 100, scale: 1 })).toBe(300);
	});

	it('ignore la barre du navigateur qui se replie', () => {
		expect(keyboardInset(800, { height: 800 - MIN_KEYBOARD_PX + 1, offsetTop: 0, scale: 1 })).toBe(0);
	});

	it('ignore un zoom a deux doigts', () => {
		expect(keyboardInset(800, { height: 400, offsetTop: 0, scale: 2 })).toBe(0);
	});
});
