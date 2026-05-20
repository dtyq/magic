import { resolve } from "node:path"
import { defineConfig } from "vite"

export default defineConfig(({ mode }) => {
	const isProd = mode === "production"

	return {
		resolve: {
			alias: {
				"@": resolve(__dirname, "src"),
			},
		},
		publicDir: false,
		server: {
			port: 5178,
			open: false,
		},
		build: {
			outDir: "dist",
			emptyOutDir: true,
			sourcemap: true,
			minify: isProd ? "esbuild" : false,
			lib: {
				entry: resolve(__dirname, "src/index.ts"),
				name: "PdfExport",
				fileName: "index",
				formats: ["es", "cjs"],
			},
			rolldownOptions: {
				external: ["@zumer/snapdom", "jspdf"],
				output: {
					globals: {
						"@zumer/snapdom": "snapdom",
						jspdf: "jspdf",
					},
				},
			},
		},
	}
})
