import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Crash } from '$domain/crash';
import { forwardToSentry } from './sentry';

const CRASH: Crash = {
	fingerprint: 'deadbeef',
	source: 'window',
	message: 'TypeError: oops',
	stack: 'at foo (app.js:1:1)',
	path: '/l/{id}'
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('forwardToSentry', () => {
	it('ne fait aucun appel reseau sur un DSN mal forme', () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);

		forwardToSentry('not-a-dsn', CRASH);

		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('ne fait aucun appel reseau quand la cle ou le projet manque', () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);

		forwardToSentry('https://host.example/', CRASH);

		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('poste une enveloppe vers le point d ingestion du DSN', () => {
		const fetchSpy = vi.fn().mockResolvedValue(new Response());
		vi.stubGlobal('fetch', fetchSpy);

		forwardToSentry('https://public-key@sentry.example/42', CRASH);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe(
			'https://sentry.example/api/42/envelope/?sentry_key=public-key&sentry_version=7'
		);
		expect(init.method).toBe('POST');
		expect(init.headers['content-type']).toBe('application/x-sentry-envelope');

		const lines = String(init.body).split('\n');
		expect(lines).toHaveLength(3);
		expect(JSON.parse(lines[2])).toMatchObject({
			message: CRASH.message,
			tags: { source: CRASH.source, fingerprint: CRASH.fingerprint },
			extra: { stack: CRASH.stack },
			request: { url: CRASH.path }
		});
	});

	it('ne leve jamais, meme quand fetch echoue', () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockRejectedValue(new Error('network down'))
		);

		expect(() => forwardToSentry('https://public-key@sentry.example/42', CRASH)).not.toThrow();
	});
});
