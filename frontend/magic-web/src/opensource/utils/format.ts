/**
 * 将数字或字符串转换为带千分符的格式
 * @param value - 需要格式化的数字或字符串
 * @returns 格式化后的字符串，如 "1,500", "1,000,000"
 *
 * @example
 * formatNumber(1500) // "1,500"
 * formatNumber("1000000") // "1,000,000"
 * formatNumber(0) // "0"
 * formatNumber("") // "0"
 * formatNumber(null) // "0"
 */
export function formatNumber(value: string | number | null | undefined): string {
	// 处理空值和无效值
	if (value === null || value === undefined || value === "") {
		return "0"
	}

	// 转换为数字
	const num = typeof value === "string" ? parseFloat(value) : value

	// 检查是否为有效数字
	if (isNaN(num)) {
		return "0"
	}

	// 使用 Intl.NumberFormat 来格式化数字，添加千分符
	return new Intl.NumberFormat("en-US").format(num)
}

/**
 * 格式化复制项目数量的专用函数
 * @param copyProjectCount - 复制项目的数量
 * @returns 格式化后的字符串
 */
export function formatCopyProjectCount(
	copyProjectCount: string | number | null | undefined,
): string {
	return formatNumber(copyProjectCount)
}
