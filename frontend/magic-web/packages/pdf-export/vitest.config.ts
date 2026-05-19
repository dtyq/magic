import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		name: "pdf-export",
		environment: "node",
		include: ["tests/**/*.test.ts"],
		globals: true,
		passWithNoTests: true,
		snapshotFormat: {
			printBasicPrototype: false,
		},
	},
})
