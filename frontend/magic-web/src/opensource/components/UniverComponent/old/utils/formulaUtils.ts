/**
 * 公式处理工具模块
 * 处理Excel公式解析、转换和基础计算
 */

/**
 * Excel公式类型定义
 */
interface ExcelFormula {
	formula: string // 原始公式文本
	dependencies: string[] // 引用的单元格
	isValid: boolean // 公式是否有效
	parseError?: string // 解析错误信息
}

/**
 * 基础函数映射表 - Excel函数到Univer函数的映射
 */
const FUNCTION_MAPPING: Record<string, string> = {
	// 数学函数
	SUM: "SUM",
	AVERAGE: "AVERAGE",
	COUNT: "COUNT",
	COUNTA: "COUNTA",
	MAX: "MAX",
	MIN: "MIN",
	ROUND: "ROUND",
	ABS: "ABS",
	SQRT: "SQRT",
	POWER: "POWER",

	// 逻辑函数
	IF: "IF",
	AND: "AND",
	OR: "OR",
	NOT: "NOT",
	TRUE: "TRUE",
	FALSE: "FALSE",

	// 文本函数
	CONCATENATE: "CONCATENATE",
	LEFT: "LEFT",
	RIGHT: "RIGHT",
	MID: "MID",
	LEN: "LEN",
	UPPER: "UPPER",
	LOWER: "LOWER",
	TRIM: "TRIM",

	// 日期函数
	TODAY: "TODAY",
	NOW: "NOW",
	DATE: "DATE",
	YEAR: "YEAR",
	MONTH: "MONTH",
	DAY: "DAY",

	// 查找引用函数
	VLOOKUP: "VLOOKUP",
	HLOOKUP: "HLOOKUP",
	INDEX: "INDEX",
	MATCH: "MATCH",
}

/**
 * 单元格引用正则表达式
 * 匹配如：A1, $A$1, A1:B10, Sheet1!A1 等格式
 */
const CELL_REFERENCE_REGEX = /(?:([^!]+)!)?\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?/g

/**
 * 函数调用正则表达式
 * 匹配如：SUM(A1:B10), IF(A1>0, "是", "否") 等格式
 */
