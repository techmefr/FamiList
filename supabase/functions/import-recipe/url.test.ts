import { describe, expect, it } from 'vitest';
import { checkUrl } from './url.ts';

const refusal = (raw: string): string => {
	const result = checkUrl(raw);
	return result.ok ? 'accepte' : result.reason;
};

describe('checkUrl', () => {
	it('accepte une adresse https publique', () => {
		const result = checkUrl('https://www.marmiton.org/recettes/recette_gratin_12345.aspx');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.url.hostname).toBe('www.marmiton.org');
	});

	it('accepte une adresse avec parametres et ancre', () => {
		expect(refusal('https://exemple.test/recette?id=4#ingredients')).toBe('accepte');
	});

	it('refuse ce qui n est pas une URL', () => {
		expect(refusal('pas une url')).toBe('invalid');
		expect(refusal('')).toBe('invalid');
	});

	it('refuse tout schema autre que https', () => {
		expect(refusal('http://exemple.test/recette')).toBe('scheme');
		expect(refusal('file:///etc/passwd')).toBe('scheme');
		expect(refusal('ftp://exemple.test/recette')).toBe('scheme');
		expect(refusal('gopher://exemple.test/')).toBe('scheme');
	});

	it('refuse des identifiants glisses dans l adresse', () => {
		expect(refusal('https://admin:secret@exemple.test/')).toBe('credentials');
	});

	it('refuse un port choisi', () => {
		expect(refusal('https://exemple.test:22/')).toBe('port');
		expect(refusal('https://exemple.test:8080/')).toBe('port');
	});

	it('refuse la machine elle-meme', () => {
		expect(refusal('https://localhost/')).toBe('private_host');
		expect(refusal('https://127.0.0.1/')).toBe('private_host');
		expect(refusal('https://127.13.37.1/')).toBe('private_host');
		expect(refusal('https://0.0.0.0/')).toBe('private_host');
		expect(refusal('https://[::1]/')).toBe('private_host');
	});

	it('refuse les reseaux prives', () => {
		expect(refusal('https://10.0.0.5/')).toBe('private_host');
		expect(refusal('https://192.168.1.1/')).toBe('private_host');
		expect(refusal('https://172.16.0.1/')).toBe('private_host');
		expect(refusal('https://172.31.255.254/')).toBe('private_host');
		expect(refusal('https://100.64.0.1/')).toBe('private_host');
		expect(refusal('https://[fd00::1]/')).toBe('private_host');
		expect(refusal('https://[fe80::1]/')).toBe('private_host');
		expect(refusal('https://[::ffff:10.0.0.1]/')).toBe('private_host');
	});

	it('refuse l adresse des metadonnees d infrastructure', () => {
		expect(refusal('https://169.254.169.254/latest/meta-data/')).toBe('private_host');
		expect(refusal('https://metadata.google.internal/')).toBe('private_host');
	});

	it('laisse passer les plages voisines qui sont bien publiques', () => {
		expect(refusal('https://172.32.0.1/')).toBe('accepte');
		expect(refusal('https://172.15.0.1/')).toBe('accepte');
		expect(refusal('https://100.128.0.1/')).toBe('accepte');
		expect(refusal('https://11.0.0.1/')).toBe('accepte');
	});

	it('refuse un nom sans point, qui ne resout qu a l interieur d un reseau', () => {
		expect(refusal('https://intranet/')).toBe('private_host');
		expect(refusal('https://routeur.local/')).toBe('private_host');
		expect(refusal('https://service.internal/')).toBe('private_host');
		expect(refusal('https://exemple.onion/')).toBe('private_host');
	});
});
