import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { defineConfig, type UserConfig } from "vite"

// Vitest may evaluate this config through a browser-like module transform where
// `import.meta.url` is not a file URL. Fall back to the workspace package path
// so the config remains usable in both Node/Vite builds and test transforms.
const projectRoot = (() => {
	try {
		return fileURLToPath(new URL(".", import.meta.url))
	} catch {
		return resolve(process.cwd(), "packages/html2pptx")
	}
})()
export function getBaseViteConfig({ mode }: { mode: string }): UserConfig {
	const isProd = mode === "production"

	return {
		// Keep package-owned worker chunks relative to the published entry. A
		// root-absolute `/assets/...` URL breaks when the package is deployed
		// below a sub-path or behind a CDN. Hosts can still override workerUrl.
		base: "./",
		resolve: {
			alias: {
				"@": resolve(projectRoot, "src"),
			},
		},
		publicDir: false,
		server: {
			port: 5177,
			open: false,
		},
		build: {
			outDir: resolve(projectRoot, "dist"),
			emptyOutDir: true,
			sourcemap: true,
			minify: isProd ? "esbuild" : false,
			lib: {
				entry: resolve(projectRoot, "src/index.ts"),
				name: "Html2Pptx",
				fileName: "index",
				formats: ["es", "cjs"],
			},
			rollupOptions: {
				external: ["@zumer/snapdom", "postcss-value-parser", "pptxgenjs"],
				output: {
					globals: {
						"@zumer/snapdom": "snapdom",
						pptxgenjs: "pptxgenjs",
					},
				},
			},
		},
	}
}

export default defineConfig((configEnv) => getBaseViteConfig({ mode: configEnv.mode }))
