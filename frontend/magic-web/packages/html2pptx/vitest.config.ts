import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		name: "html2pptx",
		environment: "node",
		include: ["tests/**/*.test.ts"],
		globals: true,
		snapshotFormat: {
			printBasicPrototype: false,
		},
	},
})
