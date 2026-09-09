import { describe, expect, it } from 'vitest';
import { deviceLabel, deviceText } from './device';

const CHROME_WINDOWS =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const CHROME_ANDROID =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const EDGE_WINDOWS =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0';
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0';
const SAFARI_MAC =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

describe('deviceLabel', () => {
	it('lit Chrome sur Windows', () => {
		expect(deviceLabel(CHROME_WINDOWS)).toEqual({ browser: 'Chrome', platform: 'Windows' });
	});

	it("lit Safari sur iPhone plutôt que le Mac dont l'iPhone se réclame", () => {
		expect(deviceLabel(SAFARI_IPHONE)).toEqual({ browser: 'Safari', platform: 'iPhone' });
	});

	it('lit Android plutôt que le Linux qui le porte', () => {
		expect(deviceLabel(CHROME_ANDROID)).toEqual({ browser: 'Chrome', platform: 'Android' });
	});

	it('ne prend pas Edge pour Chrome, dont il se réclame', () => {
		expect(deviceLabel(EDGE_WINDOWS).browser).toBe('Edge');
	});

	it('lit Firefox sur Linux', () => {
		expect(deviceLabel(FIREFOX_LINUX)).toEqual({ browser: 'Firefox', platform: 'Linux' });
	});

	it('lit Safari sur Mac', () => {
		expect(deviceLabel(SAFARI_MAC)).toEqual({ browser: 'Safari', platform: 'Mac' });
	});

	it("reconnaît l'application installée", () => {
		expect(deviceLabel('FamiList/1.0 (Android 14)')).toEqual({
			browser: 'FamiList',
			platform: 'Android'
		});
	});

	it("n'invente rien quand il ne sait pas", () => {
		expect(deviceLabel('')).toEqual({ browser: '', platform: '' });
		expect(deviceLabel(null)).toEqual({ browser: '', platform: '' });
		expect(deviceLabel(undefined)).toEqual({ browser: '', platform: '' });
		expect(deviceLabel('curl/8.5.0')).toEqual({ browser: '', platform: '' });
	});
});

describe('deviceText', () => {
	it('assemble les deux morceaux', () => {
		expect(deviceText({ browser: 'Chrome', platform: 'Windows' }, 'sur', '?')).toBe(
			'Chrome sur Windows'
		);
	});

	it("n'écrit pas le mot de liaison quand il manque une moitié", () => {
		expect(deviceText({ browser: 'Chrome', platform: '' }, 'sur', '?')).toBe('Chrome');
		expect(deviceText({ browser: '', platform: 'Windows' }, 'sur', '?')).toBe('Windows');
	});

	it("le dit quand il n'a rien", () => {
		expect(deviceText({ browser: '', platform: '' }, 'sur', 'Appareil inconnu')).toBe(
			'Appareil inconnu'
		);
	});
});
