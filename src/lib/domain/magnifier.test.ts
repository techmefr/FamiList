import { describe, expect, it } from 'vitest';
import {
	CENTER,
	clampFocus,
	digitalZoom,
	opticalZoom,
	panFocus,
	pinchDistance,
	pinchZoom,
	viewFilter,
	visibleSource
} from './magnifier';

describe('opticalZoom', () => {
	it('vaut 1 quand l objectif ne zoome pas', () => {
		expect(opticalZoom(3, null)).toBe(1);
	});

	it('ignore une plage vide annoncee par le pilote', () => {
		expect(opticalZoom(3, { min: 1, max: 1 })).toBe(1);
	});

	it('plafonne a ce que l objectif accepte', () => {
		expect(opticalZoom(5, { min: 1, max: 2 })).toBe(2);
	});

	it('respecte un plancher superieur a 1', () => {
		expect(opticalZoom(1, { min: 1.5, max: 4 })).toBe(1.5);
	});
});

describe('digitalZoom', () => {
	it('complete ce que l objectif n a pas pu donner', () => {
		expect(digitalZoom(5, 2)).toBe(2.5);
	});

	it('n agrandit pas davantage quand l objectif a tout donne', () => {
		expect(digitalZoom(3, 3)).toBe(1);
	});

	it('ne reduit jamais l image', () => {
		expect(digitalZoom(2, 4)).toBe(1);
	});

	it('porte tout le grossissement quand l objectif est fixe', () => {
		expect(digitalZoom(4, 1)).toBe(4);
	});
});

describe('viewFilter', () => {
	it('ne touche pas à l’image quand aucune aide n’est demandée', () => {
		expect(viewFilter({ contrast: false, brighten: false })).toBe('none');
	});

	it('éclaircit un peu quand la torche est logicielle', () => {
		expect(viewFilter({ contrast: false, brighten: true })).toBe(
			'brightness(1.35) contrast(1.05)'
		);
	});

	it('retire la couleur et écarte les gris en mode contraste', () => {
		expect(viewFilter({ contrast: true, brighten: false })).toBe('grayscale(1) contrast(1.9)');
	});

	// Le contraste fort remplace le léger de la torche : les cumuler bouchait les noirs.
	it('cumule les deux sans empiler deux contrastes', () => {
		expect(viewFilter({ contrast: true, brighten: true })).toBe(
			'brightness(1.35) grayscale(1) contrast(1.9)'
		);
	});
});

describe('pinchZoom', () => {
	it('grossit dans le meme rapport que l ecartement des doigts', () => {
		expect(pinchZoom(2, 100, 150)).toBe(3);
	});

	it('reduit quand les doigts se rapprochent', () => {
		expect(pinchZoom(4, 200, 100)).toBe(2);
	});

	it('ne descend pas sous le minimum du curseur', () => {
		expect(pinchZoom(1.5, 200, 20)).toBe(1);
	});

	it('ne depasse pas le maximum du curseur', () => {
		expect(pinchZoom(4, 100, 900)).toBe(5);
	});

	it('ignore un ecartement de depart nul', () => {
		expect(pinchZoom(2.5, 0, 120)).toBe(2.5);
	});

	it('mesure l ecartement entre deux doigts', () => {
		expect(pinchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
	});
});

describe('clampFocus', () => {
	it('recentre tant qu il n y a rien a deplacer', () => {
		expect(clampFocus({ x: 0.1, y: 0.9 }, 1)).toEqual(CENTER);
	});

	it('laisse le point demande quand la fenetre tient dans l image', () => {
		expect(clampFocus({ x: 0.4, y: 0.6 }, 2)).toEqual({ x: 0.4, y: 0.6 });
	});

	it('empeche d atteindre un bord vide', () => {
		expect(clampFocus({ x: 0, y: 1 }, 2)).toEqual({ x: 0.25, y: 0.75 });
	});

	it('libere d autant plus de course que le grossissement est fort', () => {
		expect(clampFocus({ x: 0, y: 0 }, 5)).toEqual({ x: 0.1, y: 0.1 });
	});

	it('recentre une valeur qui n est pas un nombre', () => {
		expect(clampFocus({ x: Number.NaN, y: 0.5 }, 2)).toEqual({ x: 0.5, y: 0.5 });
	});
});

describe('panFocus', () => {
	const view = { width: 400, height: 800 };

	it('deplace le point regarde a l inverse du doigt', () => {
		expect(panFocus(CENTER, { x: -200, y: 0 }, view, 2)).toEqual({ x: 0.75, y: 0.5 });
	});

	it('avance d autant moins que le grossissement est fort', () => {
		expect(panFocus(CENTER, { x: -200, y: 0 }, view, 4).x).toBe(0.625);
	});

	it('s arrete au bord plutot que de sortir de l image', () => {
		expect(panFocus(CENTER, { x: -4000, y: 4000 }, view, 2)).toEqual({ x: 0.75, y: 0.25 });
	});

	it('ne bouge pas tant que l image n est pas grossie', () => {
		expect(panFocus(CENTER, { x: -200, y: -200 }, view, 1)).toEqual(CENTER);
	});

	it('ignore une zone d affichage encore inconnue', () => {
		expect(panFocus({ x: 0.4, y: 0.4 }, { x: 50, y: 50 }, { width: 0, height: 0 }, 2)).toEqual({
			x: 0.4,
			y: 0.4
		});
	});
});

describe('visibleSource', () => {
	const source = { width: 1920, height: 1080 };
	const view = { width: 400, height: 800 };

	it('decoupe la partie reellement affichee au repos', () => {
		expect(visibleSource(source, view, CENTER, 1)).toEqual({
			x: 690,
			y: 0,
			width: 540,
			height: 1080
		});
	});

	it('retrecit la decoupe a mesure qu on grossit', () => {
		expect(visibleSource(source, view, CENTER, 2)).toEqual({
			x: 825,
			y: 270,
			width: 270,
			height: 540
		});
	});

	it('suit le point regarde', () => {
		expect(visibleSource(source, view, { x: 0.75, y: 0.75 }, 2)).toEqual({
			x: 960,
			y: 540,
			width: 270,
			height: 540
		});
	});

	it('ne sort jamais de la zone qui etait visible', () => {
		const rect = visibleSource(source, view, { x: 2, y: -2 }, 2);

		expect(rect.x + rect.width).toBeLessThanOrEqual(1230);
		expect(rect.y).toBeGreaterThanOrEqual(0);
	});

	it('ne reduit pas la decoupe sous le grossissement au repos', () => {
		expect(visibleSource(source, view, CENTER, 0.5).width).toBe(540);
	});
});
