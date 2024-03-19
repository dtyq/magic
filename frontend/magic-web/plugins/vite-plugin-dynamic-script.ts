// plugins/vite-plugin-dynamic-script.ts
import type { PluginOption } from "vite"

/**
 * @description 动态脚本插件 (针对 script 标签的动态引入，如只有生产环境中增加用户行为分析上报)
 * @param scripts 脚本列表
 * @returns 插件选项
 */
export default (scripts: string[]): PluginOption => ({
	name: "vite-plugin-dynamic-script",
	transformIndexHtml(html) {
		return {
			html,
			tags: [
				{
					tag: "script",
					attrs: { type: "text/javascript" },
					children: scripts.join("\n"),
					injectTo: "head", // 插入到body底部
				},
			],
		}
	},
})
