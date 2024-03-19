import type { IWorkbookData, IWorksheetData, ICellData } from "@univerjs/core"
import { CellValueType } from "@univerjs/core"
import * as XLSX from "xlsx-js-style"
import { transformExcelToUniverWorkbook } from "./data-converter"

/** 单元格对象接口 */
interface CellWithFormat {
	z?: string | number
}

/** 转换单元格格式（仅数字格式） */
function transformCellFormat(cell: CellWithFormat): Record<string, unknown> | undefined {
	const result: Record<string, unknown> = {}

	// 处理数字格式（Excel 的 z 属性）
	if (cell.z) {
		result.n = {
			pattern: String(cell.z),
		}
	}

	return Object.keys(result).length > 0 ? result : undefined
}

/**
 * 将 xlsx-js-style 的 ExcelDataType 转换为 UniverJS 的 CellValueType
 * @param excelType xlsx-js-style 的数据类型 (b|n|e|s|d|z)
 * @param value 单元格的值
 * @returns UniverJS 的 CellValueType
 */
function convertExcelTypeToUniverType(
	excelType: XLSX.ExcelDataType,
	value: unknown,
): CellValueType {
	switch (excelType) {
		case "b": // Boolean
			return CellValueType.BOOLEAN
		case "n": // Number
			return CellValueType.NUMBER
		case "d": // Date (treated as number in UniverJS)
			return CellValueType.NUMBER
		case "s": // String
			return CellValueType.STRING
		case "e": // Error (treated as string)
			return CellValueType.STRING
		case "z": // Empty/Stub
			return CellValueType.STRING
		default:
			// 如果没有明确类型，根据值的类型推断
			if (typeof value === "boolean") return CellValueType.BOOLEAN
			if (typeof value === "number") return CellValueType.NUMBER
			return CellValueType.STRING
	}
}

/**
 * 从 xlsx-js-style 的 CellObject 创建 UniverJS 的 ICellData
 * @param xlsxCell xlsx-js-style 的单元格对象
 * @returns UniverJS 的 ICellData 对象
 */
function createUniverCellData(xlsxCell: XLSX.CellObject): ICellData {
	const cellData: ICellData = {}
	// 设置值和类型
	if (xlsxCell.v !== undefined && xlsxCell.v !== null) {
		// 直接使用原值和转换后的类型
		cellData.v = xlsxCell.v as string | number | boolean
		if (xlsxCell.t) {
			cellData.t = convertExcelTypeToUniverType(xlsxCell.t, xlsxCell.v)
		}
	}
	// 如果有公式，设置公式
	if (xlsxCell.f) {
		cellData.f = xlsxCell.f
	}
	// 转换格式信息（仅数字格式）
	if (xlsxCell.z) {
		const format = transformCellFormat(xlsxCell)
		if (format) {
			cellData.s = format
		}
	}
	return cellData
}

/** 将二维数组转换为工作表 */
function transformArrayToSheet(
	sheetId: string,
	sheetName: string,
	data: unknown[][],
): Partial<IWorksheetData> {
	const cellData: Record<string, Record<string, ICellData>> = {}
	let maxColumnCount = 0

	data.forEach((row, rowIndex) => {
		if (!Array.isArray(row)) return
		const rowData: Record<string, ICellData> = {}

		// 更新最大列数
		maxColumnCount = Math.max(maxColumnCount, row.length)

		row.forEach((cell, colIndex) => {
			if (cell !== null && cell !== undefined) {
				rowData[colIndex.toString()] = {
					v: cell as string | number | boolean,
					t: typeof cell === "number" ? 2 : 1,
				}
			}
		})
		if (Object.keys(rowData).length > 0) {
			cellData[rowIndex.toString()] = rowData
		}
	})

	const finalColumnCount = Math.max(maxColumnCount, 26)

	return {
		id: sheetId,
		name: sheetName,
		rowCount: data.length, // ✅ 添加行数
		columnCount: finalColumnCount, // ✅ 添加列数，最少26列（A-Z）
		cellData,
	}
}

/** 转换二维数组数据 */
function transformArrayData(data: unknown[][], fileName: string): Partial<IWorkbookData> {
	return {
		id: "workbook1",
		name: fileName,
		sheetOrder: ["sheet1"],
		sheets: {
			sheet1: transformArrayToSheet("sheet1", "Sheet1", data),
		},
	}
}

/** 读取文件为文本 */
function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = (e) => resolve((e.target?.result as string) || "")
		reader.onerror = (error) => reject(error)
		reader.readAsText(file, "utf-8")
	})
}

/** 将 CSV 数据转换为工作簿格式 */
function transformCsvToWorkbook(csvContent: string, fileName: string): Partial<IWorkbookData> {
	const lines = csvContent.split("\n").filter((line) => line.trim())
	const data = lines.map((line) => line.split(",").map((cell) => cell.trim()))
	return transformArrayData(data, fileName)
}

