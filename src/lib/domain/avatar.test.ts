import { describe, it, expect } from 'vitest';
import { initialsOf, initialsFor, coverSquare, AVATAR_SIZE, AVATAR_MAX_BYTES } from './avatar';

describe('initialsFor', () => {
	it('prend le prenom et le nom quand ils sont renseignes', () => {
		expect(initialsFor('Hélène', 'Moreau', 'Mamie')).toBe('HM');
	});

	it('ignore le surnom, meme quand il tiendrait deux lettres', () => {
		expect(initialsFor('Hélène', 'Moreau', 'Tata Lulu')).toBe('HM');
	});

	it("retombe sur le nom affiche tant que l'identite n'est pas saisie", () => {
		expect(initialsFor('', '', 'Jean Dupont')).toBe('JD');
		expect(initialsFor('   ', '   ', 'Jean Dupont')).toBe('JD');
	});

	it('se contente du prenom quand le nom manque', () => {
		expect(initialsFor('Hélène', '', 'Mamie')).toBe('H');
		expect(initialsFor('', 'Moreau', 'Mamie')).toBe('M');
	});

	it('rend un tiret quand il ne reste rien a lire', () => {
		expect(initialsFor('', '', '')).toBe('—');
	});
});

describe('initialsOf', () => {
	it('prend deux initiales sur un nom en deux mots', () => {
		expect(initialsOf('Hélène Moreau')).toBe('HM');
	});

	it('prend la premiere lettre sur un nom en un mot', () => {
		expect(initialsOf('Hélène')).toBe('H');
	});

	it('garde les accents', () => {
		expect(initialsOf('Élise Éluard')).toBe('ÉÉ');
	});

	it('ignore les particules', () => {
		expect(initialsOf('Jean de La Fontaine')).toBe('JF');
		expect(initialsOf('Ludwig van Beethoven')).toBe('LB');
	});

	it('coupe sur les traits d union et les apostrophes', () => {
		expect(initialsOf('Marie-Claire')).toBe('MC');
		expect(initialsOf("Jeanne d'Arc")).toBe('JA');
	});

	it('prend le premier et le dernier mot, pas les deux premiers', () => {
		expect(initialsOf('Anne Sophie Durand')).toBe('AD');
	});

	it('rend un tiret cadratin plutot que rien', () => {
		expect(initialsOf('')).toBe('—');
		expect(initialsOf('   ')).toBe('—');
		expect(initialsOf('de la')).toBe('—');
	});

	it('passe la casse en majuscules', () => {
		expect(initialsOf('hélène moreau')).toBe('HM');
	});
});

describe('coverSquare', () => {
	it('centre le carre dans une image large', () => {
		expect(coverSquare(400, 200)).toEqual({ sx: 100, sy: 0, taille: 200 });
	});

	it('centre le carre dans une image haute', () => {
		expect(coverSquare(200, 400)).toEqual({ sx: 0, sy: 100, taille: 200 });
	});

	it('ne rogne rien sur une image deja carree', () => {
		expect(coverSquare(300, 300)).toEqual({ sx: 0, sy: 0, taille: 300 });
	});

	it('arrondit sur une difference impaire', () => {
		const { sx, taille } = coverSquare(101, 100);
		expect(taille).toBe(100);
		expect(sx).toBe(1);
	});
});

describe('constantes', () => {
	it('reste une vignette, pas une photo', () => {
		expect(AVATAR_SIZE).toBeLessThanOrEqual(256);
		expect(AVATAR_MAX_BYTES).toBeGreaterThan(1024 * 1024);
	});
});
