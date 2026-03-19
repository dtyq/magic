/**
 * Excel文件处理工具模块
 * 处理Excel文件读取、工作表解析等
 */
import * as XLSX from "xlsx-js-style"

/**
 * 检测字符串是否为二进制Excel文件内容
 * @param data 需要检测的字符串
 * @returns 是否为Excel二进制内容
 */
export function isBinaryExcel(data: string): boolean {
	// Excel文件特征检测
	// 1. 文件头检测：XLSX/DOCX都是ZIP文件，以PK开头
	const hasPKHeader = data.startsWith("PK") || data.indexOf("PK") < 20

	// 2. 内部路径检测：检查是否包含Excel文件特有的路径
	const hasExcelPaths =
		data.includes("xl/worksheets") ||
		data.includes("docProps") ||
		data.includes("sheet.xml") ||
		data.includes("[Content_Types].xml")

	// 3. Office文档标记检测
	const hasOfficeMark =
		data.includes("Microsoft Excel") ||
		data.includes("spreadsheetml") ||
		data.includes("workbook")

	// 同时满足文件头特征和至少一种内容特征
	return hasPKHeader && (hasExcelPaths || hasOfficeMark)
}

/**
 * 使用xlsx库读取Excel文件
 * @param file Excel文件对象
 * @returns Excel数据的二维数组格式(默认返回第一个工作表数据)
 */
export async function readExcelFile(file: File): Promise<any[][]> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()

		reader.onload = (e) => {
			try {
				const data = e.target?.result
				// 读取Excel文件
				const workbook = XLSX.read(data, { type: "array" })

				// 获取第一个工作表
				const firstSheetName = workbook.SheetNames[0]
				const worksheet = workbook.Sheets[firstSheetName]

				// 将工作表转换为二维数组
				const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
				resolve(jsonData)
			} catch (error) {
				reject(error)
			}
		}

		reader.onerror = (error) => reject(error)
		reader.readAsArrayBuffer(file)
	})
}

/**
 * 读取Excel文件中的所有工作表（包含样式信息和隐藏状态）
 * @param file Excel文件对象
 * @returns 包含所有工作表数据和样式的对象
 *
 * 返回的对象结构：
 * {
 *   "工作表名称": {
 *     data: 二维数组,
 *     styles: 样式矩阵,
 *     hidden: 布尔值，表示工作表是否隐藏,
 *     rowProperties: 行属性（包含行高）,
 *     columnProperties: 列属性（包含列宽）,
 *     mergeRanges: 合并单元格信息,
 *     freezeInfo: 冻结窗格信息,
 *     ...其他属性
 *   }
 * }
 */
