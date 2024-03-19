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
		entry: ["./src/index.ts"],
		resolve: true,
	},
}

// 模块构建公共配置
const moduleOptions: Partial<Options> = {
	...commonOptions,
	splitting: false,
	outExtension: () => ({ js: ".js", dts: ".d.ts" }),
	treeshake: false,
	bundle: false,
}

export default defineConfig([
	{
		...moduleOptions,
		entry,
		format: "esm",
		outDir: "dist/es",
		clean: true,
		dts: {
			only: false,
			entry: ["./src/index.ts"],
			resolve: true,
		},
	},
	{
		...moduleOptions,
		entry,
		format: "cjs",
		outDir: "dist/lib",
		clean: false,
		dts: {
			only: false,
			entry: ["./src/index.ts"],
			resolve: true,
		},
	},
	{
		...commonOptions,
		entry: ["./src/index.ts"],
		format: "iife",
		outDir: "dist",
		clean: false,
		splitting: true,
		outExtension: () => ({ js: ".js", dts: ".d.ts" }),
		treeshake: false,
	},

	{
		...commonOptions,
		entry: ["./src/index.ts"],
		format: "iife",
		dts: false,
		keepNames: false,
		outDir: "dist",
		clean: false,
		splitting: false,
		minify: true,
		outExtension: () => ({ js: ".min.js" }),
	},
])
