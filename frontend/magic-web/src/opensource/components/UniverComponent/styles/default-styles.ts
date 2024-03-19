/**
 * 默认样式配置模块
 * 定义Univer组件的默认单元格样式
 */

/**
 * 获取默认的单元格样式
 * 包含居中对齐和自动换行，针对中文环境优化
 */
export function getDefaultCellStyle(): Record<string, unknown> {
	return {
		// 水平对齐：居中
		ht: 2, // ht 是一个数字枚举，1 表示左对齐，2 表示居中，3 表示右对齐。

		// 垂直对齐：居中
		vt: 2, // vt 是一个数字枚举，1 表示顶部对齐，2 表示居中，3 表示底部对齐。

		// 文本换行
		tb: 3, // tb 是一个数字枚举，1 表示溢出，2 表示截断，3 表示自动换行。

		// 字体设置，适合中文显示
		ff: "Microsoft YaHei, Arial, sans-serif", // 字体族，优先使用微软雅黑

		// 文本颜色
		cl: { rgb: "#000000" }, // 黑色文本

		// 内边距设置，给文本留出更多空间
		pd: {
			t: 2, // 上内边距
			b: 2, // 下内边距
			l: 4, // 左内边距
			r: 4, // 右内边距
		},
	}
}

/**
 * 创建默认样式ID和样式对象的映射
 */
export function createDefaultStylesMap(): Record<string, Record<string, unknown>> {
	return {
		default: getDefaultCellStyle(),
	}
}

/**
 * 获取默认样式ID
 */
export function getDefaultStyleId(): string {
	return "default"
}

/**
 * 合并用户样式和默认样式
 * 用户样式优先级更高，会覆盖默认样式
 * @param userStyle 用户定义的样式
 * @returns 合并后的样式
 */
export function mergeWithDefaultStyle(userStyle: Record<string, unknown>): Record<string, unknown> {
	const defaultStyle = getDefaultCellStyle()

	if (!userStyle) {
		return defaultStyle
	}

	// 合并样式，用户样式优先
	return {
		...defaultStyle,
		...userStyle,
	}
}