export async function readAllExcelSheets(file: File): Promise<Record<string, any>> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()

		reader.onload = (e) => {
			try {
				const data = e.target?.result
				// 读取Excel文件，启用完整的样式和内容读取
				const workbook = XLSX.read(data, {
					type: "array",
					cellStyles: true, // 读取单元格样式
					cellHTML: true, // 读取HTML格式内容 - 重要：支持富文本
					cellText: true, // 读取格式化文本内容
					cellDates: true, // 处理日期格式
					cellNF: true, // 读取数字格式
					sheetStubs: true, // 包含空单元格的存根
				})

				// 读取所有工作表
				const result: Record<string, any> = {}

				// 读取工作表的隐藏状态信息
				const sheetVisibility: Record<string, boolean> = {}
				if (workbook.Workbook && workbook.Workbook.Sheets) {
					workbook.Workbook.Sheets.forEach((sheetInfo: any, index: number) => {
						const sheetName = workbook.SheetNames[index]
						if (sheetName) {
							// Hidden属性：1 = 隐藏，0 = 可见，undefined = 可见
							sheetVisibility[sheetName] = sheetInfo.Hidden === 1
						}
					})
				}

				workbook.SheetNames.forEach((sheetName) => {
					const worksheet = workbook.Sheets[sheetName]

					// 获取工作表范围
					const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1")
					const sheetData: any[][] = []
					const sheetStyles: any[][] = []

					// 遍历每一行
					for (let R = range.s.r; R <= range.e.r; ++R) {
						const rowData: any[] = []
						const rowStyles: any[] = []

						// 遍历每一列
						for (let C = range.s.c; C <= range.e.c; ++C) {
							const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
							const cell = worksheet[cellAddress]

							if (cell) {
								// 获取单元格值 - 支持多种格式
								let cellValue = cell.v !== undefined ? cell.v : ""
								const htmlContent = cell.h || null // HTML格式内容
								const formattedText = cell.w || null // 格式化文本
								const numberFormat = cell.z || null // 数字格式
								const richText = cell.r || null // 富文本运行
								const formula = cell.f || null // 公式字符串

								// 优先使用格式化文本，回退到原始值
								if (formattedText && formattedText !== cellValue) {
									cellValue = formattedText
								}

								rowData[C] = cellValue

								// 获取单元格样式 - 需要从工作簿样式表中获取完整样式
								let cellStyle = null
								if (cell.s !== undefined) {
									// cell.s 是样式索引，需要从工作簿的样式表中获取完整样式
									if (typeof cell.s === "object") {
										// 如果 cell.s 本身就是样式对象，直接使用
										cellStyle = cell.s
									} else if (
										(workbook as any).SSF &&
										(workbook as any).SSF[cell.s]
									) {
										// 从工作簿样式表中查找
										cellStyle = (workbook as any).SSF[cell.s]
									} else {
										// 备用方案：直接使用 cell.s（可能是内联样式）
										cellStyle = cell.s
									}
								}

								// 保存增强的样式信息，包含额外的格式信息
								const enhancedStyle = cellStyle
									? {
											...cellStyle,
											// 添加额外的格式信息
											_htmlContent: htmlContent,
											_formattedText: formattedText,
											_numberFormat: numberFormat,
											_richText: richText,
											_formula: formula,
										}
									: formula
										? {
												// 如果没有样式但有公式，创建基础样式对象
												_formula: formula,
												_htmlContent: htmlContent,
												_formattedText: formattedText,
												_numberFormat: numberFormat,
												_richText: richText,
											}
										: null

								rowStyles[C] = enhancedStyle
							} else {
								rowData[C] = ""
								rowStyles[C] = null
							}
						}

						sheetData[R] = rowData
						sheetStyles[R] = rowStyles
					}

					// 读取行高度信息
					const rowProperties: any[] = []
					if (worksheet["!rows"]) {
						for (let i = 0; i < worksheet["!rows"].length; i++) {
							const row = worksheet["!rows"][i]
							if (row) {
								rowProperties[i] = {
									height: row.hpt || row.hpx, // 优先使用点数，回退到像素
									hidden: row.hidden || false,
									level: row.level || 0,
									// 保留原始数据
									hpt: row.hpt, // 点数高度
									hpx: row.hpx, // 像素高度
								}
							}
						}
					}

					// 读取列宽度信息
					const columnProperties: any[] = []
					if (worksheet["!cols"]) {
						for (let i = 0; i < worksheet["!cols"].length; i++) {
							const col = worksheet["!cols"][i]
							if (col) {
								columnProperties[i] = {
									width: col.width || col.wch || col.wpx, // 优先级：Excel单位 > 字符数 > 像素
									hidden: col.hidden || false,
									// 保留原始数据
									excelWidth: col.width, // Excel的"Max Digit Width"单位
									wch: col.wch, // 字符宽度
									wpx: col.wpx, // 像素宽度
									MDW: col.MDW, // Max Digit Width
								}
							}
						}
					}

					// 读取合并单元格信息
					const mergeRanges: any[] = []
					if (worksheet["!merges"]) {
						worksheet["!merges"].forEach((merge: any) => {
							// 验证合并范围的有效性
							if (
								merge.s &&
								merge.e &&
								merge.s.r >= 0 &&
								merge.s.c >= 0 &&
								merge.e.r >= merge.s.r &&
								merge.e.c >= merge.s.c
							) {
								mergeRanges.push({
									start: merge.s, // { r: 行索引, c: 列索引 }
									end: merge.e, // { r: 行索引, c: 列索引 }
								})
							}
						})
					}

					// 统计样式信息以供调试
					let borderCount = 0
					let fontCount = 0
					let fillCount = 0
					let formulaCount = 0

					sheetStyles.forEach((row) => {
						row.forEach((style) => {
							if (style) {
								if (style.border) borderCount++
								if (style.font) fontCount++
								if (style.fill || style.fgColor || style.bgColor) fillCount++
								if (style._formula) formulaCount++
							}
						})
					})

					// 读取冻结窗格信息
					const freezeInfo = extractFreezeInfo(worksheet)

					result[sheetName] = {
						data: sheetData,
						styles: sheetStyles,
						range: range,
						rowProperties: rowProperties, // 行属性（包含行高）
						columnProperties: columnProperties, // 列属性（包含列宽）
						mergeRanges: mergeRanges, // 合并单元格信息
						freezeInfo: freezeInfo, // 冻结窗格信息
						hidden: sheetVisibility[sheetName] || false, // 工作表隐藏状态
						// 保留原始的工作表行列信息以供高级用户使用
						rawRows: worksheet["!rows"],
						rawCols: worksheet["!cols"],
						// 添加样式统计信息
						styleStats: {
							borderCount,
							fontCount,
							fillCount,
							formulaCount,
						},
					}
				})
				resolve(result)
			} catch (error) {
				reject(error)
			}
		}

		reader.onerror = (error) => reject(error)
		reader.readAsArrayBuffer(file)
	})
}

