/**
 * 数据验证工具模块
 * 处理Excel数据验证规则的解析和转换
 */

/**
 * Excel数据验证类型枚举
 */
enum ExcelValidationType {
	NONE = "none",
	WHOLE = "whole", // 整数
	DECIMAL = "decimal", // 小数
	LIST = "list", // 列表
	DATE = "date", // 日期
	TIME = "time", // 时间
	TEXT_LENGTH = "textLength", // 文本长度
	CUSTOM = "custom", // 自定义公式
}

/**
 * Excel数据验证操作符枚举
 */
enum ExcelValidationOperator {
	BETWEEN = "between",
	NOT_BETWEEN = "notBetween",
	EQUAL = "equal",
	NOT_EQUAL = "notEqual",
	GREATER_THAN = "greaterThan",
	LESS_THAN = "lessThan",
	GREATER_THAN_OR_EQUAL = "greaterThanOrEqual",
	LESS_THAN_OR_EQUAL = "lessThanOrEqual",
}

/**
 * 数据验证规则接口
 */
interface DataValidationRule {
	type: ExcelValidationType
	operator?: ExcelValidationOperator
	allowBlank: boolean
	showInputMessage: boolean
	showErrorMessage: boolean

	// 输入提示
	inputTitle?: string
	inputMessage?: string

	// 错误提示
	errorStyle?: "stop" | "warning" | "information"
	errorTitle?: string
	errorMessage?: string

	// 验证条件
	formula1?: string // 主要条件或列表源
	formula2?: string // 次要条件（用于between等操作）

	// 列表相关
	listSource?: string[] // 下拉列表选项
	inCellDropdown?: boolean // 是否显示下拉箭头

	// 范围信息
	sqref?: string // 应用范围（如 "A1:B10"）
}

/**
 * Univer数据验证格式
 */
interface UniverDataValidation {
	type: "list" | "whole" | "decimal" | "date" | "time" | "textLength" | "custom"
	operator?: string
	formula1?: string
	formula2?: string
	allowBlank?: boolean
	showInputMessage?: boolean
	showErrorMessage?: boolean
	promptTitle?: string
	prompt?: string
	errorTitle?: string
	error?: string
	errorStyle?: string
}

/**
 * 从Excel工作表中提取数据验证规则
 * @param worksheet XLSX工作表对象
 * @returns 数据验证规则数组
 */
export function extractDataValidations(worksheet: any): Map<string, DataValidationRule> {
	const validations = new Map<string, DataValidationRule>()

	if (!worksheet["!dataValidations"]) {
		console.log("📋 No data validations found in worksheet")
		return validations
	}

	const dvs = worksheet["!dataValidations"]
	console.log("📋 Found data validations:", dvs)

	dvs.forEach((dv: any, index: number) => {
		try {
			const rule = parseDataValidationRule(dv)
			if (rule && rule.sqref) {
				// 解析应用范围
				const ranges = parseValidationRange(rule.sqref)
				ranges.forEach((range) => {
					validations.set(range, rule)
				})
			}
		} catch (error) {
			console.error(`Failed to parse validation rule ${index + 1}:`, error)
		}
	})

	return validations
}

/**
 * 解析单个数据验证规则
 * @param dv Excel数据验证对象
 * @returns 解析后的数据验证规则
 */
function parseDataValidationRule(dv: any): DataValidationRule | null {
	if (!dv) return null

	try {
		const rule: DataValidationRule = {
			type: mapValidationType(dv.type || "none"),
			operator: mapValidationOperator(dv.operator),
			allowBlank: dv.allowBlank !== false,
			showInputMessage: dv.showInputMessage !== false,
			showErrorMessage: dv.showErrorMessage !== false,
			sqref: dv.sqref,
		}

		// 输入提示信息
		if (dv.promptTitle) rule.inputTitle = dv.promptTitle
		if (dv.prompt) rule.inputMessage = dv.prompt

		// 错误提示信息
		if (dv.errorStyle) rule.errorStyle = dv.errorStyle
		if (dv.errorTitle) rule.errorTitle = dv.errorTitle
		if (dv.error) rule.errorMessage = dv.error

		// 验证公式
		if (dv.formula1) rule.formula1 = dv.formula1
		if (dv.formula2) rule.formula2 = dv.formula2

		// 处理列表类型的特殊情况
		if (rule.type === ExcelValidationType.LIST) {
			rule.inCellDropdown = dv.showDropDown !== false

			// 解析列表源
			if (rule.formula1) {
				rule.listSource = parseListSource(rule.formula1)
			}
		}

		return rule
	} catch (error) {
		console.error("Error parsing data validation rule:", error)
		return null
	}
}

