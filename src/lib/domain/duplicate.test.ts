import { describe, expect, it } from 'vitest';
import { copiedItem, copyName, type DuplicableItem } from './duplicate';

describe('copyName', () => {
	it('numérote la première copie', () => {
		expect(copyName('Courses', ['Courses'])).toBe('Courses (2)');
	});

	it('saute les rangs déjà pris', () => {
		expect(copyName('Courses', ['Courses', 'Courses (2)', 'Courses (3)'])).toBe('Courses (4)');
	});

	it('repart du nom d’origine quand on duplique une copie', () => {
		expect(copyName('Courses (2)', ['Courses', 'Courses (2)'])).toBe('Courses (3)');
	});

	it('ignore les espaces autour des noms existants', () => {
		expect(copyName('Courses', ['  Courses (2)  '])).toBe('Courses (3)');
	});

	it('garde les parenthèses qui ne sont pas un rang', () => {
		expect(copyName('Courses (bio)', [])).toBe('Courses (bio) (2)');
	});

	it('numérote même sans liste existante', () => {
		expect(copyName('Noël', [])).toBe('Noël (2)');
	});
});

describe('copiedItem', () => {
	const source: DuplicableItem = {
		aisleId: 'fruits',
		name: 'Tomates',
		qty: '500',
		unit: 'g',
		checked: true,
		priority: true,
		note: 'bien mûres',
		assignedTo: 'papa'
	};

	it('reprend le produit voulu', () => {
		expect(copiedItem(source)).toMatchObject({
			aisleId: 'fruits',
			name: 'Tomates',
			qty: '500',
			unit: 'g',
			priority: true,
			note: 'bien mûres'
		});
	});

	it('décoche l’article', () => {
		expect(copiedItem(source).checked).toBe(false);
	});

	it('laisse l’attribution derrière', () => {
		expect(copiedItem(source)).not.toHaveProperty('assignedTo', 'papa');
	});

	it('laisse la note absente absente', () => {
		expect(copiedItem({ ...source, note: undefined }).note).toBeUndefined();
	});
});
