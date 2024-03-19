import { defineConfig, mergeConfig, type PluginOption, type UserConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "path"
import mkcert from "vite-plugin-mkcert"
import http2Proxy from "@cpsoinos/vite-plugin-http2-proxy"
// import legacy from "@vitejs/plugin-legacy"
import vitePluginImp from "vite-plugin-imp"
// import { VitePWA } from "vite-plugin-pwa"
import { visualizer } from "rollup-plugin-visualizer"
import viteBabel from "vite-plugin-babel"
import keepConsole from "vite-plugin-keep-console"
import babelPluginAntdStyle from "babel-plugin-antd-style"
import { viteExternalsPlugin } from "vite-plugin-externals"
import vitePluginTransformBaseImports from "./plugins/vite-plugin-transform-base-imports"
import vitePluginCriticalFontPreload from "./plugins/vite-plugin-font-preload"
import { getViteEditionConfig } from "./vite/edition"
import Inspect from "vite-plugin-inspect"
import { codeInspectorPlugin } from "code-inspector-plugin"

/** 环境变量前缀 */
const ENV_PREFIX = "MAGIC_"

/** 是否为开发环境 */
const isDev = process.env.NODE_ENV === "development"

/** 是否开启依赖分析 */
const isVisualizer = process.env.VISUALIZER === "true"

/** 是否开启sourcemap */
const isEnableSourceMap = process.env.SOURCE_MAP === "true"

/** 是否开启inspect */
const isEnableInspect = process.env.INSPECT === "true"

function getBaseViteConfig(): UserConfig {
	return {
		esbuild: {
			// 彻底移除所有注释，包括许可证注释
			legalComments: "none",
		},
		build: {
			outDir: resolve(__dirname, "dist"),
			reportCompressedSize: false,
			sourcemap: isEnableSourceMap,
			target: "es2015",
			rollupOptions: {
				// 只在生产环境将 React、React-DOM、Lodash 和 Tabler Icons 设置为外部依赖
				external: isDev ? [] : ["react", "react-dom", "lodash-es"],
				output: {
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
					manualChunks: isDev
						? undefined
						: (id) => {
							const normalizedId = id.replace(/\\/g, "/")

							// 🎨 Ant Design 相关包分离处理，避免循环依赖
							if (normalizedId.includes("node_modules/@ant-design/colors")) {
								return "antd-colors" // 颜色包单独分离
							}

							// 将 Mermaid 按需加载逻辑抽出单独 chunk，避免被 shared 入口复用后触发 React 重挂载
							if (normalizedId.includes("/src/library/mermaid/")) {
								return "mermaid-loader"
							}

							// 🎯 保留原有的 Monaco Editor 处理
							if (
								normalizedId.includes("monaco-editor") &&
								!normalizedId.includes("@monaco-editor/react")
							) {
								return "monacoEditor"
							}
							if (normalizedId.includes("@monaco-editor/react")) {
								return "monacoEditorReact"
							}
						},
				},
			},
		},
		server: {
			host: "0.0.0.0", // 监听所有地址
			proxy: {
				// Proxy for CDN resources to avoid CORS issues in development
				// 代理 CDN 资源以避免开发环境跨域问题
				"/api/cdn": {
					target: "https://public-cdn.letsmagic.cn",
					changeOrigin: true,
					secure: true,
					rewrite: (path) => path.replace(/^\/api\/cdn/, ""),
				},
			},
		},
		envPrefix: ENV_PREFIX,
		optimizeDeps: {
			include: [
				"antd",
				"dayjs",
				"dayjs/plugin/duration",
				"dayjs/plugin/weekday",
				"dayjs/plugin/localeData",
				"dayjs/plugin/weekOfYear",
				"dayjs/plugin/isoWeek",
				"dayjs/plugin/isBetween",
				"dayjs/plugin/isSameOrBefore",
				"dayjs/plugin/isSameOrAfter",
				"dayjs/plugin/minMax",
				"dayjs/plugin/timezone",
				"dayjs/plugin/updateLocale",
				"dayjs/plugin/utc",
				"dayjs/plugin/relativeTime",
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
				// 开发环境包含这些依赖
				...(isDev ? ["lodash-es", "@tabler/icons-react"] : []),
			],
			exclude: ["antd/locale"],
		},
		define: {
			global: "globalThis",
		},
		worker: {
			format: "es",
		},
		assetsInclude: ["**/*.md", "**/*.mdx", "**/*.mov", "**/*.webm", "**/*.png"],
		resolve: {
			alias: [
				{
					find: "@",
					replacement: resolve(__dirname, "src"),
				},
				{
					find: "@enterprise",
					replacement: resolve(__dirname, "enterprise/src"),
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
				...(!isDev
					? [
						{
							find: "./xxtt",
							replacement: resolve(
								__dirname,
								"src/opensource/pages/login/components/EmailVerificationCodeForm/utils/xxtt-simple.obfuscated.ts",
							),
						},
						{
							find: "./operations",
							replacement: resolve(
								__dirname,
								"src/opensource/pages/login/components/EmailVerificationCodeForm/utils/operations.obfuscated.ts",
							),
						},
					]
					: []),
			],
		},
		plugins: [
			// Transform named imports from @/opensource/components/base to default imports
			// 将 @/opensource/components/base 的命名导入转换为默认导入
			vitePluginTransformBaseImports({
				paths: [
					"@/opensource/components/base",
					{ base: "@/enhance/tabler/icons-react", subDirectory: "icons" },
				],
			}),
			keepConsole(),
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
			viteBabel({
				babelConfig: {
					plugins: [
						"antd-style",
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
				},
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
			react({
				babel: {
					plugins: [[babelPluginAntdStyle]],
				},
			}),
			// Critical font preload plugin for LCP optimization
			!isDev && vitePluginCriticalFontPreload(),
			!isDev &&
			viteExternalsPlugin({
				// 模块名: 全局变量名
				react: "React",
				"react-dom": "ReactDOM",
				"lodash-es": "_",
			}),
			codeInspectorPlugin({
				bundler: "vite", // Automatically detect development or production environment
				editor: "cursor",
			}),
			vitePluginImp({
				libList: [
					{
						libName: "antd",
					},
				],
			}),
			// 用于本地生成HTTPS证书
			...(isDev
				? [
					mkcert({
						// 本地配置该地址的 host, 满足文件私有桶上传
						hosts: [
							"magic.com",
						],
					}),
					http2Proxy({ quiet: true }),
				]
				: []), // optional -- suppress error logging],
			// 浏览器兼容
			// legacy({
			// 	targets: [
			// 		"last 2 versions and not dead",
			// 		"> 0.3%",
			// 		"chrome 91",
			// 		"chrome 108",
			// 		"safari 16",
			// 	], // 需要兼容的目标列表，可以设置多个
			// 	additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
			// 	renderLegacyChunks: true,
			// 	polyfills: [
			// 		"es.symbol",
			// 		"es.array.filter",
			// 		"es.promise",
			// 		"es.promise.finally",
			// 		"es/map",
			// 		"es/set",
			// 		"es.array.for-each",
			// 		"es.object.define-properties",
			// 		"es.object.define-property",
			// 		"es.object.get-own-property-descriptor",
			// 		"es.object.get-own-property-descriptors",
			// 		"es.object.keys",
			// 		"es.object.to-string",
			// 		"web.dom-collections.for-each",
			// 		"esnext.global-this",
			// 		"esnext.string.match-all",
			// 	],
			// }),
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

export default defineConfig((): UserConfig => {
	const editionViteConfig = getViteEditionConfig({
		projectRoot: __dirname,
	})

	return mergeConfig(getBaseViteConfig(), editionViteConfig)
})