/**
 * 读取文件为文本
 * @param file 文件对象
 * @returns 文件内容字符串
 */
export function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as string)
		reader.onerror = reject
		reader.readAsText(file)
	})
}

/**
 * 提取工作表冻结窗格信息
 * @param worksheet XLSX工作表对象
 * @returns 冻结窗格信息
 */
export function extractFreezeInfo(worksheet: any): any {
	const defaultFreeze = {
		startRow: -1,
		startColumn: -1,
		ySplit: 0,
		xSplit: 0,
	}

	// 检查是否有视图信息
	if (!worksheet["!panes"] && !worksheet["!freeze"]) {
		return defaultFreeze
	}

	try {
		// 处理冻结窗格信息
		const freezeInfo = { ...defaultFreeze }

		// 检查 !freeze 属性 (某些库使用这个)
		if (worksheet["!freeze"]) {
			const freeze = worksheet["!freeze"]
			freezeInfo.startRow = freeze.row || 0
			freezeInfo.startColumn = freeze.col || 0
			freezeInfo.ySplit = freeze.row || 0
			freezeInfo.xSplit = freeze.col || 0
		}

		// 检查 !panes 属性 (Excel标准格式)
		if (worksheet["!panes"]) {
			const panes = worksheet["!panes"]

			// Excel pane 格式通常包含多个窗格信息
			if (Array.isArray(panes) && panes.length > 0) {
				const topLeftPane = panes.find((pane) => pane.state === "frozen") || panes[0]

				if (topLeftPane) {
					// xSplit 和 ySplit 表示分割位置
					freezeInfo.xSplit = topLeftPane.xSplit || 0
					freezeInfo.ySplit = topLeftPane.ySplit || 0
					freezeInfo.startColumn = freezeInfo.xSplit
					freezeInfo.startRow = freezeInfo.ySplit
				}
			} else if (typeof panes === "object") {
				// 单个窗格对象
				freezeInfo.xSplit = panes.xSplit || 0
				freezeInfo.ySplit = panes.ySplit || 0
				freezeInfo.startColumn = freezeInfo.xSplit
				freezeInfo.startRow = freezeInfo.ySplit
			}
		}

		// 检查工作表视图信息
		if (worksheet["!views"] && worksheet["!views"][0]) {
			const view = worksheet["!views"][0]

			if (view.pane) {
				const pane = view.pane
				freezeInfo.xSplit = pane.xSplit || 0
				freezeInfo.ySplit = pane.ySplit || 0
				freezeInfo.startColumn = freezeInfo.xSplit
				freezeInfo.startRow = freezeInfo.ySplit
			}
		}

		return freezeInfo
	} catch (error) {
		console.error("Error extracting freeze info:", error)
		return defaultFreeze
	}
}