/**
 * 映射Excel验证类型到内部类型
 * @param excelType Excel验证类型
 * @returns 内部验证类型
 */
function mapValidationType(excelType: string): ExcelValidationType {
	const typeMap: Record<string, ExcelValidationType> = {
		none: ExcelValidationType.NONE,
		whole: ExcelValidationType.WHOLE,
		decimal: ExcelValidationType.DECIMAL,
		list: ExcelValidationType.LIST,
		date: ExcelValidationType.DATE,
		time: ExcelValidationType.TIME,
		textLength: ExcelValidationType.TEXT_LENGTH,
		custom: ExcelValidationType.CUSTOM,
	}

	return typeMap[excelType] || ExcelValidationType.NONE
}

/**
 * 映射Excel验证操作符到内部操作符
 * @param excelOperator Excel操作符
 * @returns 内部操作符
 */
function mapValidationOperator(excelOperator?: string): ExcelValidationOperator | undefined {
	if (!excelOperator) return undefined

	const operatorMap: Record<string, ExcelValidationOperator> = {
		between: ExcelValidationOperator.BETWEEN,
		notBetween: ExcelValidationOperator.NOT_BETWEEN,
		equal: ExcelValidationOperator.EQUAL,
		notEqual: ExcelValidationOperator.NOT_EQUAL,
		greaterThan: ExcelValidationOperator.GREATER_THAN,
		lessThan: ExcelValidationOperator.LESS_THAN,
		greaterThanOrEqual: ExcelValidationOperator.GREATER_THAN_OR_EQUAL,
		lessThanOrEqual: ExcelValidationOperator.LESS_THAN_OR_EQUAL,
	}

	return operatorMap[excelOperator]
}

/**
 * 解析列表数据源
 * @param formula1 列表公式
 * @returns 列表选项数组
 */
function parseListSource(formula1: string): string[] {
	if (!formula1) return []

	// 处理直接的逗号分隔列表 "选项1,选项2,选项3"
	if (formula1.startsWith('"') && formula1.endsWith('"')) {
		const content = formula1.slice(1, -1)
		return content.split(",").map((item) => item.trim())
	}

	// 处理单元格范围引用 如 "Sheet1!A1:A10"
	if (formula1.includes(":") || formula1.includes("!")) {
		// 暂时返回引用信息，实际应用中需要解析引用的单元格值
		return [`引用: ${formula1}`]
	}

	// 处理其他格式
	return [formula1]
}

/**
 * 解析验证应用范围
 * @param sqref 范围字符串 如 "A1:B10 C1:D5"
 * @returns 单元格位置数组
 */
function parseValidationRange(sqref: string): string[] {
	const ranges: string[] = []

	if (!sqref) return ranges

	// 分割多个范围
	const rangeStrings = sqref.split(/\s+/)

	rangeStrings.forEach((rangeStr) => {
		if (rangeStr.includes(":")) {
			// 范围格式 "A1:B10"
			const [start, end] = rangeStr.split(":")
			const expandedCells = expandCellRange(start, end)
			ranges.push(...expandedCells)
		} else {
			// 单个单元格
			ranges.push(rangeStr)
		}
	})

	return ranges
}

/**
 * 展开单元格范围
 * @param startCell 起始单元格 如 "A1"
 * @param endCell 结束单元格 如 "B10"
 * @returns 范围内所有单元格数组
 */
function expandCellRange(startCell: string, endCell: string): string[] {
	const cells: string[] = []

	// 解析起始位置
	const startMatch = startCell.match(/([A-Z]+)(\d+)/)
	const endMatch = endCell.match(/([A-Z]+)(\d+)/)

	if (!startMatch || !endMatch) return [startCell]

	const startCol = columnToNumber(startMatch[1])
	const startRow = parseInt(startMatch[2])
	const endCol = columnToNumber(endMatch[1])
	const endRow = parseInt(endMatch[2])

	// 生成范围内所有单元格
	for (let row = startRow; row <= endRow; row++) {
		for (let col = startCol; col <= endCol; col++) {
			const cellAddress = numberToColumn(col) + row
			cells.push(cellAddress)
		}
	}

	return cells
}

/**
 * 列字母转数字
 * @param column 列字母 如 "A", "AB"
 * @returns 列数字 (A=1, B=2, ...)
 */
function columnToNumber(column: string): number {
	let result = 0
	for (let i = 0; i < column.length; i++) {
		result = result * 26 + (column.charCodeAt(i) - 64)
	}
	return result
}

