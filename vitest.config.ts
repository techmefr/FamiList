import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/lib/domain/**/*.test.ts"],
		environment: "node"
	}
});