/**
 * 检测CSV文件编码
 * @param buffer 文件缓冲区
 * @returns 检测到的编码
 */
function detectCsvEncoding(buffer: ArrayBuffer): string {
	const uint8Array = new Uint8Array(buffer)
	const firstBytes = uint8Array.slice(0, 3)

	// 检测 BOM
	if (firstBytes[0] === 0xef && firstBytes[1] === 0xbb && firstBytes[2] === 0xbf) {
		return "utf-8"
	}
	if (firstBytes[0] === 0xff && firstBytes[1] === 0xfe) {
		return "utf-16le"
	}
	if (firstBytes[0] === 0xfe && firstBytes[1] === 0xff) {
		return "utf-16be"
	}

	// 尝试检测中文字符来判断编码
	const decoder = new TextDecoder("utf-8", { fatal: true })
	try {
		const text = decoder.decode(uint8Array)
		// 如果能正常解码且包含中文，认为是UTF-8
		if (/[\u4e00-\u9fff]/.test(text)) {
			return "utf-8"
		}
	} catch (e) {
		// UTF-8 解码失败，尝试 GBK
		return "gbk"
	}

	return "utf-8" // 默认UTF-8
}

/**
 * 智能检测CSV分隔符
 * @param csvContent CSV文本内容
 * @returns 检测到的分隔符
 */
function detectCsvDelimiter(csvContent: string): string {
	const lines = csvContent.split("\n").slice(0, 5) // 检查前5行
	const delimiters = [",", ";", "\t", "|"]
	const scores: Record<string, number> = {}

	delimiters.forEach((delimiter) => {
		let score = 0
		let consistency = 0
		const columnCounts: number[] = []

		lines.forEach((line) => {
			if (line.trim()) {
				const columns = line.split(delimiter).length
				columnCounts.push(columns)
				score += columns > 1 ? 1 : 0
			}
		})

		// 计算列数一致性
		if (columnCounts.length > 1) {
			const avgColumns = columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length
			consistency =
				1 -
				columnCounts.reduce((sum, count) => sum + Math.abs(count - avgColumns), 0) /
					columnCounts.length /
					avgColumns
		}

		scores[delimiter] = score * consistency
	})

	// 返回得分最高的分隔符
	return Object.entries(scores).reduce((a, b) => (scores[a[0]] > scores[b[0]] ? a : b))[0]
}

/**
 * 解析CSV行，正确处理引号和转义
 * @param line CSV行文本
 * @param delimiter 分隔符
 * @returns 解析后的单元格数组
 */
function parseCsvLine(line: string, delimiter: string): string[] {
	const result: string[] = []
	let current = ""
	let inQuotes = false
	let quoteChar = ""
	let i = 0

	while (i < line.length) {
		const char = line[i]
		const nextChar = line[i + 1]

		if (!inQuotes) {
			if (char === '"' || char === "'") {
				inQuotes = true
				quoteChar = char
			} else if (char === delimiter) {
				result.push(current.trim())
				current = ""
			} else {
				current += char
			}
		} else {
			if (char === quoteChar) {
				if (nextChar === quoteChar) {
					// 转义引号
					current += char
					i++ // 跳过下一个字符
				} else {
					// 结束引号
					inQuotes = false
					quoteChar = ""
				}
			} else {
				current += char
			}
		}

		i++
	}

	// 添加最后一个字段
	result.push(current.trim())

	return result
}

