import {
	defaultClientConditions,
	defineConfig,
	mergeConfig,
	type PluginOption,
	type UserConfig,
} from "vite"
import { createRequire } from "node:module"
import babel from "@rolldown/plugin-babel"
import react from "@vitejs/plugin-react"
import { resolve } from "path"
import mkcert from "vite-plugin-mkcert"
import vitePluginImp from "vite-plugin-imp"
import { visualizer } from "rollup-plugin-visualizer"
import vitePluginStripConsole from "./plugins/vite-plugin-strip-console"
import { withTransformFilter } from "./plugins/with-transform-filter"
import babelPluginAntdStyle from "babel-plugin-antd-style"
import { viteExternalsPlugin } from "vite-plugin-externals"
import createAppServiceWorkerPlugin from "./plugins/vite-plugin-app-service-worker"
import createChunkImportMapHashPlugin from "./plugins/vite-plugin-chunk-import-map-hash"
import vitePluginMagicAdminSource from "./packages/magic-admin/vite/plugins/vite-plugin-magic-admin-source"
import vitePluginTransformBaseImports from "./plugins/vite-plugin-transform-base-imports"
import { lucideDynamicAggregatePlugin } from "./plugins/vite-plugin-lucide-dynamic-aggregate"
import vitePluginCriticalFontPreload from "./plugins/vite-plugin-font-preload"
import vitePluginMagicApi from "./plugins/vite-plugin-magic-api"
import vitePluginIframeRuntime from "./plugins/vite-plugin-iframe-runtime"
import { externalGlobalsPlugin } from "./plugins/vite-plugin-external-globals"
import { getOverlayViteConfig } from "./vite/overlay"
import { createCodeSplittingGroups } from "./vite/code-splitting-groups"
import { resolveMicroAppInstallDevProxy } from "./vite/micro-app-install-proxy"
import Inspect from "vite-plugin-inspect"
import { codeInspectorPlugin } from "code-inspector-plugin"
import createHtmlSandboxRuntimePlugin from "./plugins/vite-plugin-html-sandbox-runtime"

/** 环境变量前缀 */
const ENV_PREFIX = "MAGIC_"
const requireModule = createRequire(import.meta.url)

function formatLucideComponentImportName(componentName: string): string {
	return `${componentName
		.replace(/Icon$/, "")
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
		.replace(/([a-zA-Z])(\d)/g, "$1-$2")
		.replace(/(\d)([a-zA-Z])/g, "$1-$2")
		.toLowerCase()}.js`
}

