import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
	resolve: {
		alias: {
			"lodash-es": path.resolve(__dirname, "./tests/mocks/lodash-es.ts"),
			"esdk-obs-browserjs": path.resolve(__dirname, "./tests/mocks/ObsClientMock.ts"),
		},
	},
	test: {
		environment: "jsdom",
		include: ["**/?(*.)+(spec|test).[jt]s?(x)"],
		coverage: {
			enabled: true,
			provider: "v8",
			include: ["src/**/*.ts"],
			reportsDirectory: "./.coverage",
		},
		setupFiles: ["./tests/setup.ts"],
		globals: true,
		testTimeout: 60000,
		clearMocks: true,
		restoreMocks: true,
		mockReset: false,
	},
})

