import { describe, expect, it } from 'vitest';
import { buildCrash, fingerprint, normalizePath, scrub } from './crash';

describe('scrub', () => {
	it('retire une adresse de courriel', () => {
		expect(scrub('echec pour marie.dupont+courses@example.com')).toBe('echec pour {email}');
	});

	it('retire un identifiant de foyer', () => {
		expect(scrub('household 3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b absent')).toBe(
			'household {id} absent'
		);
	});

	it('retire une chaine de requete sans toucher a une question', () => {
		expect(scrub('GET /rest/v1/lists?household_id=abc a echoue')).toBe(
			'GET /rest/v1/lists?{query} a echoue'
		);
		expect(scrub('la liste existe-t-elle ?')).toBe('la liste existe-t-elle ?');
	});

	it('retire le nom du compte systeme dans un chemin absolu', () => {
		expect(scrub('at load (/home/marie/projet/src/app.js)')).toBe(
			'at load (/home/{user}/projet/src/app.js)'
		);
	});

	it('retire un jeton JWT et une URL de donnees', () => {
		expect(scrub('Bearer eyJhbGc.eyJzdWIi.sIgNaTuRe refuse')).toBe('Bearer {token} refuse');
		expect(scrub('src=data:image/png;base64,iVBORw0KGgoAAAA vide')).toBe('src={data} vide');
	});

	it('garde les numeros de ligne mais retire les longues suites de chiffres', () => {
		expect(scrub('at x (app.js:128:42) apres 1757412345678')).toBe(
			'at x (app.js:128:42) apres {n}'
		);
	});
});

describe('normalizePath', () => {
	it('remplace l identifiant de liste par un marqueur', () => {
		expect(normalizePath('/l/3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b')).toBe('/l/{id}');
		expect(normalizePath('/l/abc123/chat')).toBe('/l/{id}/chat');
	});

	it('laisse une route statique intacte', () => {
		expect(normalizePath('/profile/security')).toBe('/profile/security');
	});

	it('coupe la chaine de requete et le fragment', () => {
		expect(normalizePath('/report?kind=bug#bas')).toBe('/report');
	});
});

describe('fingerprint', () => {
	it('regroupe deux occurrences qui ne different que par un compteur', () => {
		const a = fingerprint('window', 'TypeError: item 12 introuvable', 'at f (app.js:1:2)');
		const b = fingerprint('window', 'TypeError: item 987 introuvable', 'at f (app.js:1:2)');

		expect(a).toBe(b);
	});

	it('regroupe deux builds dont seuls les numeros de ligne ont bouge', () => {
		const a = fingerprint('render', 'TypeError: x', 'at f (app.js:12:3)\nat g (app.js:40:1)');
		const b = fingerprint('render', 'TypeError: x', 'at f (app.js:98:7)\nat g (app.js:40:1)');

		expect(a).toBe(b);
	});

	it('separe deux sources et deux messages differents', () => {
		expect(fingerprint('window', 'boum', '')).not.toBe(fingerprint('sync', 'boum', ''));
		expect(fingerprint('window', 'boum', '')).not.toBe(fingerprint('window', 'patatras', ''));
	});

	it('rend toujours huit caracteres hexadecimaux', () => {
		expect(fingerprint('promise', 'a', '')).toMatch(/^[0-9a-f]{8}$/);
	});
});

describe('buildCrash', () => {
	it('lit le nom et le message d une Error', () => {
		const crash = buildCrash(new TypeError('x is not a function'), 'window', '/');

		expect(crash?.message).toBe('TypeError: x is not a function');
		expect(crash?.source).toBe('window');
		expect(crash?.path).toBe('/');
	});

	it('accepte ce qui est rejete sans etre une Error', () => {
		expect(buildCrash('AbortError', 'promise', '/chat')?.message).toBe('AbortError');
		expect(buildCrash({ message: 'transaction avortee' }, 'sync', '/')?.message).toBe(
			'transaction avortee'
		);
	});

	it('renonce quand il n y a rien a dire', () => {
		expect(buildCrash(undefined, 'window', '/')).toBeNull();
		expect(buildCrash({}, 'window', '/')).toBeNull();
	});

	it('nettoie le message et la pile avant de les rendre', () => {
		const cause = new Error('refus pour jean@example.com');
		cause.stack = 'Error: refus pour jean@example.com\n    at load (/Users/jean/app.js:3:1)';
		const crash = buildCrash(cause, 'sync', '/l/abc?household=1');

		expect(crash?.message).not.toContain('jean@example.com');
		expect(crash?.stack).not.toContain('/Users/jean');
		expect(crash?.path).toBe('/l/{id}');
	});

	it('coupe un message interminable', () => {
		const crash = buildCrash(new Error('echec de la liste '.repeat(200)), 'window', '/');

		expect(crash?.message.length).toBe(500);
	});

	// The long-token pattern also catches a run of letters with no space: that is intended, such a run is
	// almost always an identifier, a hash or a key copied into the text.
	it('remplace une longue suite sans espace par un marqueur de jeton', () => {
		expect(buildCrash(new Error('x'.repeat(2000)), 'window', '/')?.message).toBe(
			'Error: {token}'
		);
	});
});
