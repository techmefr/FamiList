import { describe, expect, it } from 'vitest';
import {
	canExplain,
	canOfferManualInstall,
	installRoute,
	isIosSafari,
	isRefusalExpired,
	MIN_OPENINGS,
	REFUSAL_MS,
	shouldOffer,
	type InstallContext
} from './install';

const SAFARI_IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const CHROME_IOS =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0 Mobile/15E148 Safari/604.1';
const SAFARI_IPADOS =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const CHROME_ANDROID =
	'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Mobile Safari/537.36';

const base: InstallContext = {
	isNative: false,
	isInstalled: false,
	route: 'prompt',
	openings: MIN_OPENINGS,
	refusedAt: null,
	now: 1_700_000_000_000
};

describe('isIosSafari', () => {
	it('reconnaît Safari sur iPhone', () => {
		expect(isIosSafari(SAFARI_IPHONE, 5)).toBe(true);
	});

	it("reconnaît un iPad qui se fait passer pour un Mac, grâce à l'écran tactile", () => {
		expect(isIosSafari(SAFARI_IPADOS, 5)).toBe(true);
	});

	it('ne prend pas un vrai Mac pour un iPad', () => {
		expect(isIosSafari(SAFARI_IPADOS, 0)).toBe(false);
	});

	it('écarte les navigateurs tiers sur iOS, dont le menu de partage ne propose pas le geste', () => {
		expect(isIosSafari(CHROME_IOS, 5)).toBe(false);
	});

	it('écarte Android', () => {
		expect(isIosSafari(CHROME_ANDROID, 5)).toBe(false);
	});
});

describe('installRoute', () => {
	it("passe par l'invite système dès que l'événement a été capturé", () => {
		expect(installRoute(true, false)).toBe('prompt');
	});

	it("explique le geste sur iOS, faute d'invite", () => {
		expect(installRoute(false, true)).toBe('ios');
	});

	it("garde l'invite si elle existe, même sur iOS", () => {
		expect(installRoute(true, true)).toBe('prompt');
	});

	it('ne propose rien quand aucun chemin ne mène à une installation', () => {
		expect(installRoute(false, false)).toBe('none');
	});
});

describe('isRefusalExpired', () => {
	it("tient pour expiré ce qui n'a jamais été refusé", () => {
		expect(isRefusalExpired(null, base.now)).toBe(true);
	});

	it('retient un refus récent', () => {
		expect(isRefusalExpired(base.now - 1000, base.now)).toBe(false);
	});

	it('retient un refus la veille de son terme', () => {
		expect(isRefusalExpired(base.now - REFUSAL_MS + 1, base.now)).toBe(false);
	});

	it('rouvre la question au terme exact', () => {
		expect(isRefusalExpired(base.now - REFUSAL_MS, base.now)).toBe(true);
	});

	it("traite une date future comme un refus tout frais plutôt que comme un refus périmé", () => {
		expect(isRefusalExpired(base.now + REFUSAL_MS, base.now)).toBe(false);
	});
});

describe('shouldOffer', () => {
	it("propose à quelqu'un qui est revenu", () => {
		expect(shouldOffer(base)).toBe(true);
	});

	it('se tait dans la coquille Capacitor, où tout est déjà installé', () => {
		expect(shouldOffer({ ...base, isNative: true })).toBe(false);
	});

	it("se tait quand l'application tourne déjà depuis l'écran d'accueil", () => {
		expect(shouldOffer({ ...base, isInstalled: true })).toBe(false);
	});

	it("se tait tant qu'aucun chemin d'installation n'existe", () => {
		expect(shouldOffer({ ...base, route: 'none' })).toBe(false);
	});

	it('attend une ouverture de plus à la première visite', () => {
		expect(shouldOffer({ ...base, openings: 1 })).toBe(false);
		expect(shouldOffer({ ...base, openings: MIN_OPENINGS - 1 })).toBe(false);
	});

	it('ne revient pas sur un refus des six derniers mois', () => {
		expect(shouldOffer({ ...base, refusedAt: base.now - REFUSAL_MS / 2 })).toBe(false);
	});

	it('repose la question une fois le refus périmé', () => {
		expect(shouldOffer({ ...base, refusedAt: base.now - REFUSAL_MS })).toBe(true);
	});

	it('explique aussi sur iOS, où il n y a rien à déclencher', () => {
		expect(shouldOffer({ ...base, route: 'ios' })).toBe(true);
	});
});

describe('canExplain', () => {
	it("reste disponible dans le menu d'aide après un refus", () => {
		expect(canExplain({ isNative: false, isInstalled: false, route: 'prompt' })).toBe(true);
	});

	it("disparaît là où l'application est déjà installée", () => {
		expect(canExplain({ isNative: true, isInstalled: false, route: 'prompt' })).toBe(false);
		expect(canExplain({ isNative: false, isInstalled: true, route: 'prompt' })).toBe(false);
	});

	it('disparaît quand aucun chemin ne mène à une installation', () => {
		expect(canExplain({ isNative: false, isInstalled: false, route: 'none' })).toBe(false);
	});
});

describe('canOfferManualInstall', () => {
	it("reste offert même sans invite capturée, tant que rien n'est installé", () => {
		expect(canOfferManualInstall({ isNative: false, isInstalled: false })).toBe(true);
	});

	it('disparaît dans la coquille Capacitor', () => {
		expect(canOfferManualInstall({ isNative: true, isInstalled: false })).toBe(false);
	});

	it("disparaît une fois l'application installée", () => {
		expect(canOfferManualInstall({ isNative: false, isInstalled: true })).toBe(false);
	});
});
