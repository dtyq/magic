import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

/** The application setup assumes window exists; the logger's import boundary must not. */
export default defineConfig({
	resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
	test: {
		environment: "node",
		include: [
			"src/infrastructure/logger/__tests__/*.test.ts",
			"src/app/services/__tests__/loggerService.test.ts",
		],
	},
})
