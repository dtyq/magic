import { defineConfig } from "vite"
import { resolve } from "path"
import dts from "vite-plugin-dts"

export default defineConfig({
	build: {
		lib: {
			entry: {
				index: resolve(__dirname, "src/index.ts"),
				plugins: resolve(__dirname, "src/plugins/index.ts"),
			},
			formats: ["es", "cjs"],
		},
		rollupOptions: {
			external: ["@apmplus/web", "@arms/rum-browser"],
		},
	},
	plugins: [
		dts({
			include: ["src/**/*"],
			outDir: "dist",
		}),
	],
})
