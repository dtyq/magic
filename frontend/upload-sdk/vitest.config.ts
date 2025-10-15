import { defineConfig } from "vitest/config"

export default defineConfig({
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
		alias: {
			"lodash-es": "./tests/mocks/lodash-es.ts",
			"esdk-obs-browserjs": "./tests/mocks/ObsClientMock.ts",
		},
		globals: true,
		testTimeout: 60000,
		clearMocks: true,
		restoreMocks: true,
		mockReset: false,
	},
})

