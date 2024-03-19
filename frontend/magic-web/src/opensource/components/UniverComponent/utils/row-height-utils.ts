/**
 * 行高优化工具模块
 * 专门处理行高计算和自适应调整
 */

/**
 * 行高配置接口
 */
interface RowHeightConfig {
	baseHeight: number // 基础行高
	minHeight: number // 最小行高
	maxHeight: number // 最大行高
	chineseMultiplier: number // 中文内容行高倍数
	multiLineMultiplier: number // 多行文本行高倍数
	longTextMultiplier: number // 长文本行高倍数
	longTextThreshold: number // 长文本阈值
}

/**
 * 默认行高配置
 */
const DEFAULT_ROW_HEIGHT_CONFIG: RowHeightConfig = {
	baseHeight: 23, // 基础行高，适合中文显示
	minHeight: 20, // 最小行高，确保中文可读性
	maxHeight: 300, // 最大行高限制，增加以支持更长内容
	chineseMultiplier: 1.2, // 中文内容增加20%行高
	multiLineMultiplier: 2.2, // 多行文本增加120%
	longTextMultiplier: 1.8, // 长文本增加80%
	longTextThreshold: 25, // 超过25字符认为是长文本
}

/**
 * 估算文本在指定宽度下需要的行数
 * @param text 文本内容
 * @param columnWidth 列宽（像素）
 * @param fontSize 字体大小
 * @returns 估算的行数
 */
function estimateTextLines(text: string, columnWidth: number = 150, fontSize: number = 12): number {
	if (!text) return 1

	// 计算平均字符宽度（中文字符约等于fontSize，英文字符约为fontSize*0.6）
	const chineseCharCount = (text.match(/[\u4e00-\u9fff]/g) || []).length
	const englishCharCount = text.length - chineseCharCount

	const avgChineseCharWidth = fontSize * 1.1 // 中文字符稍宽一些
	const avgEnglishCharWidth = fontSize * 0.6 // 英文字符较窄

	const totalTextWidth =
		chineseCharCount * avgChineseCharWidth + englishCharCount * avgEnglishCharWidth

	// 考虑内边距和边距
	const usableWidth = Math.max(50, columnWidth - 10) // 预留10px的内边距

	// 计算需要的行数
	const estimatedLines = Math.ceil(totalTextWidth / usableWidth)

	// 检查是否有显式换行符
	const explicitLines = text.split(/\r?\n/).length

	return Math.max(1, Math.max(estimatedLines, explicitLines))
}

/**
 * 分析单元格内容特征
 * @param cellValue 单元格值
 * @returns 内容特征对象
 */
function analyzeCellContent(cellValue: any): {
	hasContent: boolean
	textLength: number
	hasChineseChars: boolean
	hasMultiLine: boolean
	hasLongText: boolean
	lineCount: number
} {
	if (!cellValue) {
		return {
			hasContent: false,
			textLength: 0,
			hasChineseChars: false,
			hasMultiLine: false,
			hasLongText: false,
			lineCount: 0,
		}
	}

	const text = cellValue.toString()
	const textLength = text.length
	const hasChineseChars = /[\u4e00-\u9fff]/.test(text)
	const hasMultiLine = text.includes("\n") || text.includes("\r")
	const lines = text.split(/\r?\n/)
	const lineCount = lines.length
	const hasLongText = textLength > DEFAULT_ROW_HEIGHT_CONFIG.longTextThreshold

	return {
		hasContent: true,
		textLength,
		hasChineseChars,
		hasMultiLine,
		hasLongText,
		lineCount,
	}
}

/**
 * 计算行的推荐高度（增强版，考虑列宽）
 * @param rowData 行数据数组
 * @param config 行高配置
 * @param columnWidths 列宽数组（可选）
 * @returns 推荐的行高
 */
export function calculateRowHeightWithColumns(
	rowData: any[],
	config: RowHeightConfig = DEFAULT_ROW_HEIGHT_CONFIG,
	columnWidths?: number[],
): number {
	if (!Array.isArray(rowData) || rowData.length === 0) {
		return config.baseHeight
	}

	let maxHeight = config.baseHeight
	let hasChineseContent = false
	let hasMultiLineContent = false
	let maxEstimatedLines = 1

	// 分析行中所有单元格，考虑列宽
	rowData.forEach((cellValue, colIndex) => {
		const analysis = analyzeCellContent(cellValue)

		if (analysis.hasContent) {
			const columnWidth =
				columnWidths && columnWidths[colIndex] ? columnWidths[colIndex] : 150
			const estimatedLines = estimateTextLines(cellValue.toString(), columnWidth)
			maxEstimatedLines = Math.max(maxEstimatedLines, estimatedLines)

			if (analysis.hasChineseChars) {
				hasChineseContent = true
			}

			if (analysis.hasMultiLine) {
				hasMultiLineContent = true
			}
		}
	})

	// 基于估算的行数调整高度
	if (maxEstimatedLines > 1) {
		maxHeight = Math.max(maxHeight, config.baseHeight * maxEstimatedLines * 1.1) // 增加10%余量
	}

	// 中文内容调整
	if (hasChineseContent) {
		maxHeight = Math.max(maxHeight, config.baseHeight * config.chineseMultiplier)
	}

	// 应用行高限制
	return Math.max(config.minHeight, Math.min(config.maxHeight, Math.round(maxHeight)))
}

/**
 * 计算行的推荐高度
 * @param rowData 行数据数组
 * @param config 行高配置
 * @returns 推荐的行高
 */
