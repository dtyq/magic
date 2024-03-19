/**
 * UniverComponent工具模块入口文件
 * 重新导出所有工具函数以保持向后兼容性
 */

// 颜色处理工具
export {
	EXCEL_INDEXED_COLORS,
	getExcelIndexedColor,
	normalizeColor,
	processExcelColor,
	adjustColorBrightness,
} from "./colorUtils"

// Excel文件处理工具
export {
	isBinaryExcel,
	readExcelFile,
	readAllExcelSheets,
	readFileAsText,
	parseCsvToArray,
	parseEnhancedCsv,
	readEnhancedCsvFile,
	extractFreezeInfo,
} from "./excelUtils"

// 文本处理工具
export { convertHtmlToRichText, processExcelRichText } from "./textUtils"

// 样式转换工具
export { convertExcelStyleToUniver } from "./styleUtils"

// 数据转换工具
export {
	transformData,
	transformDataForDoc,
	transformDataForSheet,
	transformDataForSlide,
	transformMultiSheetsToWorkbookData,
	transformToWorkbookData,
	transformToDocumentData,
	transformToSlidesData,
} from "./transformUtils"

// 测试工具
export {
	createBorderTestWorkbook,
	createMergeTestCSV,
	createEnhancedStyleTestWorkbook,
} from "./testUtils"

// 默认样式工具
export {
	getDefaultCellStyle,
	createDefaultStylesMap,
	getDefaultStyleId,
	mergeWithDefaultStyle,
} from "./defaultStyles"

// 公式处理工具
export {
	parseExcelFormula,
	convertFormulaToUniver,
	getFormulaDependencies,
	hasCircularReference,
	getSupportedFunctions,
	isFunctionSupported,
	createFormulaTestData,
} from "./formulaUtils"

// 数据验证工具
export {
	extractDataValidations,
	convertValidationToUniver,
	createValidationTestData,
} from "./validationUtils"

// 行高优化工具
export {
	calculateRowHeight,
	calculateRowHeightWithColumns,
	calculateAllRowHeights,
	mergeRowHeights,
	hasChineseContent,
	getContentStatistics,
	createRowHeightConfig,
	DEFAULT_ROW_HEIGHT_CONFIG,
} from "./rowHeightUtils"
