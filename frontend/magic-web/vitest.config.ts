import { resolve } from "path"
import { defaultClientConditions } from "vite"
import { defineConfig, mergeConfig } from "vitest/config"
import { getOverlayViteConfig } from "./vite/overlay"
import vitePluginIframeRuntime from "./plugins/vite-plugin-iframe-runtime"

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
		plugins: [
			fixAntdLocaleImportExtensions(),
			vitePluginIframeRuntime({ projectRoot: __dirname }),
		],
		resolve: {
			// Match application resolution so tests do not depend on a previously built dist.
			conditions: ["magic-web-source", ...defaultClientConditions],
			alias: [
				// 与应用保持一致，组件测试直接解析导出工具源码，无需预构建包。
				{
					find: "@magic-web/html2image",
					replacement: resolve(__dirname, "packages/html2image/src/index.ts"),
				},
				{
					find: "@admin-components",
					replacement: resolve(__dirname, "packages/magic-admin/components/index.ts"),
				},
				{
					find: "@customer/",
					replacement: `${resolve(__dirname, "customer/src")}/`,
				},
				{
					find: "@enterprise/",
					replacement: `${resolve(__dirname, "enterprise/src")}/`,
				},
				{
					find: "@admin/",
					replacement: `${resolve(__dirname, "packages/magic-admin/src")}/`,
				},
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
					find: "virtual:magic-api",
					replacement: resolve(__dirname, "test/mocks/magic-api-prelude.ts"),
				},
				{
					find: "@dtyq/es6-template-strings",
					replacement: resolve(__dirname, "test/mocks/es6-template-strings.ts"),
				},
				{
					find: /^@dtyq\/magic-admin$/,
					replacement: resolve(__dirname, "packages/magic-admin/src/index.ts"),
				},
				{
					find: /^@dtyq\/magic-admin\/components$/,
					replacement: resolve(__dirname, "packages/magic-admin/components/index.ts"),
				},
				{
					find: /^@dtyq\/magic-admin\/provider$/,
					replacement: resolve(
						__dirname,
						"packages/magic-admin/src/provider/AdminProvider/index.tsx",
					),
				},
				// Keep Vitest aligned with app-local package aliases that are normally resolved by Vite.
				{
					find: "@dtyq/magic-admin/locales",
					replacement: resolve(__dirname, "packages/magic-admin/src/locales/index.ts"),
				},
				{
					find: "@dtyq/x-markdown",
					replacement: resolve(__dirname, "packages/x-markdown/src/index.ts"),
				},
				{
					find: "@magic-admin-v2",
					replacement: resolve(__dirname, "packages/magic-admin-v2/src"),
				},
				{
					find: "@dtyq/magic-admin-v2",
					replacement: resolve(__dirname, "packages/magic-admin-v2/src/index.ts"),
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

const vitestBaseConfig = getVitestBaseConfig()
const overlayConfig = getOverlayViteConfig({
	projectRoot: __dirname,
	mode: "test",
	loadEnv: false,
})
const baseAliases = vitestBaseConfig.resolve?.alias
const overlayAliases = overlayConfig.resolve?.alias

export default defineConfig(
	mergeConfig(vitestBaseConfig, {
		...overlayConfig,
		resolve: {
			...overlayConfig.resolve,
			// overlay 配置包含自定义别名时，同时保留测试环境专用别名。
			alias: [
				...(Array.isArray(baseAliases) ? baseAliases : []),
				...(Array.isArray(overlayAliases) ? overlayAliases : []),
			],
		},
	}),
)
