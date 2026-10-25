import { defineConfig } from "vite"
import { resolve } from "path"

export default defineConfig({
	build: {
		lib: {
			entry: {
				index: resolve(__dirname, "src/index.ts"),
			},
		},
		rolldownOptions: {
			// Keep every entry, lazy chunk and asset inside its module format's directory.
			output: [
				{
					format: "es",
					entryFileNames: "esm/[name].js",
					chunkFileNames: "esm/[name]-[hash].js",
					assetFileNames: "esm/[name]-[hash][extname]",
				},
				{
					format: "cjs",
					entryFileNames: "cjs/[name].cjs",
					chunkFileNames: "cjs/[name]-[hash].cjs",
					assetFileNames: "cjs/[name]-[hash][extname]",
				},
			],
			external: [
				"@apmplus/web",
				"@apmplus/integrations",
				"@arms/rum-browser",
				"@cloudcare/browser-rum",
			],
		},
	},
})
