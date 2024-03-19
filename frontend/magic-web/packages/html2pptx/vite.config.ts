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
			port: 5177,
			open: false,
		},
		build: {
			outDir: "dist",
			emptyOutDir: true,
			sourcemap: true,
			minify: isProd ? "esbuild" : false,
			lib: {
				entry: resolve(__dirname, "src/index.ts"),
				name: "Html2Pptx",
				fileName: "index",
				formats: ["es", "cjs"],
			},
			rollupOptions: {
				external: ["@zumer/snapdom", "pptxgenjs"],
				output: {
					globals: {
						"@zumer/snapdom": "snapdom",
						pptxgenjs: "pptxgenjs",
					},
				},
			},
		},
	}
})
