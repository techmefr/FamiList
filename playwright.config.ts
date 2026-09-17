import { defineConfig, devices } from '@playwright/test';

/**
 * The E2E tests run against the local Supabase stack, never against the online project: we write accounts,
 * lists and cards, and none of that has any place in a household's real data. `supabase/seed.sql` sets a
 * fixed account there (`e2e@familist.test`), confirmed and approved from `supabase db reset` onwards — no
 * sign-up to replay, no email to wait for.
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
	// A single worker in CI: the tests share the same fixed account and the same database, and a second
	// worker would sometimes see the other's writes in the middle of an assertion.
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		// Repository convention: `data-test-id`, not Playwright's default `data-testid`.
		testIdAttribute: 'data-test-id'
	},
	/**
	 * Two projects that do not play the same files, rather than the same suite twice.
	 *
	 * The application really changes shape under 48rem — bottom bar instead of the column, different tabs,
	 * floating create button on the thumb's side, swiping with the finger — and none of that was exercised.
	 * But replaying the lists, the shops or the 2FA in a phone viewport as well would double the integration
	 * time to recheck journeys that do not depend on the screen. `e2e/mobile.spec.ts` therefore carries what
	 * does depend on it, and it alone runs on the emulated phone.
	 */
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
			testIgnore: /mobile\.spec\.ts/
		},
		{
			name: 'mobile',
			use: { ...devices['Pixel 7'] },
			testMatch: /mobile\.spec\.ts/
		}
	],
	webServer: {
		// `--host 127.0.0.1` explicitly: on a CI runner, `localhost` sometimes resolves only to ::1, the port is
		// then seen as listening but the connection on 127.0.0.1 is refused.
		command: 'pnpm exec vite dev --host 127.0.0.1 --port 4173 --strictPort',
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
		env: {
			PUBLIC_SUPABASE_URL: SUPABASE_URL,
			PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY
		}
	}
});
