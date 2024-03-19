import { defineConfig } from "tsup"
import type { Options } from "tsup"

// 使用更精确的文件匹配，而不是目录
const entry = ["./src/**/*.ts"]

// 定义公共配置
const commonOptions: Partial<Options> = {
	sourcemap: true,
	keepNames: true,
	external: [],
	skipNodeModulesBundle: true,
	dts: {
		only: false,
		resolve: true,
	},
}

// 模块构建公共配置
const moduleOptions: Partial<Options> = {
	...commonOptions,
	entry,
	splitting: false,
	outExtension: ({ format }) => {
		if (format === "esm") {
			return { js: ".mjs", dts: ".d.ts" }
		}
		return { js: ".cjs", dts: ".d.ts" }
	},
	treeshake: false,
	bundle: false,
}

export default defineConfig([
	{
		...moduleOptions,
		format: "esm",
		outDir: "dist/es",
		clean: true,
		bundle: true,
	},
	{
		...moduleOptions,
		format: "cjs",
		outDir: "dist/lib",
		clean: false,
		treeshake: true,
		bundle: true,
	},
])