export function calculateRowHeight(
	rowData: any[],
	config: RowHeightConfig = DEFAULT_ROW_HEIGHT_CONFIG,
): number {
	if (!Array.isArray(rowData) || rowData.length === 0) {
		return config.baseHeight
	}

	let maxHeight = config.baseHeight
	let hasChineseContent = false
	let hasMultiLineContent = false
	let maxTextLength = 0
	let maxLineCount = 1

	// 分析行中所有单元格
	rowData.forEach((cellValue) => {
		const analysis = analyzeCellContent(cellValue)

		if (analysis.hasContent) {
			maxTextLength = Math.max(maxTextLength, analysis.textLength)
			maxLineCount = Math.max(maxLineCount, analysis.lineCount)

			if (analysis.hasChineseChars) {
				hasChineseContent = true
			}

			if (analysis.hasMultiLine) {
				hasMultiLineContent = true
			}
		}
	})

	// 基于内容特征调整行高
	if (hasMultiLineContent) {
		// 多行文本：根据行数计算高度
		maxHeight = Math.max(maxHeight, config.baseHeight * maxLineCount)
	} else if (maxTextLength > config.longTextThreshold) {
		// 长文本：根据文本长度动态计算行高
		const textLengthFactor = Math.min(3.0, 1 + maxTextLength / 100) // 最多增加3倍
		maxHeight = Math.max(maxHeight, config.baseHeight * textLengthFactor)

		// 特别长的文本需要更多行高
		if (maxTextLength > 100) {
			maxHeight = Math.max(maxHeight, config.baseHeight * 2.5)
		}
		if (maxTextLength > 200) {
			maxHeight = Math.max(maxHeight, config.baseHeight * 3.5)
		}
	}

	// 中文内容调整
	if (hasChineseContent) {
		maxHeight = Math.max(maxHeight, config.baseHeight * config.chineseMultiplier)

		// 中文长文本需要额外空间
		if (maxTextLength > 20) {
			maxHeight = Math.max(maxHeight, config.baseHeight * 1.5)
		}
	}

	// 应用行高限制
	return Math.max(config.minHeight, Math.min(config.maxHeight, Math.round(maxHeight)))
}

/**
 * 合并Excel原始行高和计算的行高
 * @param originalRowProperties Excel原始行属性
 * @param calculatedRowData 计算的行高数据
 * @param sheetsData 工作表数据
 * @returns 合并后的行高数据
 */
export function mergeRowHeights(
	originalRowProperties: any[],
	calculatedRowData: Record<string, any>,
	sheetsData: any[][],
): Record<string, any> {
	const mergedRowData: Record<string, any> = { ...calculatedRowData }

	// 处理Excel原始行属性
	originalRowProperties.forEach((rowProp, index) => {
		if (rowProp && (rowProp.height || rowProp.hpt || rowProp.hpx || rowProp.hidden)) {
			let height = DEFAULT_ROW_HEIGHT_CONFIG.baseHeight

			// 计算Excel行高
			if (rowProp.hpt && !rowProp.hpx) {
				height = Math.round(rowProp.hpt * 1.33) // 点数转像素
			} else if (rowProp.hpx) {
				height = rowProp.hpx // 像素值
			} else if (rowProp.height) {
				height = rowProp.height // 通用高度
			}

			// 如果Excel有明确的行高设置，使用Excel的值
			// 但仍然要考虑内容适配
			if (sheetsData[index]) {
				const contentHeight = calculateRowHeight(sheetsData[index])
				// 取Excel设置和内容计算的较大值
				height = Math.max(height, contentHeight)
			}

			mergedRowData[index.toString()] = {
				h: height,
				hd: rowProp.hidden ? 1 : 0,
				ah: height,
			}
		}
	})

	return mergedRowData
}

/**
 * 批量计算所有行的高度
 * @param sheetsData 工作表数据
 * @param config 行高配置
 * @returns 行高数据对象
 */
export function calculateAllRowHeights(
	sheetsData: any[][],
	config: RowHeightConfig = DEFAULT_ROW_HEIGHT_CONFIG,
): Record<string, any> {
	const rowData: Record<string, any> = {}

	if (!Array.isArray(sheetsData)) {
		return rowData
	}

	sheetsData.forEach((row, rowIndex) => {
		const height = calculateRowHeight(row, config)

		rowData[rowIndex.toString()] = {
			h: height, // 行高（像素）
			hd: 0, // 未隐藏
			ah: height, // 自适应高度
		}
	})

	return rowData
}

/**
 * 检测工作表是否包含中文内容
 * @param sheetsData 工作表数据
 * @returns 是否包含中文内容
 */
export function hasChineseContent(sheetsData: any[][]): boolean {
	if (!Array.isArray(sheetsData)) {
		return false
	}

	return sheetsData.some(
		(row) =>
			Array.isArray(row) &&
			row.some((cell) => {
				if (cell && typeof cell === "string") {
					return /[\u4e00-\u9fff]/.test(cell)
				}
				return false
			}),
	)
}

/**
 * 创建自定义行高配置
 * @param options 配置选项
 * @returns 行高配置对象
 */
export function createRowHeightConfig(options: Partial<RowHeightConfig> = {}): RowHeightConfig {
	return {
		...DEFAULT_ROW_HEIGHT_CONFIG,
		...options,
	}
}

/**
 * 导出默认配置
 */
export { DEFAULT_ROW_HEIGHT_CONFIG }
