import { resolve } from "path"
import { defineConfig, mergeConfig } from "vitest/config"
import { getViteEditionConfig } from "./vite/edition"

const fixAntdLocaleImportExtensions = () => ({
	name: "fix-antd-locale-import-extensions",
	enforce: "pre" as const,
	transform(code: string, id: string) {
		const normalizedId = id.replace(/\\/g, "/")
		if (!normalizedId.includes("/node_modules/antd/es/")) return

		if (
			!normalizedId.includes("/locale/") &&
			!normalizedId.includes("/date-picker/") &&
			!normalizedId.includes("/calendar/")
		) {
			return
		}

		return code
			.replace(
				/(["'])rc-pagination\/es\/locale\/([^."']+)\1/g,
				"$1rc-pagination/es/locale/$2.js$1",
			)
			.replace(/(["'])rc-picker\/es\/locale\/([^."']+)\1/g, "$1rc-picker/es/locale/$2.js$1")
			.replace(
				/(["'])((?:\.\.\/)+(?:calendar|date-picker|time-picker)\/locale\/[^."']+)\1/g,
				"$1$2.js$1",
			)
	},
})

const getVitestBaseConfig = () => {
	return {
		plugins: [fixAntdLocaleImportExtensions()],
		resolve: {
			alias: [
				{
					find: /^antd\/es\/locale\/[^/]+$/,
					replacement: resolve(__dirname, "test/mocks/empty-locale.ts"),
				},
				{
					find: /^rc-pagination\/es\/locale\/[^/]+$/,
					replacement: resolve(__dirname, "test/mocks/empty-locale.ts"),
				},
				{
					find: /^rc-picker\/es\/locale\/[^/]+$/,
					replacement: resolve(__dirname, "test/mocks/empty-locale.ts"),
				},
				{
					find: "@/",
					replacement: `${resolve(__dirname, "./src/")}/`,
				},
				{
					find: "@dtyq/es6-template-strings",
					replacement: resolve(__dirname, "test/mocks/es6-template-strings.ts"),
				},
			],
		},
		test: {
			environment: "jsdom",
			globals: true,
			setupFiles: [resolve(__dirname, "test/setup.ts")],
			env: {
				CI: process.env.CI === "true" ? "true" : undefined,
			},
			server: {
				deps: {
					inline: [
						"antd",
						"esdk-obs-browserjs",
						"@dtyq/upload-sdk",
						"@dtyq/es6-template-strings",
						"@dtyq/magic-flow",
						"@dtyq/upload-sdk",
						"rc-pagination",
						"rc-picker",
					],
				},
			},
		},
	}
}

export default defineConfig(
	mergeConfig(getVitestBaseConfig(), {
		resolve: getViteEditionConfig({ projectRoot: __dirname }).resolve,
	}),
)
