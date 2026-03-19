/**
 * 样式处理模块入口文件
 * 专门处理 Excel 到 Univer 的样式转换
 */

// 颜色处理工具
export {
	EXCEL_INDEXED_COLORS,
	getExcelIndexedColor,
	normalizeColor,
	processExcelColor,
	adjustColorBrightness,
} from "./color-utils"

// 样式转换工具
export { convertExcelStyleToUniver } from "./style-converter"

// 默认样式工具
export {
	getDefaultCellStyle,
	createDefaultStylesMap,
	getDefaultStyleId,
	mergeWithDefaultStyle,
} from "./default-styles"

// 文本和富文本处理
export { convertHtmlToRichText, processExcelRichText } from "./text-processor"
