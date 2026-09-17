import { describe, expect, it } from 'vitest';
import {
	cardForShop,
	distanceMeters,
	nearbyAlert,
	nearbyDay,
	nearbyId,
	NEARBY_ID_OFFSET,
	NEARBY_RADIUS_M,
	rememberNotified,
	type NearbyCard,
	type NearbyShop
} from './nearby';

const MEXIMIEUX = { lat: 45.9075, lng: 5.1944 };

const magasin = (patch: Partial<NearbyShop> = {}): NearbyShop => ({
	shopId: 'shop-1',
	name: 'Carrefour Meximieux',
	brand: 'Carrefour',
	lat: MEXIMIEUX.lat,
	lng: MEXIMIEUX.lng,
	...patch
});

const carte = (patch: Partial<NearbyCard> = {}): NearbyCard => ({
	cardId: 'card-1',
	name: 'Carrefour',
	shopId: '',
	brand: 'Carrefour',
	...patch
});

/** An offset in latitude, converted to metres: one degree is about 111,320 m. */
const aMetres = (metres: number) => ({
	lat: MEXIMIEUX.lat + metres / 111_320,
	lng: MEXIMIEUX.lng
});

describe('distanceMeters', () => {
	it('rend zéro pour le même point', () => {
		expect(distanceMeters(MEXIMIEUX, MEXIMIEUX)).toBe(0);
	});

	it('mesure un déplacement court à quelques mètres près', () => {
		expect(distanceMeters(MEXIMIEUX, aMetres(500))).toBeCloseTo(500, -1);
	});

	it('est symétrique', () => {
		const aller = distanceMeters(MEXIMIEUX, aMetres(1200));
		const retour = distanceMeters(aMetres(1200), MEXIMIEUX);

		expect(aller).toBeCloseTo(retour, 6);
	});

	// Paris–Lyon, about 392 km: enough to see that latitude and longitude are not being confused.
	it('tient sur une longue distance', () => {
		const paris = { lat: 48.8566, lng: 2.3522 };
		const lyon = { lat: 45.764, lng: 4.8357 };

		expect(distanceMeters(paris, lyon) / 1000).toBeCloseTo(392, -1);
	});
});

describe('cardForShop', () => {
	it('préfère la carte rattachée au magasin précis', () => {
		const cartes = [carte(), carte({ cardId: 'card-2', shopId: 'shop-1', name: 'Meximieux' })];

		expect(cardForShop(magasin(), cartes)?.cardId).toBe('card-2');
	});

	it('retombe sur la carte de l’enseigne, à la casse près', () => {
		const cartes = [carte({ brand: 'CARREFOUR' })];

		expect(cardForShop(magasin(), cartes)?.cardId).toBe('card-1');
	});

	it('ne rend rien quand aucune carte ne correspond', () => {
		expect(cardForShop(magasin(), [carte({ brand: 'Intermarché' })])).toBeNull();
	});

	// An independent shop has no brand: with no direct attachment, there is nothing to return.
	it('ne rattrape pas un magasin sans enseigne par une carte sans enseigne', () => {
		const boucherie = magasin({ brand: '', name: 'Boucherie Émile' });

		expect(cardForShop(boucherie, [carte({ brand: '' })])).toBeNull();
	});
});

describe('nearbyDay', () => {
	it('écrit le jour local en ISO', () => {
		expect(nearbyDay(new Date(2026, 1, 4, 23, 30))).toBe('2026-02-04');
	});
});

describe('nearbyId', () => {
	it('est stable et positif', () => {
		expect(nearbyId('shop-1')).toBe(nearbyId('shop-1'));
		expect(nearbyId('shop-1')).toBeGreaterThanOrEqual(NEARBY_ID_OFFSET);
	});

	it('sépare deux magasins', () => {
		expect(nearbyId('shop-1')).not.toBe(nearbyId('shop-2'));
	});
});

describe('nearbyAlert', () => {
	const maintenant = new Date(2026, 1, 4, 10, 0);

	it('annonce un magasin dans le rayon quand une carte existe', () => {
		const alerte = nearbyAlert(aMetres(100), [magasin()], [carte()], {}, maintenant);

		expect(alerte?.shopId).toBe('shop-1');
		expect(alerte?.cardId).toBe('card-1');
	});

	it('ne dit rien au-delà du rayon', () => {
		const alerte = nearbyAlert(
			aMetres(NEARBY_RADIUS_M + 50),
			[magasin()],
			[carte()],
			{},
			maintenant
		);

		expect(alerte).toBeNull();
	});

	it('ne dit rien quand aucune carte n’est enregistrée', () => {
		expect(nearbyAlert(aMetres(50), [magasin()], [], {}, maintenant)).toBeNull();
	});

	it('ignore un magasin sans position relevée', () => {
		const sansPoint = magasin({ lat: undefined, lng: undefined });

		expect(nearbyAlert(MEXIMIEUX, [sansPoint], [carte()], {}, maintenant)).toBeNull();
	});

	it('garde le plus proche quand plusieurs magasins se chevauchent', () => {
		const voisin = magasin({
			shopId: 'shop-2',
			name: 'Lidl Meximieux',
			brand: 'Lidl',
			...aMetres(250)
		});
		const cartes = [carte(), carte({ cardId: 'card-2', brand: 'Lidl', name: 'Lidl' })];

		const alerte = nearbyAlert(aMetres(20), [voisin, magasin()], cartes, {}, maintenant);

		expect(alerte?.shopId).toBe('shop-1');
	});

	it('ne répète pas le même magasin le même jour', () => {
		const journal = { 'shop-1': '2026-02-04' };

		expect(nearbyAlert(aMetres(20), [magasin()], [carte()], journal, maintenant)).toBeNull();
	});

	it('repose la question le lendemain', () => {
		const journal = { 'shop-1': '2026-02-03' };

		expect(nearbyAlert(aMetres(20), [magasin()], [carte()], journal, maintenant)?.shopId).toBe(
			'shop-1'
		);
	});

	// The shop already announced does not hide its neighbour: the retail park stays usable.
	it('passe au suivant quand le plus proche a déjà été annoncé', () => {
		const voisin = magasin({ shopId: 'shop-2', name: 'Lidl', brand: 'Lidl', ...aMetres(200) });
		const cartes = [carte(), carte({ cardId: 'card-2', brand: 'Lidl', name: 'Lidl' })];
		const journal = { 'shop-1': '2026-02-04' };

		const alerte = nearbyAlert(aMetres(20), [magasin(), voisin], cartes, journal, maintenant);

		expect(alerte?.shopId).toBe('shop-2');
	});
});

describe('rememberNotified', () => {
	const maintenant = new Date(2026, 1, 4, 10, 0);

	it('inscrit le magasin annoncé', () => {
		expect(rememberNotified({}, 'shop-1', maintenant)).toEqual({ 'shop-1': '2026-02-04' });
	});

	it('oublie les jours passés', () => {
		const journal = { 'shop-2': '2026-01-30', 'shop-3': '2026-02-04' };

		expect(rememberNotified(journal, 'shop-1', maintenant)).toEqual({
			'shop-1': '2026-02-04',
			'shop-3': '2026-02-04'
		});
	});
});
