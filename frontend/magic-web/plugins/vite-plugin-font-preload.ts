import type {
	HtmlTagDescriptor,
	IndexHtmlTransformContext,
	IndexHtmlTransformResult,
	PluginOption,
} from "vite"

/**
 * Vite 插件：关键字体预加载优化
 *
 * 自动在 HTML head 中注入关键字体（Inter）的预加载链接，
 * 以改善 Largest Contentful Paint (LCP) 性能指标。
 *
 * 特性：
 * - 仅预加载首屏内容使用的关键字体
 * - 排除次要字体（D-DIN-PRO），避免阻塞 LCP
 * - 构建时自动检测字体资源
 * - 支持 TTF、WOFF、WOFF2 和 OTF 格式
 *
 * @returns {PluginOption} Vite 插件配置
 *
 * @example
 * // 在 vite.config.ts 中
 * import vitePluginCriticalFontPreload from "./plugins/vite-plugin-font-preload"
 *
 * export default defineConfig({
 *   plugins: [
 *     vitePluginCriticalFontPreload(),
 *   ],
 * })
 */
type HtmlTransform = {
	order?: "pre" | "post"
	handler: (
		html: string,
		ctx: IndexHtmlTransformContext,
	) => IndexHtmlTransformResult | Promise<IndexHtmlTransformResult>
}

type OrderedPlugin = PluginOption & {
	order?: "pre" | "post"
	transformIndexHtml?: HtmlTransform
}

export default function vitePluginCriticalFontPreload(): PluginOption {
	let criticalFontAssets: string[] = []

	const plugin: OrderedPlugin = {
		name: "vite-plugin-critical-font-preload",
		order: "post",
		generateBundle(options, bundle) {
			// 仅收集首屏内容使用的关键字体（Inter）
			// 排除次要字体（D-DIN-PRO），避免阻塞 LCP
			criticalFontAssets = Object.values(bundle)
				.filter((asset) => {
					if (asset.type !== "asset" || typeof asset.fileName !== "string") {
						return false
					}
					const fileName = asset.fileName
					// 仅匹配 Inter 字体文件，排除 D-DIN-PRO 和其他字体
					return (
						fileName.includes("Inter-VariableFont") ||
						(fileName.includes("Inter") &&
							!fileName.includes("D-DIN") &&
							(fileName.endsWith(".ttf") ||
								fileName.endsWith(".woff2") ||
								fileName.endsWith(".woff")))
					)
				})
				.map((asset) => asset.fileName as string)
		},
		transformIndexHtml: {
			order: "post",
			handler(html, ctx) {
				// 仅预加载 Inter 字体（LCP 关键字体）
				// D-DIN-PRO 字体是次要字体，不应预加载以避免阻塞 LCP
				const assets =
					ctx.bundle && Object.keys(ctx.bundle).length > 0
						? Object.values(ctx.bundle)
								.filter((asset) => {
									if (
										asset.type !== "asset" ||
										typeof asset.fileName !== "string"
									) {
										return false
									}
									const fileName = asset.fileName
									// 仅匹配 Inter 字体文件，排除 D-DIN-PRO 和其他字体
									return (
										fileName.includes("Inter-VariableFont") ||
										(fileName.includes("Inter") &&
											!fileName.includes("D-DIN") &&
											(fileName.endsWith(".ttf") ||
												fileName.endsWith(".woff2") ||
												fileName.endsWith(".woff")))
									)
								})
								.map((asset) => asset.fileName as string)
						: criticalFontAssets

				if (assets.length === 0) {
					return html
				}

				// 生成预加载链接标签
				const tags: HtmlTagDescriptor[] = assets.map((fileName) => {
					// 根据文件扩展名确定 MIME 类型
					const mimeType = fileName.endsWith(".woff2")
						? "font/woff2"
						: fileName.endsWith(".woff")
						? "font/woff"
						: fileName.endsWith(".ttf")
						? "font/ttf"
						: fileName.endsWith(".otf")
						? "font/otf"
						: "font/ttf"

					return {
						tag: "link",
						attrs: {
							rel: "preload",
							as: "font",
							href: `/${fileName}`,
							type: mimeType,
							crossorigin: "anonymous",
						},
						injectTo: "head",
					}
				})

				return tags
			},
		},
	}

	return plugin
}