/**
 * 增强的CSV解析函数
 * @param csvContent CSV文本内容
 * @param options 解析选项
 * @returns 解析后的二维数组
 */
export function parseEnhancedCsv(
	csvContent: string,
	options: {
		delimiter?: string
		hasHeader?: boolean
		encoding?: string
		maxRows?: number
	} = {},
): {
	data: any[][]
	delimiter: string
	hasHeader: boolean
	rowCount: number
	columnCount: number
} {
	if (!csvContent) {
		return {
			data: [],
			delimiter: ",",
			hasHeader: false,
			rowCount: 0,
			columnCount: 0,
		}
	}

	// 检测分隔符
	const delimiter = options.delimiter || detectCsvDelimiter(csvContent)

	// 按行分割
	const lines = csvContent.split(/\r?\n/)
	const data: any[][] = []
	let maxColumns = 0

	// 解析每一行
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		// 跳过空行
		if (!line.trim()) continue

		// 应用行数限制
		if (options.maxRows && data.length >= options.maxRows) {
			break
		}

		// 解析行
		const row = parseCsvLine(line, delimiter)
		maxColumns = Math.max(maxColumns, row.length)
		data.push(row)
	}

	// 检测是否有标题行
	const hasHeader = options.hasHeader !== undefined ? options.hasHeader : detectCsvHeader(data)

	return {
		data: data,
		delimiter: delimiter,
		hasHeader: hasHeader,
		rowCount: data.length,
		columnCount: maxColumns,
	}
}

/**
 * 检测CSV是否有标题行
 * @param data 解析后的数据
 * @returns 是否有标题行
 */
function detectCsvHeader(data: any[][]): boolean {
	if (data.length < 2) return false

	const firstRow = data[0]
	const secondRow = data[1]

	// 检查第一行是否都是文本，而第二行包含数字
	let firstRowAllText = true
	let secondRowHasNumbers = false

	for (let i = 0; i < Math.min(firstRow.length, secondRow.length); i++) {
		const firstCell = firstRow[i]
		const secondCell = secondRow[i]

		// 检查第一行是否为数字
		if (!isNaN(Number(firstCell)) && firstCell !== "") {
			firstRowAllText = false
		}

		// 检查第二行是否包含数字
		if (!isNaN(Number(secondCell)) && secondCell !== "") {
			secondRowHasNumbers = true
		}
	}

	// 如果第一行全是文本，第二行有数字，可能有标题
	return firstRowAllText && secondRowHasNumbers
}

/**
 * 读取CSV文件（增强版）
 * @param file CSV文件对象
 * @param options 读取选项
 * @returns 解析后的CSV数据
 */
export async function readEnhancedCsvFile(
	file: File,
	options: {
		delimiter?: string
		hasHeader?: boolean
		maxRows?: number
	} = {},
): Promise<{
	data: any[][]
	delimiter: string
	hasHeader: boolean
	rowCount: number
	columnCount: number
	fileName: string
}> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()

		reader.onload = (e) => {
			try {
				const arrayBuffer = e.target?.result as ArrayBuffer

				// 检测编码
				const encoding = detectCsvEncoding(arrayBuffer)

				// 解码文本
				const decoder = new TextDecoder(encoding === "gbk" ? "gbk" : "utf-8")
				const csvContent = decoder.decode(arrayBuffer)

				// 解析CSV
				const result = parseEnhancedCsv(csvContent, options)

				resolve({
					...result,
					fileName: file.name,
				})
			} catch (error) {
				reject(error)
			}
		}

		reader.onerror = (error) => reject(error)
		reader.readAsArrayBuffer(file)
	})
}

/**
 * 将CSV文本内容转换为二维数组（兼容旧版本）
 * @param csvContent CSV文本内容
 * @returns 二维数组格式的数据
 */
export function parseCsvToArray(csvContent: string): any[][] {
	// 使用增强解析器，但保持向后兼容
	const result = parseEnhancedCsv(csvContent)
	return result.data
}
