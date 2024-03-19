/// <reference types="vitest" />
import { mergeConfig } from "vite"
import { defineConfig } from "vitest/config"
import devConfig from "./vite.config.dev"

export default mergeConfig(
	devConfig,
	defineConfig({
		test: {
			environment: "jsdom",
			setupFiles: ["./tests/index.ts"],
			globals: true,
			coverage: {
				include: ["src/components/**/*.{ts,tsx}"],
				exclude: ["src/components/**/*.test.{ts,tsx}", "src/components/**/*.spec.{ts,tsx}"],
				thresholds: {
					lines: 35,
					functions: 45,
					branches: 60,
					statements: 35,
				},
			},
			include: ["tests/**/*.{test,spec}.{ts,tsx}", "src/**/*.{test,spec}.{ts,tsx}"],
		},
	}),
)
