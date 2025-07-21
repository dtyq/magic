import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "path"
import dts from "vite-plugin-dts"
import { glob } from "glob"

export default defineConfig(({ command }) => {
	// 如果是预览模式，使用开发服务器配置
	if (command === "serve") {
		return {
			plugins: [react()],
			root: "preview",
			server: {
				open: true,
			},
			resolve: {
				alias: {
					"@": resolve(__dirname, "components"),
				},
			},
		}
	}

	// 构建库的配置
	return {
		plugins: [
			react(),
			dts({
				include: ["components/**/*", "types/**/*"],
				exclude: [
					"components/**/__tests__/**/*",
					"components/**/*.test.*",
					"components/**/*.spec.*",
				],
				outDir: "dist/types",
			}),
		],
		build: {
			lib: {
				entry: {
					// 总入口文件
					index: resolve(__dirname, "components/index.ts"),
					// 各个组件的入口文件
					...glob
						.sync("components/*/index.ts*")
						.reduce((entries: Record<string, string>, file: string) => {
							const name = file.replace(/^components\/(.*)\/index\.tsx?$/, "$1")
							entries[name] = resolve(__dirname, file)
							return entries
						}, {} as Record<string, string>),
				},
				formats: ["es", "cjs"],
			},
			rollupOptions: {
				external: [
					"react",
					"react-dom",
					"antd",
					"ahooks",
					"@tabler/icons-react",
					"antd-style",
					"lodash-es",
				],
				output: [
					{
						format: "es",
						dir: "dist/es",
						entryFileNames: (chunkInfo) => {
							return chunkInfo.name === "index"
								? "index.js"
								: "components/[name]/index.js"
						},
						chunkFileNames: "_chunks/[name]-[hash].js",
					},
					{
						format: "cjs",
						dir: "dist/cjs",
						entryFileNames: (chunkInfo) => {
							return chunkInfo.name === "index"
								? "index.js"
								: "components/[name]/index.js"
						},
						chunkFileNames: "_chunks/[name]-[hash].js",
					},
				],
			},
			sourcemap: false,
			minify: "terser",
		},
		resolve: {
			alias: {
				"@": resolve(__dirname, "components"),
			},
		},
	}
})
