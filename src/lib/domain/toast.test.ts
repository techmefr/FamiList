import { describe, expect, it } from 'vitest';
import { MAX_TOASTS, TOAST_DURATION_MS, dismissToast, isSticky, progressToast, pushToast, type Toast } from './toast';

const toast = (id: number, tone: Toast['tone'] = 'success'): Toast => ({ id, tone, message: `m${id}` });

describe('pushToast', () => {
	it('ajoute le nouveau toast en dernier', () => {
		expect(pushToast([toast(1)], toast(2)).map((t) => t.id)).toEqual([1, 2]);
	});

	it('ne garde que les plus recents au-dela du plafond', () => {
		let toasts: Toast[] = [];
		for (let id = 1; id <= MAX_TOASTS + 2; id++) toasts = pushToast(toasts, toast(id));

		expect(toasts).toHaveLength(MAX_TOASTS);
		expect(toasts.at(-1)?.id).toBe(MAX_TOASTS + 2);
	});
});

describe('dismissToast', () => {
	it('retire seulement le toast vise', () => {
		expect(dismissToast([toast(1), toast(2)], 1).map((t) => t.id)).toEqual([2]);
	});

	it('ne fait rien pour un toast deja parti', () => {
		expect(dismissToast([toast(1)], 9)).toEqual([toast(1)]);
	});
});

describe('TOAST_DURATION_MS', () => {
	it('laisse une erreur affichee plus longtemps qu une confirmation', () => {
		expect(TOAST_DURATION_MS.error).toBeGreaterThan(TOAST_DURATION_MS.success);
	});
});

describe('isSticky', () => {
	it('laisse partir une simple confirmation', () => {
		expect(isSticky({ tone: 'success' })).toBe(false);
		expect(isSticky({ tone: 'error' })).toBe(false);
	});

	it('garde un toast qui porte un bouton ou une barre de progression', () => {
		expect(isSticky({ tone: 'success', action: { label: 'Ouvrir', run: () => {} } })).toBe(true);
		expect(isSticky({ tone: 'progress' })).toBe(true);
	});
});

describe('progressToast', () => {
	it('avance seulement le toast vise, entre 0 et 1', () => {
		const items: Toast[] = [toast(1, 'progress'), toast(2)];
		expect(progressToast(items, 1, 0.4)[0].progress).toBe(0.4);
		expect(progressToast(items, 1, 3)[0].progress).toBe(1);
		expect(progressToast(items, 1, Number.NaN)[0].progress).toBe(0);
		expect(progressToast(items, 1, 0.4)[1]).toBe(items[1]);
	});
});
