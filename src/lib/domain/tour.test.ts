import { describe, expect, it } from 'vitest';
import { NAV_STEPS, pickSteps, screenSteps, SCREEN_STEPS, type TourStep } from './tour';

const tout = () => true;
const rien = () => false;
const seulement =
	(...selecteurs: string[]) =>
	(selector: string) =>
		selecteurs.includes(selector);

describe('screenSteps', () => {
	it("rend le tour d'ensemble sur l'accueil", () => {
		expect(screenSteps('/')).toEqual(NAV_STEPS);
	});

	it('rend le tour de la liste sur une liste', () => {
		expect(screenSteps('/l/abc-123').map((s) => s.key)).toEqual([
			'listRoute',
			'listFilters',
			'listFilters',
			'listShare',
			'listChat'
		]);
	});

	it('ne prend pas la liste pour son fil de discussion', () => {
		expect(screenSteps('/l/abc-123/chat')).toEqual(NAV_STEPS);
	});

	it('reconnaît les écrans à sous-chemin', () => {
		expect(screenSteps('/shops/42').map((s) => s.key)).toEqual(['shopsAisles']);
	});

	it("retombe sur la barre de navigation pour un écran qu'il ne connaît pas", () => {
		expect(screenSteps('/household')).toEqual(NAV_STEPS);
		expect(screenSteps('/admin')).toEqual(NAV_STEPS);
	});

	it('a un tour pour chacun des cinq onglets', () => {
		for (const chemin of ['/', '/magnifier', '/shops', '/cards', '/profile']) {
			expect(screenSteps(chemin).length).toBeGreaterThan(0);
		}
	});
});

describe('pickSteps', () => {
	const etapes: TourStep[] = [
		{ selector: '#a', key: 'un' },
		{ selector: '#b', key: 'deux' },
		{ selector: '#c', key: 'deux' },
		{ selector: '#d', key: 'trois' }
	];

	it('écarte les repères invisibles', () => {
		expect(pickSteps(etapes, rien)).toEqual([]);
	});

	it("ne garde qu'un repère par sujet", () => {
		expect(pickSteps(etapes, tout).map((s) => s.selector)).toEqual(['#a', '#b', '#d']);
	});

	it('prend la variante visible quand la première est cachée', () => {
		expect(pickSteps(etapes, seulement('#c', '#d')).map((s) => s.selector)).toEqual(['#c', '#d']);
	});

	it("conserve l'ordre de déclaration", () => {
		expect(pickSteps(etapes, seulement('#d', '#a')).map((s) => s.key)).toEqual(['un', 'trois']);
	});

	it('rend une liste vide sans étape', () => {
		expect(pickSteps([], tout)).toEqual([]);
	});
});

describe('les repères visés', () => {
	const toutes = [...NAV_STEPS, ...SCREEN_STEPS.flatMap((entry) => entry.steps)];

	it('ne visent que des repères de test', () => {
		for (const etape of toutes) {
			expect(etape.selector).toMatch(/^\[data-test-id="[^"]+"\]$/);
		}
	});

	it('portent tous une clé de traduction', () => {
		for (const etape of toutes) {
			expect(etape.key).toMatch(/^[a-zA-Z]+$/);
		}
	});
});
