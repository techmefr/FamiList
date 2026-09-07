import { describe, expect, it } from 'vitest';
import { animates, isMotionPreference, navDirection } from './motion';

describe('animates', () => {
	it('coupe tout mouvement sur « aucun », même sans réglage système', () => {
		expect(animates('none', false)).toBe(false);
		expect(animates('none', true)).toBe(false);
	});

	it('anime toujours sur « complet », le réglage dans l application ayant le dernier mot', () => {
		expect(animates('full', true)).toBe(true);
		expect(animates('full', false)).toBe(true);
	});

	it('suit prefers-reduced-motion sur « système »', () => {
		expect(animates('system', true)).toBe(false);
		expect(animates('system', false)).toBe(true);
	});
});

describe('isMotionPreference', () => {
	it('accepte les trois valeurs connues', () => {
		expect(isMotionPreference('system')).toBe(true);
		expect(isMotionPreference('full')).toBe(true);
		expect(isMotionPreference('none')).toBe(true);
	});

	it('refuse ce qui vient d un stockage local abîmé', () => {
		expect(isMotionPreference('reduced')).toBe(false);
		expect(isMotionPreference('')).toBe(false);
		expect(isMotionPreference(undefined)).toBe(false);
		expect(isMotionPreference(1)).toBe(false);
	});
});

describe('navDirection', () => {
	const nav = ['/', '/shops', '/magnifier', '/cards', '/household', '/profile'];

	it('ne bouge pas quand on arrive là où on est déjà', () => {
		expect(navDirection('/cards', '/cards', nav)).toBe('none');
	});

	it('suit l ordre de la barre de navigation entre deux onglets', () => {
		expect(navDirection('/', '/cards', nav)).toBe('forward');
		expect(navDirection('/cards', '/', nav)).toBe('back');
		expect(navDirection('/shops', '/magnifier', nav)).toBe('forward');
	});

	it('entre en avant quand on descend dans une liste, en arrière quand on remonte', () => {
		expect(navDirection('/', '/l/abc', nav)).toBe('forward');
		expect(navDirection('/l/abc', '/', nav)).toBe('back');
		expect(navDirection('/l/abc', '/l/abc/chat', nav)).toBe('forward');
		expect(navDirection('/l/abc/chat', '/l/abc', nav)).toBe('back');
	});

	it('traite deux chemins de même profondeur hors barre comme une avancée', () => {
		expect(navDirection('/l/abc', '/l/xyz', nav)).toBe('forward');
	});

	it('se passe de la barre de navigation quand elle n est pas fournie', () => {
		expect(navDirection('/', '/auth/pending')).toBe('forward');
		expect(navDirection('/auth/pending', '/')).toBe('back');
	});
});
