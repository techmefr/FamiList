import { describe, expect, it } from 'vitest';
import { buildTestMail } from './message.ts';

describe('buildTestMail', () => {
	it('nomme le destinataire dans le corps', () => {
		const mail = buildTestMail('camille@example.test');

		expect(mail.subject).toBe('Familiste — courriel de test');
		expect(mail.text).toContain('camille@example.test');
	});

	// Ce qu il prouve compte autant que le fait d arriver : lu trois jours plus tard dans un dossier
	// indesirables, le message doit expliquer pourquoi il est la.
	it('dit ce que sa reception demontre', () => {
		const mail = buildTestMail('camille@example.test');

		expect(mail.text).toContain('identifiants');
		expect(mail.text).toContain('expedition');
		expect(mail.text).toContain('indesirables');
	});
});