/** 转换工作表数据 */
function transformWorksheet(
	sheetId: string,
	sheetName: string,
	worksheet: XLSX.WorkSheet,
): Partial<IWorksheetData> {
	const cellData: Record<string, Record<string, ICellData>> = {}
	// 获取工作表范围信息
	const range = worksheet["!ref"]
	let maxCol = 0
	if (range) {
		const decoded = XLSX.utils.decode_range(range)
		maxCol = decoded.e.c
	}
	// 直接遍历工作表的原始单元格数据，保持原始格式和类型
	Object.keys(worksheet).forEach((cellAddress) => {
		// 跳过工作表的元数据属性（以 ! 开头）
		if (cellAddress.startsWith("!")) return
		const xlsxCell = worksheet[cellAddress] as XLSX.CellObject
		if (!xlsxCell) return
		// 解析单元格地址 (如 "A1" -> {c: 0, r: 0})
		const address = XLSX.utils.decode_cell(cellAddress)
		const rowIndex = address.r.toString()
		const colIndex = address.c.toString()
		// 初始化行数据
		if (!cellData[rowIndex]) {
			cellData[rowIndex] = {}
		}
		// 使用专门的转换函数创建 UniverJS 单元格数据
		cellData[rowIndex][colIndex] = createUniverCellData(xlsxCell)
	})
	return {
		id: sheetId,
		name: sheetName,
		columnCount: Math.max(maxCol + 1, 26), // 明确设置列数，最少26列（A-Z）
		cellData,
	}
}

/** 读取 Excel 文件 */
async function readExcelFile(file: File): Promise<XLSX.WorkBook> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = (e) => {
			try {
				const data = e.target?.result
				const workbook = XLSX.read(data, {
					type: "array",
					cellStyles: false, // 启用样式读取
					cellNF: true, // 启用数字格式读取
					cellDates: false, // 改为 false，让日期保持为数字
					raw: true, // 改为 true，获取原始值
					WTF: false,
				})
				resolve(workbook)
			} catch (error) {
				reject(error)
			}
		}
		reader.onerror = reject
		reader.readAsArrayBuffer(file)
	})
}

/** 读取带样式的 Excel 文件 */
async function readExcelFileWithStyles(file: File): Promise<Record<string, any>> {
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

					// 优化：预分配数组大小，减少内存重分配
					// const rowCount = range.e.r - range.s.r + 1 // 暂时不需要使用
					const colCount = range.e.c - range.s.c + 1

					// 初始化数组结构
					for (let R = range.s.r; R <= range.e.r; ++R) {
						sheetData[R] = new Array(colCount)
						sheetStyles[R] = new Array(colCount)
					}

					// 优化：单次遍历处理所有单元格数据和样式
					for (let R = range.s.r; R <= range.e.r; ++R) {
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

								sheetData[R][C] = cellValue

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

								sheetStyles[R][C] = enhancedStyle
							} else {
								sheetData[R][C] = ""
								sheetStyles[R][C] = null
							}
						}
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
 * 提取工作表冻结窗格信息
 * @param worksheet XLSX工作表对象
 * @returns 冻结窗格信息
 */
function extractFreezeInfo(worksheet: any): any {
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
		return defaultFreeze
	}
}

/** 将 Excel 工作簿转换为 Univer 格式 */
function transformExcelToWorkbook(
	workbook: XLSX.WorkBook,
	fileName: string,
): Partial<IWorkbookData> {
	const sheets: Record<string, Partial<IWorksheetData>> = {}
	const sheetOrder: string[] = []
	workbook.SheetNames.forEach((sheetName, index) => {
		const sheetId = `sheet${index + 1}`
		const worksheet = workbook.Sheets[sheetName]
		sheets[sheetId] = transformWorksheet(sheetId, sheetName, worksheet)
		sheetOrder.push(sheetId)
	})
	const result = {
		id: "workbook1",
		name: fileName,
		sheetOrder,
		sheets,
	}
	return result
}

/** 将 File 对象转换为 Univer 工作簿格式 */
export async function transformDataToWorkbook(
	file: File | any,
	fileName?: string,
	isReadonly?: boolean,
): Promise<Partial<IWorkbookData>> {
	const finalFileName = fileName || file.name || "Untitled File"
	// 获取文件扩展名
	const fileExtension = file.name.split(".").pop()?.toLowerCase()
	try {
		if (fileExtension === "xlsx" || fileExtension === "xls") {
			// 使用新的带样式的Excel读取和转换逻辑
			const allSheetsData = await readExcelFileWithStyles(file)
			const workbookData = transformExcelToUniverWorkbook(
				allSheetsData,
				finalFileName,
				isReadonly,
			)
			return workbookData
		} else if (fileExtension === "csv") {
			const csvContent = await readFileAsText(file)
			return transformCsvToWorkbook(csvContent, finalFileName)
		} else {
			const textContent = await readFileAsText(file)
			const displayData = [[textContent]]
			return transformArrayData(displayData, finalFileName)
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		const displayData = [[`文件解析失败: ${errorMessage}`]]
		return transformArrayData(displayData, finalFileName)
	}
}
