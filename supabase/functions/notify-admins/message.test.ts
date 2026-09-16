import { describe, expect, it } from 'vitest';
import { type AdminNotification, buildAdminMail } from './message.ts';

const ADMIN_URL = 'https://familiste.app/admin';

const signup = (overrides: Record<string, unknown> = {}): AdminNotification => ({
	id: 'a1',
	kind: 'signup',
	createdAt: '2026-09-14T10:00:00Z',
	payload: { display_name: 'Camille', email: 'camille@example.test', ...overrides }
});

const report = (overrides: Record<string, unknown> = {}): AdminNotification => ({
	id: 'b1',
	kind: 'bug_report',
	createdAt: '2026-09-14T11:30:00Z',
	payload: {
		report_kind: 'bug',
		email: 'camille@example.test',
		excerpt: 'La liste ne se rafraichit pas',
		path: '/l/courses',
		has_screenshot: false,
		...overrides
	}
});

describe('buildAdminMail', () => {
	it('annonce les deux sortes dans un seul objet', () => {
		const mail = buildAdminMail([signup(), report()], ADMIN_URL);

		expect(mail.subject).toBe('Familiste — 1 inscription, 1 signalement');
	});

	it('accorde le pluriel sur chaque sorte', () => {
		const mail = buildAdminMail(
			[signup(), { ...signup(), id: 'a2' }, report(), { ...report(), id: 'b2' }],
			ADMIN_URL
		);

		expect(mail.subject).toBe('Familiste — 2 inscriptions, 2 signalements');
	});

	it('omet la section absente', () => {
		const mail = buildAdminMail([report()], ADMIN_URL);

		expect(mail.subject).toBe('Familiste — 1 signalement');
		expect(mail.text).not.toContain('Inscription');
	});

	it('reprend nom, adresse et date de l inscription', () => {
		const mail = buildAdminMail([signup()], ADMIN_URL);

		expect(mail.text).toContain('Camille (camille@example.test) — 2026-09-14 10:00 UTC');
		expect(mail.text).toContain(ADMIN_URL);
	});

	it('remplace les champs vides par un libelle plutot que par du vide', () => {
		const mail = buildAdminMail([signup({ display_name: '  ', email: null })], ADMIN_URL);

		expect(mail.text).toContain('Sans nom (adresse inconnue)');
	});

	it('distingue une suggestion d un bug', () => {
		const mail = buildAdminMail([report({ report_kind: 'suggestion' })], ADMIN_URL);

		expect(mail.text).toContain('Suggestion de camille@example.test');
	});

	it('mentionne la page et la capture quand elles existent', () => {
		const mail = buildAdminMail([report({ has_screenshot: true })], ADMIN_URL);

		expect(mail.text).toContain('Page : /l/courses');
		expect(mail.text).toContain('Capture jointe.');
	});

	it('tait la page et la capture quand elles manquent', () => {
		const mail = buildAdminMail([report({ path: null })], ADMIN_URL);

		expect(mail.text).not.toContain('Page :');
		expect(mail.text).not.toContain('Capture jointe.');
	});

	it('laisse passer une date illisible telle quelle plutot que « Invalid Date »', () => {
		const mail = buildAdminMail([{ ...signup(), createdAt: 'jamais' }], ADMIN_URL);

		expect(mail.text).toContain('jamais');
	});

	it('signale une description manquante', () => {
		const mail = buildAdminMail([report({ excerpt: '' })], ADMIN_URL);

		expect(mail.text).toContain('(sans description)');
	});
});
