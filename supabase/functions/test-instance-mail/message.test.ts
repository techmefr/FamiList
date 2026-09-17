import { describe, expect, it } from 'vitest';
import { buildTestMail } from './message.ts';

describe('buildTestMail', () => {
	it('nomme le destinataire dans le corps', () => {
		const mail = buildTestMail('camille@example.test');

		expect(mail.subject).toBe('Familiste — courriel de test');
		expect(mail.text).toContain('camille@example.test');
	});

	// What it proves counts as much as the fact of arriving: read three days later in a junk folder, the
	// message must explain why it is there.
	it('dit ce que sa reception demontre', () => {
		const mail = buildTestMail('camille@example.test');

		expect(mail.text).toContain('identifiants');
		expect(mail.text).toContain('expedition');
		expect(mail.text).toContain('indesirables');
	});
});
