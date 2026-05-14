import { defineConfig, mergeConfig, type PluginOption, type UserConfig } from "vite"
import babel from "@rolldown/plugin-babel"
import react from "@vitejs/plugin-react"
import { resolve } from "path"
import mkcert from "vite-plugin-mkcert"
import http2Proxy from "@cpsoinos/vite-plugin-http2-proxy"
// import legacy from "@vitejs/plugin-legacy"
import vitePluginImp from "vite-plugin-imp"
// import { VitePWA } from "vite-plugin-pwa"
import { visualizer } from "rollup-plugin-visualizer"
import keepConsole from "vite-plugin-keep-console"
import babelPluginAntdStyle from "babel-plugin-antd-style"
import { viteExternalsPlugin } from "vite-plugin-externals"
import createCanvasDesignPublicAssetsPlugin from "./plugins/vite-plugin-canvas-design-public-assets"
import vitePluginTransformBaseImports from "./plugins/vite-plugin-transform-base-imports"
import vitePluginCriticalFontPreload from "./plugins/vite-plugin-font-preload"
import { getViteEditionConfig } from "./vite/edition"
import { createCodeSplittingGroups } from "./vite/code-splitting-groups"
import Inspect from "vite-plugin-inspect"
import { codeInspectorPlugin } from "code-inspector-plugin"

/** 环境变量前缀 */
const ENV_PREFIX = "MAGIC_"

/** 是否为开发环境 */
const isDev = process.env.NODE_ENV === "development"

/** 本地开发 HTTPS hosts，支持逗号分隔多个，默认 magic.t.teamshare.cn */
const devHosts = (process.env.DEV_HOSTS ?? "magic.com")
	.split(",")
	.map((h) => h.trim())
	.filter(Boolean)

/** 是否开启依赖分析 */
const isVisualizer = process.env.VISUALIZER === "true"

const isEnableDevtools = process.env.DEVTOOLS === "true"

/** 是否开启sourcemap */
const isEnableSourceMap = process.env.SOURCE_MAP === "true"

/** 是否开启inspect */
const isEnableInspect = process.env.INSPECT === "true"

function formatLucideComponentImportName(componentName: string): string {
	return `${componentName
		.replace(/Icon$/, "")
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
		.replace(/([a-zA-Z])(\d)/g, "$1-$2")
		.replace(/(\d)([a-zA-Z])/g, "$1-$2")
		.toLowerCase()}.js`
}

function getBaseViteConfig(): UserConfig {
	return {
		devtools: {
			enabled: isEnableDevtools,
		},
		build: {
			outDir: resolve(__dirname, "dist"),
			emptyOutDir: true,
			reportCompressedSize: false,
			sourcemap: isEnableSourceMap,
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
						groups: createCodeSplittingGroups(),
					},
				},
			},
		},
		server: {
			host: "0.0.0.0", // 监听所有地址
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
			// magic-flow lists react as a dep; force one React for hooks
			dedupe: ["react", "react-dom"],
			alias: [
				{
					find: "@",
					replacement: resolve(__dirname, "src"),
				},
			],
		},
		plugins: [
			createCanvasDesignPublicAssetsPlugin(),
			// Transform named imports from @/components/base to default imports
			// 将 @/components/base 的命名导入转换为默认导入
			vitePluginTransformBaseImports({
				paths: [
					"@/components/base",
					{ base: "@/enhance/tabler/icons-react", subDirectory: "icons" },
					{
						base: "lucide-react",
						subDirectory: "dist/esm/icons",
						componentNameFormatter: formatLucideComponentImportName,
					},
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
			codeInspectorPlugin({
				bundler: "vite", // Automatically detect development or production environment
				editor: "code",
			}),
			react(),
			babel({
				plugins: [
					babelPluginAntdStyle,
					// [
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
				viteExternalsPlugin({
					// 模块名: 全局变量名
					react: "React",
					"react-dom": "ReactDOM",
					"lodash-es": "_",
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
							// 可通过环境变量 DEV_HOSTS 覆盖，多个 host 用逗号分隔
							hosts: devHosts,
						}),
						// http2Proxy({ quiet: true }),
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
