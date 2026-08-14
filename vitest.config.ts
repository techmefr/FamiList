import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Tout src/lib : un test rangé ailleurs que dans domain/ ne doit pas être ignoré en silence.
		include: ["src/lib/**/*.test.ts"],
		environment: "node"
	}
});
