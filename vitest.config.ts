import { defineConfig } from "vitest/config";

export default defineConfig({
	// Les mêmes alias que vite.config.ts : un fichier hors domain/ (sync/mapping.ts, par exemple)
	// importe par ces chemins, et les tests doivent résoudre exactement ce que résout l'application.
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
		// Tout src/lib : un test rangé ailleurs que dans domain/ ne doit pas être ignoré en silence.
		include: ["src/lib/**/*.test.ts"],
		environment: "node",
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			// Le périmètre couvert ici est la logique pure : domain/ et sync/mapping.ts, rien qui
			// touche le DOM, Supabase ou Dexie. Ce n'est pas une esquive du seuil de 80 % — c'est
			// l'inverse : un store Svelte ou le moteur de synchronisation ne se testent
			// significativement qu'avec un navigateur ou une vraie base derrière, ce que ces tests
			// unitaires n'ont pas. Les mocker pour gonfler un pourcentage produirait des tests qui
			// vérifient les mocks, pas le code. Cette couche-là est couverte par les E2E Playwright
			// (voir e2e/), qui exercent les stores et le moteur de synchronisation à travers de
			// vrais écrans et une vraie pile Supabase locale.
			include: ["src/lib/domain/**/*.ts", "src/lib/sync/mapping.ts", "src/lib/sync/errors.ts"],
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
