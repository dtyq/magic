/**
 * 线条相关工具函数
 */

/**
 * 映射 CSS 边框样式到 PPT 虚线类型
 */
export function mapDashType(style: "solid" | "dashed" | "dotted"): string {
	switch (style) {
		case "dashed":
			return "dash"
		case "dotted":
			return "dot"
		default:
			return "solid"
	}
}
