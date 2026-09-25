import { describe, expect, it } from 'vitest';
import {
	MAX_STEP_SECONDS,
	clampDuration,
	detectDuration,
	durationFromFields,
	formatClock,
	splitDuration,
	suggestedDurations
} from './step-duration';

describe('detectDuration', () => {
	it.each([
		['Cuire 35 min au four', 35 * 60],
		['Laisser reposer 2 heures', 2 * 3600],
		['Enfourner pour 1 h 30', 90 * 60],
		['Cuire 1h30 à 180 °C', 90 * 60],
		['Cuire de 10 à 12 minutes', 12 * 60],
		['Fouetter 30 secondes', 30],
		['Bake for 25 minutes', 25 * 60],
		['Simmer 1.5 hours', 90 * 60],
		['Hornear 40 minutos', 40 * 60],
		['20 Minuten backen', 20 * 60],
		['Cuocere per 15 minuti', 15 * 60],
		['Cozinhar 8 a 10 minutos', 10 * 60],
		['Варить 20 минут', 20 * 60],
		['اطبخ لمدة ١٥ دقيقة', 15 * 60],
		['煮10分钟', 10 * 60],
		['Andrahoy mandritra ny 10 minitra', 10 * 60]
	])('%s', (text, seconds) => {
		expect(detectDuration(text)).toBe(seconds);
	});

	it('ne prend pas une température, un poids ou un mot qui commence par une unité', () => {
		expect(detectDuration('Préchauffer le four à 200 °C')).toBeNull();
		expect(detectDuration('Ajouter 250 g de farine')).toBeNull();
		expect(detectDuration('Add 2 minced garlic cloves')).toBeNull();
		expect(detectDuration('Servir chaud')).toBeNull();
	});

	it('ne colle pas le nombre de la phrase suivante à des minutes', () => {
		expect(detectDuration('Cuire 10 min. 2 oeufs ensuite')).toBe(600);
	});

	it('plafonne à une journée', () => {
		expect(detectDuration('Mariner 48 heures')).toBe(MAX_STEP_SECONDS);
	});
});

describe('champs du formulaire', () => {
	it('lit heures et minutes, vides compris', () => {
		expect(durationFromFields('1', '30')).toBe(5400);
		expect(durationFromFields('', '45')).toBe(2700);
		expect(durationFromFields('', '')).toBeNull();
		expect(durationFromFields('-1', '10')).toBeNull();
	});

	it('clampDuration refuse zéro et le négatif', () => {
		expect(clampDuration(0)).toBeNull();
		expect(clampDuration(-5)).toBeNull();
		expect(clampDuration(59.6)).toBe(60);
	});
});

describe('affichage', () => {
	it('découpe et formate un compte à rebours', () => {
		expect(splitDuration(3725)).toEqual({ hours: 1, minutes: 2, seconds: 5 });
		expect(formatClock(35 * 60)).toBe('35:00');
		expect(formatClock(3725)).toBe('1:02:05');
		expect(formatClock(0.4)).toBe('00:01');
	});
});

describe('suggestedDurations', () => {
	it('prend les minutes de l IA, et le texte de l étape sinon', () => {
		expect(suggestedDurations([0, 20, 'x'], ['Couper', 'Cuire', 'Reposer 5 min'])).toEqual([null, 1200, 300]);
	});

	it('suit les étapes gardées quand des vides sont retirés', () => {
		expect(suggestedDurations([5, 0, 10], ['Cuire', '', 'Servir'])).toEqual([300, 600]);
	});
});