const FUNCTION_CALL_REGEX = /([A-Z][A-Z0-9_]*)\s*\(/g

/**
 * 解析Excel公式
 * @param formula Excel公式字符串（包含或不包含前导=）
 * @returns 解析后的公式对象
 */
export function parseExcelFormula(formula: string): ExcelFormula {
	if (!formula) {
		return {
			formula: "",
			dependencies: [],
			isValid: false,
			parseError: "公式为空",
		}
	}

	// 清理公式文本
	const cleanFormula = formula.trim()
	const actualFormula = cleanFormula.startsWith("=") ? cleanFormula.slice(1) : cleanFormula

	try {
		// 提取单元格引用
		const dependencies = extractCellReferences(actualFormula)

		// 验证函数调用
		const isValid = validateFormula(actualFormula)

		return {
			formula: actualFormula,
			dependencies: dependencies,
			isValid: isValid,
		}
	} catch (error) {
		console.error("公式解析错误:", error)
		return {
			formula: actualFormula,
			dependencies: [],
			isValid: false,
			parseError: error instanceof Error ? error.message : "未知解析错误",
		}
	}
}

/**
 * 提取公式中的单元格引用
 * @param formula 公式字符串
 * @returns 单元格引用数组
 */
function extractCellReferences(formula: string): string[] {
	const references: string[] = []
	let match

	// 重置正则表达式的lastIndex
	CELL_REFERENCE_REGEX.lastIndex = 0

	while ((match = CELL_REFERENCE_REGEX.exec(formula)) !== null) {
		const [fullMatch, sheetName, startCol, startRow, endCol, endRow] = match

		if (endCol && endRow) {
			// 范围引用 (如 A1:B10)
			const rangeRef = sheetName
				? `${sheetName}!${startCol}${startRow}:${endCol}${endRow}`
				: `${startCol}${startRow}:${endCol}${endRow}`
			references.push(rangeRef)
		} else {
			// 单个单元格引用 (如 A1)
			const cellRef = sheetName
				? `${sheetName}!${startCol}${startRow}`
				: `${startCol}${startRow}`
			references.push(cellRef)
		}
	}

	return [...new Set(references)] // 去重
}

/**
 * 验证公式是否有效
 * @param formula 公式字符串
 * @returns 是否有效
 */
function validateFormula(formula: string): boolean {
	try {
		// 基础语法检查
		if (!formula || formula.length === 0) return false

		// 检查括号是否匹配
		if (!areParenthesesBalanced(formula)) return false

		// 检查函数是否支持
		const functions = extractFunctions(formula)
		for (const func of functions) {
			if (!FUNCTION_MAPPING[func.toUpperCase()]) {
				console.warn(`不支持的函数: ${func}`)
				// 暂时不返回false，允许使用未知函数
			}
		}

		return true
	} catch (error) {
		console.error("公式验证错误:", error)
		return false
	}
}

/**
 * 检查括号是否匹配
 * @param formula 公式字符串
 * @returns 括号是否平衡
 */
function areParenthesesBalanced(formula: string): boolean {
	let depth = 0
	let inString = false
	let stringChar = ""

	for (let i = 0; i < formula.length; i++) {
		const char = formula[i]

		// 处理字符串
		if ((char === '"' || char === "'") && !inString) {
			inString = true
			stringChar = char
			continue
		}

		if (char === stringChar && inString) {
			// 检查是否是转义字符
			if (i > 0 && formula[i - 1] !== "\\") {
				inString = false
				stringChar = ""
			}
			continue
		}

		if (inString) continue

		// 检查括号
		if (char === "(") {
			depth++
		} else if (char === ")") {
			depth--
			if (depth < 0) return false
		}
	}

	return depth === 0 && !inString
}

/**
 * 提取公式中的函数名
 * @param formula 公式字符串
 * @returns 函数名数组
 */
function extractFunctions(formula: string): string[] {
	const functions: string[] = []
	let match

	// 重置正则表达式的lastIndex
	FUNCTION_CALL_REGEX.lastIndex = 0

	while ((match = FUNCTION_CALL_REGEX.exec(formula)) !== null) {
		functions.push(match[1])
	}

	return [...new Set(functions)] // 去重
}

/**
 * 将Excel公式转换为Univer公式格式
 * @param excelFormula Excel公式字符串
 * @returns Univer格式的公式
 */
export function convertFormulaToUniver(excelFormula: string): string {
	if (!excelFormula) return ""

	let univerFormula = excelFormula

	// 确保公式以=开头
	if (!univerFormula.startsWith("=")) {
		univerFormula = "=" + univerFormula
	}

	// 转换函数名（如果需要映射）
	Object.entries(FUNCTION_MAPPING).forEach(([excelFunc, univerFunc]) => {
		if (excelFunc !== univerFunc) {
			const regex = new RegExp(`\\b${excelFunc}\\(`, "gi")
			univerFormula = univerFormula.replace(regex, `${univerFunc}(`)
		}
	})

	// 转换单元格引用格式（如果需要）
	// 目前Univer和Excel的单元格引用格式基本兼容，暂不需要转换

	return univerFormula
}

/**
 * 获取公式依赖的单元格范围
 * @param formula 公式字符串
 * @returns 依赖的单元格范围信息
 */
export function getFormulaDependencies(formula: string): Array<{
	type: "cell" | "range"
	sheet?: string
	startCell: string
	endCell?: string
	reference: string
}> {
	const dependencies: Array<{
		type: "cell" | "range"
		sheet?: string
		startCell: string
		endCell?: string
		reference: string
	}> = []

	let match
	CELL_REFERENCE_REGEX.lastIndex = 0

	while ((match = CELL_REFERENCE_REGEX.exec(formula)) !== null) {
		const [fullMatch, sheetName, startCol, startRow, endCol, endRow] = match

		if (endCol && endRow) {
			// 范围引用
			dependencies.push({
				type: "range",
				sheet: sheetName,
				startCell: `${startCol}${startRow}`,
				endCell: `${endCol}${endRow}`,
				reference: fullMatch,
			})
		} else {
			// 单个单元格引用
			dependencies.push({
				type: "cell",
				sheet: sheetName,
				startCell: `${startCol}${startRow}`,
				reference: fullMatch,
			})
		}
	}

	return dependencies
}

/**
 * 检查公式是否包含循环引用
 * @param formula 公式字符串
 * @param currentCell 当前单元格位置
 * @returns 是否包含循环引用
 */
export function hasCircularReference(formula: string, currentCell: string): boolean {
	const dependencies = extractCellReferences(formula)

	// 简单的循环引用检查
	return dependencies.some((dep) => {
		// 移除工作表前缀进行比较
		const depCell = dep.includes("!") ? dep.split("!")[1] : dep
		const currentCellName = currentCell.includes("!") ? currentCell.split("!")[1] : currentCell

		return depCell === currentCellName
	})
}

/**
 * 获取支持的函数列表
 * @returns 支持的函数名数组
 */
export function getSupportedFunctions(): string[] {
	return Object.keys(FUNCTION_MAPPING)
}

/**
 * 检查函数是否被支持
 * @param functionName 函数名
 * @returns 是否支持
 */
export function isFunctionSupported(functionName: string): boolean {
	return functionName.toUpperCase() in FUNCTION_MAPPING
}

/**
 * 创建公式测试数据
 * @returns 包含各种公式的测试数据
 */
export function createFormulaTestData(): Array<{
	formula: string
	description: string
	expectedValid: boolean
}> {
	return [
		{
			formula: "=SUM(A1:A10)",
			description: "基础求和公式",
			expectedValid: true,
		},
		{
			formula: "=AVERAGE(B1:B5)",
			description: "平均值公式",
			expectedValid: true,
		},
		{
			formula: '=IF(C1>100, "优秀", "一般")',
			description: "条件判断公式",
			expectedValid: true,
		},
		{
			formula: "=VLOOKUP(D1, Sheet2!A:B, 2, FALSE)",
			description: "垂直查找公式",
			expectedValid: true,
		},
		{
			formula: "=A1+B1*C1",
			description: "算术运算公式",
			expectedValid: true,
		},
		{
			formula: '=CONCATENATE(E1, " ", F1)',
			description: "文本连接公式",
			expectedValid: true,
		},
		{
			formula: "=TODAY()",
			description: "当前日期公式",
			expectedValid: true,
		},
		{
			formula: "=SUM(A1:A10)+AVERAGE(B1:B10)",
			description: "复合公式",
			expectedValid: true,
		},
		{
			formula: "=UNKNOWN_FUNCTION(A1)",
			description: "不支持的函数",
			expectedValid: true, // 允许未知函数，但会警告
		},
		{
			formula: "=SUM(A1:A10",
			description: "括号不匹配的无效公式",
			expectedValid: false,
		},
	]
}
