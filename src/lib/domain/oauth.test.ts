import { describe, expect, it } from 'vitest';
import { ENABLED_PROVIDERS, OAUTH_PROVIDERS, enabledProviders, type ProviderId } from './oauth';

describe('enabledProviders', () => {
	it('ne rend rien quand aucun fournisseur n est configure', () => {
		expect(enabledProviders([])).toEqual([]);
	});

	it('garde l ordre du catalogue, pas celui de la liste activee', () => {
		expect(enabledProviders(['azure', 'google']).map((provider) => provider.id)).toEqual([
			'google',
			'azure'
		]);
	});

	it('ignore un identifiant qui n est pas au catalogue', () => {
		expect(enabledProviders(['inconnu' as ProviderId])).toEqual([]);
	});

	it('n active que des fournisseurs presents au catalogue', () => {
		const connus = OAUTH_PROVIDERS.map((provider) => provider.id);
		expect(ENABLED_PROVIDERS.every((id) => connus.includes(id))).toBe(true);
	});
});
