import { defineConfig, devices } from '@playwright/test';

/**
 * Les E2E tournent contre la pile Supabase locale, jamais contre le projet en ligne : on écrit des
 * comptes, des listes, des cartes, et rien de cela n'a sa place dans les données réelles d'un
 * foyer. `supabase/seed.sql` y pose un compte fixe (`e2e@familist.test`), confirmé et approuvé dès
 * `supabase db reset` — pas d'inscription à rejouer, pas de courriel à attendre.
 */
const PORT = 4173;
const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY =
	process.env.E2E_SUPABASE_ANON_KEY ??
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	// Un seul worker en CI : les tests partagent le même compte fixe et la même base, un deuxième
	// worker verrait parfois les écritures de l'autre au milieu d'une assertion.
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		// Convention du dépôt : `data-test-id`, pas le `data-testid` par défaut de Playwright.
		testIdAttribute: 'data-test-id'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'pnpm exec vite dev --port 4173 --strictPort',
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
		env: {
			PUBLIC_SUPABASE_URL: SUPABASE_URL,
			PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY
		}
	}
});
