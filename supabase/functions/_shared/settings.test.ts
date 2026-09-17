import { describe, expect, it } from 'vitest';
import { pickSetting, resolveSettings } from './settings.ts';

describe('pickSetting', () => {
	it('prend la variable d environnement quand elle existe', () => {
		const value = pickSetting('mail_smtp_host', { ADMIN_MAIL_SMTP_HOST: 'relais.example' }, {
			mail_smtp_host: 'base.example'
		});

		expect(value).toBe('relais.example');
	});

	it('retombe sur la base quand la variable manque', () => {
		expect(pickSetting('mail_smtp_host', {}, { mail_smtp_host: 'base.example' })).toBe(
			'base.example'
		);
	});

	it('ignore une variable posee mais vide', () => {
		const value = pickSetting('mail_from', { ADMIN_MAIL_FROM: '   ' }, { mail_from: 'a@b.test' });

		expect(value).toBe('a@b.test');
	});

	it('ne rend rien quand ni l un ni l autre ne repond', () => {
		expect(pickSetting('mail_from', {}, {})).toBeUndefined();
	});
});

describe('resolveSettings', () => {
	it('melange les deux sources cle par cle', () => {
		const resolved = resolveSettings(
			['mail_smtp_host', 'mail_smtp_port', 'mail_from'],
			{ ADMIN_MAIL_SMTP_HOST: 'relais.example' },
			{ mail_smtp_port: '2525', mail_from: 'a@b.test' }
		);

		expect(resolved).toEqual({
			mail_smtp_host: 'relais.example',
			mail_smtp_port: '2525',
			mail_from: 'a@b.test'
		});
	});

	it('omet les cles absentes plutot que de les poser vides', () => {
		expect(resolveSettings(['mail_smtp_user'], {}, {})).toEqual({});
	});
});
