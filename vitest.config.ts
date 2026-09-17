import { defineConfig } from "vitest/config";

export default defineConfig({
	// The same aliases as vite.config.ts: a file outside domain/ (sync/mapping.ts, for instance) imports
	// through these paths, and the tests must resolve exactly what the application resolves.
	resolve: {
		alias: {
			$components: new URL("./src/lib/components", import.meta.url).pathname,
			$domain: new URL("./src/lib/domain", import.meta.url).pathname,
			$stores: new URL("./src/lib/stores", import.meta.url).pathname,
			$db: new URL("./src/lib/db", import.meta.url).pathname,
			$native: new URL("./src/lib/native", import.meta.url).pathname,
			$lib: new URL("./src/lib", import.meta.url).pathname
		}
	},
	test: {
		// All of src/lib: a test filed somewhere other than domain/ must not be ignored in silence. And the Edge
		// Functions, whose pure logic — writing an email, for instance — is tested exactly like domain/'s. Their
		// code cannot live in src/lib: the CLI only copies `supabase/functions` into the Deno container, and an
		// import outside that folder would not resolve on deployment.
		include: ["src/lib/**/*.test.ts", "supabase/functions/**/*.test.ts"],
		environment: "node",
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			// The scope covered here is the pure logic: domain/ and sync/mapping.ts, nothing touching the DOM,
			// Supabase or Dexie. This is not a dodge around the 80% threshold — it is the opposite: a Svelte store
			// or the sync engine are only meaningfully tested with a browser or a real database behind them, which
			// these unit tests do not have. Mocking them to inflate a percentage would produce tests that check the
			// mocks, not the code. That layer is covered by the Playwright E2E tests (see e2e/), which exercise the
			// stores and the sync engine through real screens and a real local Supabase stack.
			include: [
				"src/lib/domain/**/*.ts",
				"src/lib/sync/mapping.ts",
				"src/lib/sync/errors.ts",
				"src/lib/sync/realtime.ts"
			],
			exclude: ["**/*.test.ts", "**/*.d.ts"],
			thresholds: {
				statements: 80,
				branches: 80,
				functions: 80,
				lines: 80
			}
		}
	}
});
