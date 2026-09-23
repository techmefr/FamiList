import { describe, expect, it } from 'vitest';
import { readInstanceConfig, readLocalInstanceConfig, resolveInstanceConfig } from './instance-config';

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

	it('garde le DSN Sentry quand il est renseigne', () => {
		expect(readInstanceConfig({ ...VALID, sentryDsn: 'https://key@sentry.example/1' })).toEqual({
			...VALID,
			sentryDsn: 'https://key@sentry.example/1'
		});
	});

	it('omet le DSN Sentry quand il est absent ou vide', () => {
		expect(readInstanceConfig(VALID)).toEqual(VALID);
		expect(readInstanceConfig({ ...VALID, sentryDsn: '' })).toEqual(VALID);
		expect(readInstanceConfig({ ...VALID, sentryDsn: '  ' })).toEqual(VALID);
	});
});

describe('readLocalInstanceConfig', () => {
	it('lit une configuration valide sans le DSN Sentry', () => {
		expect(readLocalInstanceConfig(VALID)).toEqual(VALID);
	});

	it('ignore un DSN Sentry glisse dans la source : le formulaire in-app ne le propose pas', () => {
		expect(readLocalInstanceConfig({ ...VALID, sentryDsn: 'https://key@sentry.example/1' })).toEqual(
			VALID
		);
	});

	it('rend null sur une valeur incomplete ou invalide, comme readInstanceConfig', () => {
		expect(readLocalInstanceConfig({ url: VALID.url })).toBeNull();
		expect(readLocalInstanceConfig({ url: '/supabase', anonKey: 'ey.key' })).toBeNull();
		expect(readLocalInstanceConfig(null)).toBeNull();
	});
});

describe('resolveInstanceConfig', () => {
	const BUILD = { url: 'https://build.supabase.co', anonKey: 'build-key', sentryDsn: 'https://dsn' };
	const LOCAL = { url: 'https://local.supabase.co', anonKey: 'local-key' };

	it("prend la configuration in-app quand elle est presente, et garde le DSN Sentry du build", () => {
		expect(resolveInstanceConfig(BUILD, LOCAL)).toEqual({ ...LOCAL, sentryDsn: BUILD.sentryDsn });
	});

	it("retombe sur la configuration du build quand rien n'est sauvegarde en local", () => {
		expect(resolveInstanceConfig(BUILD, null)).toEqual(BUILD);
		expect(resolveInstanceConfig(BUILD, {})).toEqual(BUILD);
	});

	it('ignore une valeur locale invalide plutot que de casser une instance deja configuree', () => {
		expect(resolveInstanceConfig(BUILD, { url: 'not a url', anonKey: 'x' })).toEqual(BUILD);
	});

	it('rend null quand ni le build ni le local ne disent rien : conteneur demarre sans variables', () => {
		expect(resolveInstanceConfig(null, null)).toBeNull();
	});

	it("omet le DSN Sentry quand le build n'en a pas, meme avec une config locale", () => {
		const buildWithoutDsn = { url: BUILD.url, anonKey: BUILD.anonKey };
		expect(resolveInstanceConfig(buildWithoutDsn, LOCAL)).toEqual(LOCAL);
	});
});
