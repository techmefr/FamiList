import { describe, expect, it } from 'vitest';
import { MAX_TOASTS, TOAST_DURATION_MS, dismissToast, pushToast, type Toast } from './toast';

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
