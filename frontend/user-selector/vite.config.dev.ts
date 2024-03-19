import { resolve } from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const devConfig = defineConfig({
	css: {
		postcss: "./postcss.config.js",
	},
	plugins: [react()],
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
			"@dtyq/user-selector": resolve(__dirname, "./src/index.ts"),
		},
	},
})

export default devConfig
