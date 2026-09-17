import { describe, expect, it } from 'vitest';
import {
	SETTING_FIELDS,
	type SettingRow,
	fieldsOf,
	initialValue,
	isMailConfigured,
	isMailTestSuccess,
	mailTestKey
} from './instance-settings';

const row = (key: string, overrides: Partial<SettingRow> = {}): SettingRow => ({
	key,
	value: null,
	is_secret: false,
	is_set: false,
	updated_at: null,
	...overrides
});

describe('SETTING_FIELDS', () => {
	it('sépare le courriel du suivi de dépôt', () => {
		expect(fieldsOf('mail').map((field) => field.key)).toContain('mail_smtp_host');
		expect(fieldsOf('tracker').map((field) => field.key)).toContain('issue_tracker_token');
	});

	it('ne marque secrets que le mot de passe et le jeton', () => {
		const secrets = SETTING_FIELDS.filter((field) => field.isSecret).map((field) => field.key);

		expect(secrets).toEqual(['mail_smtp_password', 'issue_tracker_token']);
	});
});

describe('initialValue', () => {
	it('rend la valeur en clair telle quelle', () => {
		expect(initialValue(row('mail_smtp_host', { value: 'relais.example', is_set: true }))).toBe(
			'relais.example'
		);
	});

	// Le point de l'issue : l'écran écrit le secret, il ne le relit jamais — pas même sous forme de
	// points dont la longueur trahirait celle du mot de passe.
	it('rend un champ vide pour un secret, même posé', () => {
		expect(
			initialValue(row('mail_smtp_password', { is_secret: true, is_set: true, value: null }))
		).toBe('');
	});

	it('rend un champ vide quand le réglage n’existe pas encore', () => {
		expect(initialValue(undefined)).toBe('');
	});
});

describe('isMailConfigured', () => {
	it('demande l’hôte et l’expéditeur', () => {
		const rows = [
			row('mail_smtp_host', { is_set: true, value: 'relais.example' }),
			row('mail_from', { is_set: true, value: 'a@b.test' })
		];

		expect(isMailConfigured(rows)).toBe(true);
	});

	it('refuse une configuration à moitié posée', () => {
		expect(isMailConfigured([row('mail_smtp_host', { is_set: true })])).toBe(false);
		expect(isMailConfigured([])).toBe(false);
	});
});

describe('mailTestKey', () => {
	it('traduit chaque cause par sa clé', () => {
		expect(mailTestKey('sender_rejected')).toBe('instance.mailTest.sender_rejected');
		expect(mailTestKey('auth_refused')).toBe('instance.mailTest.auth_refused');
		expect(mailTestKey('unreachable')).toBe('instance.mailTest.unreachable');
		expect(mailTestKey('quota')).toBe('instance.mailTest.quota');
	});

	it('retombe sur l’échec générique pour une issue inconnue', () => {
		expect(mailTestKey('bidule')).toBe('instance.mailTest.failed');
		expect(mailTestKey(null)).toBe('instance.mailTest.failed');
	});
});

describe('isMailTestSuccess', () => {
	it('ne dit oui qu’à un envoi parti', () => {
		expect(isMailTestSuccess('sent')).toBe(true);
		expect(isMailTestSuccess('quota')).toBe(false);
	});
});
