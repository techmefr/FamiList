import { describe, expect, it } from 'vitest';
import { diagnoseMailFailure, isMailConfigured } from './mail-diagnosis.ts';

describe('diagnoseMailFailure', () => {
	it('reconnait un mot de passe refuse', () => {
		expect(diagnoseMailFailure('535 5.7.8 Authentication credentials invalid')).toBe(
			'auth_refused'
		);
		expect(diagnoseMailFailure('Error: Invalid login: 534 5.7.9')).toBe('auth_refused');
	});

	it('reconnait un serveur injoignable', () => {
		expect(diagnoseMailFailure('ConnectionRefused: connection refused')).toBe('unreachable');
		expect(diagnoseMailFailure('error sending request: dns error: failed to lookup')).toBe(
			'unreachable'
		);
		expect(diagnoseMailFailure('Operation timed out')).toBe('unreachable');
	});

	it('reconnait un expediteur non verifie', () => {
		expect(diagnoseMailFailure('550 The from address does not match a verified Sender')).toBe(
			'sender_rejected'
		);
		expect(diagnoseMailFailure('553 Sender address is unverified')).toBe('sender_rejected');
	});

	// The trap that dictated the order of the tests: the message speaks of a sender and of authentication, and
	// only the first is the cause.
	it('prefere l expediteur quand le message parle des deux', () => {
		expect(
			diagnoseMailFailure('550 sender not verified — see our authentication documentation')
		).toBe('sender_rejected');
	});

	it('rend un echec generique quand rien ne se reconnait', () => {
		expect(diagnoseMailFailure('quelque chose a mal tourne')).toBe('failed');
	});
});

describe('isMailConfigured', () => {
	it('demande un hote et un expediteur, pas davantage', () => {
		expect(isMailConfigured({ mail_smtp_host: 'relais.example', mail_from: 'a@b.test' })).toBe(
			true
		);
	});

	it('refuse une configuration a moitie posee', () => {
		expect(isMailConfigured({ mail_smtp_host: 'relais.example' })).toBe(false);
		expect(isMailConfigured({ mail_smtp_host: ' ', mail_from: 'a@b.test' })).toBe(false);
		expect(isMailConfigured({})).toBe(false);
	});
});