/**
 * 数字转列字母
 * @param number 列数字 (1=A, 2=B, ...)
 * @returns 列字母
 */
function numberToColumn(number: number): string {
	let result = ""
	while (number > 0) {
		number--
		result = String.fromCharCode(65 + (number % 26)) + result
		number = Math.floor(number / 26)
	}
	return result
}

/**
 * 将数据验证规则转换为Univer格式
 * @param rule Excel数据验证规则
 * @returns Univer格式的数据验证
 */
export function convertValidationToUniver(rule: DataValidationRule): UniverDataValidation {
	const univerValidation: UniverDataValidation = {
		type: mapTypeToUniver(rule.type) as UniverDataValidation["type"],
		allowBlank: rule.allowBlank,
		showInputMessage: rule.showInputMessage,
		showErrorMessage: rule.showErrorMessage,
	}

	// 操作符
	if (rule.operator) {
		univerValidation.operator = rule.operator
	}

	// 公式
	if (rule.formula1) {
		univerValidation.formula1 = rule.formula1
	}
	if (rule.formula2) {
		univerValidation.formula2 = rule.formula2
	}

	// 输入提示
	if (rule.inputTitle) {
		univerValidation.promptTitle = rule.inputTitle
	}
	if (rule.inputMessage) {
		univerValidation.prompt = rule.inputMessage
	}

	// 错误提示
	if (rule.errorTitle) {
		univerValidation.errorTitle = rule.errorTitle
	}
	if (rule.errorMessage) {
		univerValidation.error = rule.errorMessage
	}
	if (rule.errorStyle) {
		univerValidation.errorStyle = rule.errorStyle
	}

	return univerValidation
}

/**
 * 映射验证类型到Univer格式
 * @param type Excel验证类型
 * @returns Univer验证类型
 */
function mapTypeToUniver(type: ExcelValidationType): string {
	const typeMap: Record<ExcelValidationType, string> = {
		[ExcelValidationType.NONE]: "custom",
		[ExcelValidationType.WHOLE]: "whole",
		[ExcelValidationType.DECIMAL]: "decimal",
		[ExcelValidationType.LIST]: "list",
		[ExcelValidationType.DATE]: "date",
		[ExcelValidationType.TIME]: "time",
		[ExcelValidationType.TEXT_LENGTH]: "textLength",
		[ExcelValidationType.CUSTOM]: "custom",
	}

	return typeMap[type] || "custom"
}

/**
 * 创建数据验证测试数据
 * @returns 测试用的数据验证规则
 */
export function createValidationTestData(): DataValidationRule[] {
	return [
		{
			type: ExcelValidationType.LIST,
			allowBlank: true,
			showInputMessage: true,
			showErrorMessage: true,
			inputTitle: "请选择",
			inputMessage: "请从下拉列表中选择一个选项",
			errorTitle: "输入错误",
			errorMessage: "您输入的值不在允许的列表中",
			errorStyle: "stop",
			formula1: '"优秀,良好,一般,较差"',
			listSource: ["优秀", "良好", "一般", "较差"],
			inCellDropdown: true,
			sqref: "A1:A10",
		},
		{
			type: ExcelValidationType.WHOLE,
			operator: ExcelValidationOperator.BETWEEN,
			allowBlank: false,
			showInputMessage: true,
			showErrorMessage: true,
			inputTitle: "年龄输入",
			inputMessage: "请输入1到100之间的整数",
			errorTitle: "年龄错误",
			errorMessage: "年龄必须是1到100之间的整数",
			errorStyle: "stop",
			formula1: "1",
			formula2: "100",
			sqref: "B1:B100",
		},
		{
			type: ExcelValidationType.DATE,
			operator: ExcelValidationOperator.GREATER_THAN,
			allowBlank: true,
			showInputMessage: true,
			showErrorMessage: true,
			inputTitle: "日期输入",
			inputMessage: "请输入今天之后的日期",
			errorTitle: "日期错误",
			errorMessage: "日期必须晚于今天",
			errorStyle: "warning",
			formula1: "TODAY()",
			sqref: "C1:C50",
		},
		{
			type: ExcelValidationType.TEXT_LENGTH,
			operator: ExcelValidationOperator.LESS_THAN_OR_EQUAL,
			allowBlank: true,
			showInputMessage: true,
			showErrorMessage: true,
			inputTitle: "备注输入",
			inputMessage: "备注内容不能超过200个字符",
			errorTitle: "文本过长",
			errorMessage: "备注内容超出200字符限制",
			errorStyle: "information",
			formula1: "200",
			sqref: "D1:D1000",
		},
	]
}
