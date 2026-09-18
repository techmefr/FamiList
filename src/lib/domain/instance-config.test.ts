import { describe, expect, it } from 'vitest';
import { readInstanceConfig } from './instance-config';

const VALID = { url: 'https://abc.supabase.co', anonKey: 'ey.key' };

describe('readInstanceConfig', () => {
	it('lit une configuration complete', () => {
		expect(readInstanceConfig(VALID)).toEqual(VALID);
	});

	it('coupe les espaces autour des valeurs collees a la main', () => {
		expect(readInstanceConfig({ url: '  https://abc.supabase.co ', anonKey: ' ey.key ' })).toEqual(
			VALID
		);
	});

	it('rend null quand il manque une des deux valeurs', () => {
		expect(readInstanceConfig({ url: VALID.url })).toBeNull();
		expect(readInstanceConfig({ anonKey: VALID.anonKey })).toBeNull();
		expect(readInstanceConfig({ url: '', anonKey: '' })).toBeNull();
	});

	it('rend null sur un conteneur demarre sans ses variables', () => {
		expect(readInstanceConfig(undefined)).toBeNull();
		expect(readInstanceConfig(null)).toBeNull();
		expect(readInstanceConfig('https://abc.supabase.co')).toBeNull();
	});

	it('traite un exemple laisse tel quel comme absent', () => {
		expect(readInstanceConfig({ url: 'your-supabase-url', anonKey: 'your-anon-key' })).toBeNull();
		expect(readInstanceConfig({ url: VALID.url, anonKey: 'CHANGEME' })).toBeNull();
	});

	it('refuse une adresse que le navigateur ne saurait pas appeler', () => {
		expect(readInstanceConfig({ url: '/supabase', anonKey: 'ey.key' })).toBeNull();
		expect(readInstanceConfig({ url: 'PUBLIC_SUPABASE_URL', anonKey: 'ey.key' })).toBeNull();
		expect(readInstanceConfig({ url: 'postgres://db:5432', anonKey: 'ey.key' })).toBeNull();
	});
});
