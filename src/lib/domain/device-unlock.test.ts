import { describe, expect, it } from 'vitest';
import {
	deviceFactorName,
	factorsOfType,
	pickDeviceFactor,
	revealNeedsDevice,
	type KnownFactor
} from './device-unlock';

const totp: KnownFactor = { id: 't1', type: 'totp', friendlyName: '', createdAt: '2026-09-01T10:00:00Z' };
const phone: KnownFactor = {
	id: 'w1',
	type: 'webauthn',
	friendlyName: 'Chrome sur Android · 2026-09-25 17:03',
	createdAt: '2026-09-25T17:03:00Z'
};
const laptop: KnownFactor = {
	id: 'w2',
	type: 'webauthn',
	friendlyName: 'Safari sur Mac · 2026-09-25 18:10',
	createdAt: '2026-09-25T18:10:00Z'
};

describe('device unlock', () => {
	it('nomme le facteur d’après l’appareil et la minute, pour rester unique', () => {
		const at = new Date('2026-09-25T17:03:42Z');
		expect(deviceFactorName({ browser: 'Chrome', platform: 'Android' }, 'sur', 'Appareil inconnu', at)).toBe(
			'Chrome sur Android · 2026-09-25 17:03'
		);
		expect(deviceFactorName({ browser: '', platform: '' }, 'sur', 'Appareil inconnu', at)).toBe(
			'Appareil inconnu · 2026-09-25 17:03'
		);
	});

	it('sépare les codes d’application des clés d’accès', () => {
		expect(factorsOfType([totp, phone, laptop], 'webauthn')).toEqual([phone, laptop]);
		expect(factorsOfType([totp, phone], 'totp')).toEqual([totp]);
	});

	it('préfère la clé enregistrée depuis cet appareil', () => {
		expect(pickDeviceFactor([totp, phone, laptop], 'w2')).toEqual(laptop);
	});

	it('prend la seule clé d’accès quand il n’y a rien à choisir', () => {
		expect(pickDeviceFactor([totp, phone], null)).toEqual(phone);
		expect(pickDeviceFactor([totp, phone], 'oubliée')).toEqual(phone);
	});

	it('ne devine pas entre plusieurs clés inconnues de cet appareil', () => {
		expect(pickDeviceFactor([phone, laptop], null)).toBeNull();
	});

	it('ne prend jamais un code d’application pour une clé d’accès', () => {
		expect(pickDeviceFactor([totp], 't1')).toBeNull();
	});

	it('ne demande le téléphone que si une clé de cet appareil est utilisable', () => {
		expect(revealNeedsDevice(phone, true)).toBe(true);
		expect(revealNeedsDevice(phone, false)).toBe(false);
		expect(revealNeedsDevice(null, true)).toBe(false);
	});
});