// Factory function for shared base Vite configuration
export function getBaseViteConfig(env: NodeJS.ProcessEnv = process.env, mode?: string): UserConfig {
	// Env overlay resolution runs before this factory so every config decision
	// observes the same winning physical files as import.meta.env and child tasks.
	const allowedHosts = env.MAGIC_DEV_ALLOWED_HOSTS
		? env.MAGIC_DEV_ALLOWED_HOSTS.split(",")
				.map((host) => host.trim())
				.filter(Boolean)
		: []
	const isDev = mode === "development" || env.NODE_ENV === "development"
	const devServerPort = env.PORT ? Number(env.PORT) : undefined
	const isHttpsDevServer = isDev && devServerPort === 443
	const isVisualizer = env.VISUALIZER === "true"
	const isEnableDevtools = env.DEVTOOLS === "true"
	const isEnableSourceMap = env.SOURCE_MAP === "true"
	const isEnableInspect = env.INSPECT === "true"

	return {
		devtools: {
			enabled: isEnableDevtools,
		},
		build: {
			// Enable chunk import maps in production to decouple chunk hash updates
			chunkImportMap: !isDev,
			outDir: resolve(__dirname, "dist"),
			// Enterprise uses root `enterprise/`; outDir is repo `dist/` (outside root).
			emptyOutDir: true,
			reportCompressedSize: false,
			// Keep maps in the build artifact without exposing sourceMappingURL in public assets.
			sourcemap: isEnableSourceMap ? "hidden" : false,
			target: "es2015",
			// Lightning CSS currently rejects some existing Tailwind arbitrary values.
			cssMinify: "esbuild",
			rolldownOptions: {
				// 只在生产环境将 React、React-DOM、Lodash 和 Tabler Icons 设置为外部依赖
				external: isDev ? [] : ["react", "react-dom", "lodash-es"],
				output: {
					// Keep production bundles comment-free after moving to Rolldown/Oxc.
					comments: false,
					// Configure output paths for different entry points
					// 为不同的入口点配置输出路径
					entryFileNames: (chunkInfo) => {
						// AudioWorklet files keep their path structure
						// AudioWorklet 文件保持其路径结构
						if (chunkInfo.name.startsWith("worklets/")) {
							return "[name].js"
						}
						return "assets/[name]-[hash].js"
					},
					assetFileNames: "assets/[name]-[hash][extname]",
					codeSplitting: {
						groups: createCodeSplittingGroups(__dirname),
					},
				},
			},
		},
		server: {
			host: "0.0.0.0", // 监听所有地址
			allowedHosts,
			proxy: isDev ? resolveMicroAppInstallDevProxy(env) : {},
		},
		preview: {
			host: "0.0.0.0",
			allowedHosts,
		},
		envPrefix: ENV_PREFIX,
		optimizeDeps: {
			include: [
				"antd",
				"dayjs",
				"dayjs/**/*",
				"lunar-typescript",
				"@fullcalendar/core",
				"@fullcalendar/react",
				"@fullcalendar/daygrid",
				"@fullcalendar/timegrid",
				"@fullcalendar/interaction",
				"react-big-calendar",
				"@ant-design/colors",
				"ahooks",
				"antd-style",
				"zustand",
				"zustand/middleware",
				"i18next",
				"react-i18next",
				"@tiptap/react",
				"@tiptap/pm/state",
				"@tiptap/pm/view",
				"@tiptap/starter-kit",
				"@tiptap/extension-image",
				"@tiptap/extension-text-align",
				"monaco-editor",
				"@monaco-editor/react",
				"jszip",
				"lodash-es",
				"@tabler/icons-react",
				"lucide-react/dynamic",
				"@radix-ui/*",
				"@dtyq/*",
				"@tiptap/*",
				"@univerjs/*",
			],
			exclude: ["antd/locale", "lucide-react"],
		},
		define: {
			global: "globalThis",
		},
		worker: {
			format: "es",
		},
		assetsInclude: ["**/*.md", "**/*.mdx", "**/*.mov", "**/*.webm", "**/*.png"],
		resolve: {
			// Workspace packages can expose source without coupling imports to their directory layout.
			conditions: ["magic-web-source", ...defaultClientConditions],
			// magic-flow lists react as a dep; force one React for hooks.
			// This list also keeps the standalone enterprise/ install root safe:
			// its packages resolve peers from enterprise/node_modules (a different
			// realpath), and these context-carrying singletons must never fork.
			// Other libraries (e.g. @tiptap/*) intentionally stay per-root: the
			// @feb editors are self-contained and may need a newer copy than the
			// app bundle ships.
			dedupe: [
				"react",
				"react-dom",
				"react-router",
				"react-router-dom",
				"i18next",
				"react-i18next",
				// These libraries expose shared React contexts. The standalone
				// enterprise install root can otherwise resolve duplicate copies,
				// making theme/config providers invisible to shared UI components.
				"antd",
				"antd-style",
				"@emotion/react",
				"@emotion/cache",
				"lucide-react",
				"@tabler/icons-react",
			],
			alias: [
				{
					find: "@",
					replacement: resolve(__dirname, "src"),
				},
				{
					find: "@magic-admin-v2",
					replacement: resolve(__dirname, "packages/magic-admin-v2/src"),
				},
				{
					find: "@enterprise",
					replacement: resolve(__dirname, "enterprise/src"),
				},
				{
					find: "@customer",
					replacement: resolve(__dirname, "customer/src"),
				},
				{
					find: "@dtyq/x-markdown",
					replacement: resolve(__dirname, "packages/x-markdown/src/index.ts"),
				},
				{
					find: "@magic-web/html2image",
					replacement: resolve(__dirname, "packages/html2image/src/index.ts"),
				},
				...(isDev
					? [
							{
								find: "@tabler/icons-react",
								replacement: resolve(
									__dirname,
									"scripts/cdn/tabler-icons-react.min.js",
								),
							},
						]
					: []),
			],
		},
		plugins: [
			isDev && createHtmlSandboxRuntimePlugin(env),
			lucideDynamicAggregatePlugin(),
			createAppServiceWorkerPlugin(),
			createChunkImportMapHashPlugin(),
			vitePluginMagicApi({ projectRoot: __dirname }),
			vitePluginIframeRuntime({ projectRoot: __dirname }),
			vitePluginMagicAdminSource({
				projectRoot: __dirname,
			}),
			// Transform named imports from @/components/base to default imports
			// 将 @/components/base 的命名导入转换为默认导入
			vitePluginTransformBaseImports({
				paths: [
					"@/components/base",
					{ base: "@/enhance/tabler/icons-react", subDirectory: "icons" },
					{
						base: "lucide-react",
						subDirectory: "dist/esm/icons",
						query: "lucide-static",
						componentNameFormatter: formatLucideComponentImportName,
					},
				],
			}),
			vitePluginStripConsole(),
			isEnableInspect &&
				Inspect({
					build: true,
					outputDir: ".vite-inspect",
				}),
			// 构建分析插件
			isVisualizer &&
				(visualizer({
					filename: "dist/stats.html",
					gzipSize: true,
					brotliSize: true,
					// 生成的可视化文件的路径和名称
					// 可视化的类型，可选值有 'sunburst'、'treemap'、'network' 等
					template: "treemap",
					// 是否打开生成的可视化文件
					open: true,
				}) as PluginOption),
			codeInspectorPlugin({
				bundler: "vite", // Automatically detect development or production environment
				editor: "code",
				// The inspector injects globals into every JSX module. Keep it opt-in so a
				// missing inspector runtime cannot break normal local pages.
				needEnvInspector: true,
			}),
			react(),
			// babel-plugin-antd-style returns an empty visitor when NODE_ENV=production, so in
			// builds Babel would only re-parse and re-print every module (~15s). Dev-only.
			isDev &&
				babel({
					plugins: [
						babelPluginAntdStyle,
						// [
						// 	// 等待magic-flow包升级完才能使用
						// 	"babel-plugin-import",
						// 	{
						// 		libraryName: "@tabler/icons-react",
						// 		libraryDirectory: "dist/esm/icons",
						// 		camel2DashComponentName: false,
						// 	},
						// 	"tabler",
						// ],
					],
				}),
			// VitePWA({
			// 	// disable: true,
			// 	strategies: "injectManifest",
			// 	srcDir: "src",
			// 	filename: "sw.ts",
			// 	registerType: "prompt",
			// 	injectRegister: "script",
			// 	minify: true,
			// 	manifest: {
			// 		theme_color: "#ffffff",
			// 	},
			// 	selfDestroying: true,
			// 	injectManifest: {
			// 		minify: false,
			// 		globPatterns: ["**/*.{js,ts,css,html,ico,png,svg,json,webp,lottie}"],
			// 		globIgnores: ["**/emojis/animated/*.png"],
			// 		// enableWorkboxModulesLogs: true,
			// 		maximumFileSizeToCacheInBytes: 20 * 1024 * 1024, // 设置为10MB，足够覆盖所有JS文件
			// 	},
			// 	devOptions: {
			// 		enabled: false,
			// 		type: "module",
			// 		navigateFallback: "index.html",
			// 	},
			// }),
			// Critical font preload plugin for LCP optimization
			!isDev && vitePluginCriticalFontPreload(),
			!isDev &&
				// The plugin only rewrites exact `react` / `react-dom` / `lodash-es` specifiers (import or
				// require), so skip every module that never quotes one of them.
				withTransformFilter(
					viteExternalsPlugin({
						// 模块名: 全局变量名
						react: "React",
						"react-dom": "ReactDOM",
						"lodash-es": "_",
					}),
					{ code: /["'`]\s*(?:react|react-dom|lodash-es)\s*["'`]/ },
				),
			!isDev && externalGlobalsPlugin(),
			vitePluginImp({
				libList: [
					{
						libName: "antd",
					},
				],
			}),
			// 用于本地生成HTTPS证书
			...(isDev && isHttpsDevServer
				? [
						mkcert({
							// 本地配置该地址的 host, 满足文件私有桶上传
							hosts: allowedHosts,
						}),
						// http2Proxy({ quiet: true }),
					]
				: []),
		],
		css: {
			preprocessorOptions: {
				less: {
					javascriptEnabled: true,
				},
			},
			modules: {
				localsConvention: "camelCaseOnly",
				scopeBehaviour: "local",
				generateScopedName: "[local]_[hash:base64:10]",
			},
		},
	}
}

export default defineConfig(({ mode }): UserConfig => {
	const overlayViteConfig = getOverlayViteConfig({ projectRoot: __dirname, mode })
	const baseViteConfig = getBaseViteConfig(process.env, mode)

	if (process.env.DUMP_VITE_CONFIG === "1") {
		const { writeViteConfigDumps } = requireModule("./scripts/dump-vite-config.cjs")
		writeViteConfigDumps(
			__dirname,
			baseViteConfig,
			mergeConfig(baseViteConfig, overlayViteConfig),
		)
		process.env.DUMP_VITE_CONFIG_DONE = "1"
		process.exit(0)
	}

	return mergeConfig(baseViteConfig, overlayViteConfig)
})
