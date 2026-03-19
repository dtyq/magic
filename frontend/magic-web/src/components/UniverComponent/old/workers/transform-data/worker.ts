/**
 * Transform Data Worker
 * 在 Web Worker 中处理数据转换，避免阻塞主线程
 */

import { nanoid } from "nanoid"
import {
	TransformWorkerMessageType,
	type WorkerMessage,
	type TransformRequestMessage,
	type FileType,
} from "./types"

// 重新导入所有必要的工具函数
import { readAllExcelSheets, readFileAsText, parseCsvToArray } from "../../utils/excelUtils"
import { convertExcelStyleToUniver } from "../../utils/styleUtils"
import { processExcelRichText, convertHtmlToRichText } from "../../utils/textUtils"
import {
	getDefaultStyleId,
	createDefaultStylesMap,
	mergeWithDefaultStyle,
} from "../../utils/defaultStyles"
import { mergeRowHeights, calculateRowHeightWithColumns } from "../../utils/rowHeightUtils"
import { convertFormulaToUniver } from "../../utils/formulaUtils"

// 布尔数字枚举，用于Univer中的布尔值表示
enum BooleanNumber {
	FALSE = 0,
	TRUE = 1,
}

// 单元格类型枚举，符合Univer标准
enum CellValueType {
	STRING = 1,
	NUMBER = 2,
	BOOLEAN = 3,
	FORCE_STRING = 4,
}

// 单元格数据接口 - 符合Univer标准
interface ICellData {
	v?: any // 单元格值 (原始值)
	t?: number // 单元格类型 (1: 字符串, 2: 数字, 3: 布尔值, 4: 强制文本)
	f?: string // 公式字符串
	si?: string // 公式ID
	s?: string | number // 样式ID或样式对象
	p?: any // 富文本段落/文档数据
	custom?: any // 自定义字段对象
}

// 单元格矩阵类型
interface ICellMatrix {
	[rowKey: string]: {
		[colKey: string]: ICellData
	}
}

/**
 * 确定单元格的类型和值
 * @param cellValue 原始单元格值
 * @returns 包含类型和值的对象
 */
function determineCellTypeAndValue(cellValue: any): { type: CellValueType; value: any } {
	if (cellValue === null || cellValue === undefined || cellValue === "") {
		return { type: CellValueType.STRING, value: "" }
	}

	// 如果是字符串
	if (typeof cellValue === "string") {
		// 检查是否是数字字符串
		const numericValue = Number(cellValue)
		if (!isNaN(numericValue) && isFinite(numericValue) && cellValue.trim() !== "") {
			// 如果字符串可以转换为数字，但以0开头（如"001"），保持为字符串
			if (cellValue.startsWith("0") && cellValue.length > 1 && !cellValue.includes(".")) {
				return { type: CellValueType.FORCE_STRING, value: cellValue }
			}
			return { type: CellValueType.NUMBER, value: numericValue }
		}

		// 检查是否是布尔值
		const lowerValue = cellValue.toLowerCase()
		if (lowerValue === "true" || lowerValue === "false") {
			return { type: CellValueType.BOOLEAN, value: lowerValue === "true" }
		}

		return { type: CellValueType.STRING, value: cellValue }
	}

	// 如果是数字
	if (typeof cellValue === "number") {
		return { type: CellValueType.NUMBER, value: cellValue }
	}

	// 如果是布尔值
	if (typeof cellValue === "boolean") {
		return { type: CellValueType.BOOLEAN, value: cellValue }
	}

	// 其他类型，转换为字符串
	return { type: CellValueType.STRING, value: String(cellValue) }
}

/**
 * 发送进度更新消息
 */
function sendProgress(id: string, progress: number, stage: string) {
	self.postMessage({
		type: TransformWorkerMessageType.TRANSFORM_PROGRESS,
		payload: { id, progress, stage },
	})
}

/**
 * 发送成功响应消息
 */
function sendResponse(id: string, result: any) {
	self.postMessage({
		type: TransformWorkerMessageType.TRANSFORM_RESPONSE,
		payload: { id, result },
	})
}

/**
 * 发送错误响应消息
 */
function sendError(id: string, error: Error) {
	self.postMessage({
		type: TransformWorkerMessageType.TRANSFORM_ERROR,
		payload: {
			id,
			error: {
				message: error.message,
				stack: error.stack,
			},
		},
	})
}

/**
 * 核心转换函数 - 在 Worker 中执行
 */
async function transformDataInWorker(
	data: any,
	fileType: FileType,
	fileName: string,
	taskId: string,
): Promise<any> {
	try {
		sendProgress(taskId, 10, "开始处理数据")

		// 如果是File对象，先读取文件内容
		if (data instanceof File) {
			const fileExtension = data.name.split(".").pop()?.toLowerCase()
			sendProgress(taskId, 20, "正在读取文件")

			// 根据文件类型和扩展名选择适当的读取方式
			if (fileType === "sheet" && (fileExtension === "xlsx" || fileExtension === "xls")) {
				// 使用xlsx库读取Excel文件的所有工作表
				try {
					console.log("📊 Reading Excel file with styles...")
					sendProgress(taskId, 40, "正在解析Excel文件")
					const allSheetsData = await readAllExcelSheets(data)
					console.log("📊 Excel sheets data loaded:", allSheetsData)

					sendProgress(taskId, 80, "正在转换为Univer格式")
					const workbookData = transformMultiSheetsToWorkbookData(allSheetsData, fileName)
					return workbookData
				} catch (error) {
					console.error("读取Excel文件失败:", error)
					throw new Error("Excel文件读取失败")
				}
			} else if (fileType === "sheet" && fileExtension === "csv") {
				// 处理CSV文件
				sendProgress(taskId, 40, "正在读取CSV文件")
				const content = await readFileAsText(data)
				sendProgress(taskId, 80, "正在转换CSV为工作簿")
				return transformCsvToWorkbook(content, fileName)
			} else {
				// 对于其他文件类型，读取为文本
				sendProgress(taskId, 40, "正在读取文本内容")
				const content = await readFileAsText(data)

				sendProgress(taskId, 60, `正在转换为${fileType}格式`)
				// 根据文件类型调用相应的转换函数
				switch (fileType) {
					case "doc":
						return transformDataForDoc(content, fileName)
					case "sheet":
						return transformDataForSheet(content, fileName)
					case "slide":
						return transformDataForSlide(content, fileName)
					default:
						throw new Error(`不支持的文件类型: ${fileType}`)
				}
			}
		}

		// 如果不是File对象，按原逻辑处理
		sendProgress(taskId, 50, `正在转换为${fileType}格式`)
		switch (fileType) {
			case "doc":
				return transformDataForDoc(data, fileName)
			case "sheet":
				return transformDataForSheet(data, fileName)
			case "slide":
				return transformDataForSlide(data, fileName)
			default:
				throw new Error(`不支持的文件类型: ${fileType}`)
		}
	} catch (error) {
		console.error("Worker中转换数据失败:", error)
		throw error
	}
}

// 以下是从原始 transformUtils.ts 复制的所有转换函数

/**
 * 将原始数据转换为文档格式
 */
function transformDataForDoc(data: any, fileName: string): any {
	// 如果数据已经是正确格式则直接返回
	if (data && typeof data === "object" && data.id) {
		return data
	}

	// 简单文档结构，实际项目中可能需要更复杂的转换逻辑
	const content = data?.content || data || ""
	const dataStream = content + "\r\n"
	return {
		id: `doc-${Date.now()}`,
		name: fileName,
		type: "doc",
		body: {
			dataStream: dataStream,
			textRuns: [],
			paragraphs: [
				{
					startIndex: 0,
				},
			],
			sectionBreaks: [
				{
					startIndex: dataStream.length,
				},
			],
		},
		config: {
			view: {
				pageSize: {
					width: 794, // A4宽度
					height: 1123, // A4高度
				},
			},
		},
	}
}

/**
 * 将原始数据转换为表格格式
 */
function transformDataForSheet(data: any, fileName: string): any {
	// 如果数据已经是正确格式则直接返回
	if (data && typeof data === "object" && data.id && data.sheets) {
		return data
	}

	// 使用transformToWorkbookData生成标准的工作簿数据
	return transformToWorkbookData(data, fileName)
}

/**
 * 将原始数据转换为幻灯片格式
 */
function transformDataForSlide(data: any, fileName: string): any {
	// 如果数据已经是正确格式则直接返回
	if (data && typeof data === "object" && data.id) {
		return data
	}

	// 简单幻灯片结构，实际项目中可能需要更复杂的转换逻辑
	return {
		id: `slide-${Date.now()}`,
		name: fileName,
		type: "slide",
		slides: data?.slides || [
			{
				id: "slide1",
				title: "标题幻灯片",
				elements: [],
			},
		],
		// 更多幻灯片相关配置...
	}
}

/**
 * 将CSV文本内容转换为工作簿数据
 */
function transformCsvToWorkbook(csvContent: string, fileName: string): any {
	const rows = parseCsvToArray(csvContent)
	// 使用现有的转换函数处理二维数组
	return transformToWorkbookData(rows, fileName)
}

/**
 * 清理合并单元格的数据，确保只有左上角单元格保留数据
 */
function cleanMergedCellData(cellData: ICellMatrix, mergeRanges: any[]): void {
	if (!mergeRanges || mergeRanges.length === 0) return

	mergeRanges.forEach((merge) => {
		const { start, end } = merge

		// 首先确保左上角单元格存在并收集其数据
		const topLeftRowKey = start.r.toString()
		const topLeftColKey = start.c.toString()

		if (!cellData[topLeftRowKey]) {
			cellData[topLeftRowKey] = {}
		}

		// 获取左上角单元格的富文本数据（如果存在）
		const topLeftCell = cellData[topLeftRowKey][topLeftColKey]
		const topLeftRichText = topLeftCell?.p

		// 清空其他被合并的单元格，但保留样式信息
		for (let r = start.r; r <= end.r; r++) {
			for (let c = start.c; c <= end.c; c++) {
				// 跳过左上角单元格
				if (r === start.r && c === start.c) {
					continue
				}

				const rowKey = r.toString()
				const colKey = c.toString()

				// 确保行存在
				if (!cellData[rowKey]) {
					cellData[rowKey] = {}
				}

				// 如果单元格存在，清空其值但保留样式信息
				if (cellData[rowKey][colKey]) {
					const originalStyle = cellData[rowKey][colKey].s
					const originalType = cellData[rowKey][colKey].t
					const originalCustom = cellData[rowKey][colKey].custom

					// 构建清理后的单元格对象，只保留样式和基本信息
					const cleanedCell: ICellData = {
						v: "", // 清空值
						s: originalStyle, // 保留样式
					}

					// 保留其他基本属性（但不包括富文本）
					if (originalType) cleanedCell.t = originalType
					if (originalCustom) cleanedCell.custom = originalCustom

					cellData[rowKey][colKey] = cleanedCell
				} else {
					// 如果单元格不存在，创建一个空单元格
					cellData[rowKey][colKey] = { v: "" }
				}
			}
		}
	})
}

/**
 * 将多个工作表数据转换为Univer工作簿格式（支持样式和隐藏工作表）
 */
function transformMultiSheetsToWorkbookData(
	sheetsData: Record<string, any>,
	fileName?: string,
): any {
	const workbookId = `workbook_${Date.now()}`
	const sheetOrder: string[] = []
	const sheets: Record<string, any> = {}
	const globalStyles: Record<string, any> = {}

	// 添加默认样式
	const defaultStyles = createDefaultStylesMap()
	Object.assign(globalStyles, defaultStyles)

	// 遍历每个工作表，创建对应的工作表数据
	Object.entries(sheetsData).forEach(([sheetName, sheetInfo], index) => {
		const sheetId = `sheet_${Date.now()}_${index}`
		sheetOrder.push(sheetId)

		// 处理单元格数据
		const cellData: ICellMatrix = {}
		let rowCount = 30
		let columnCount = 10

		// 兼容旧格式（纯数组）和新格式（包含样式、行高、列宽）
		let sheetData: any[][]
		let sheetStyles: any[][] | null = null
		let rowProperties: any[] = []
		let columnProperties: any[] = []
		let mergeRanges: any[] = []
		let freezeInfo: any = {
			startRow: -1,
			startColumn: -1,
			ySplit: 0,
			xSplit: 0,
		}
		let isHidden = false

		if (Array.isArray(sheetInfo)) {
			// 旧格式：直接是二维数组
			sheetData = sheetInfo
		} else {
			// 新格式：包含data、styles、rowProperties、columnProperties、mergeRanges、freezeInfo、hidden
			sheetData = sheetInfo.data || []
			sheetStyles = sheetInfo.styles || null
			rowProperties = sheetInfo.rowProperties || []
			columnProperties = sheetInfo.columnProperties || []
			mergeRanges = sheetInfo.mergeRanges || []
			freezeInfo = sheetInfo.freezeInfo || freezeInfo
			isHidden = sheetInfo.hidden === true
		}

		if (Array.isArray(sheetData)) {
			rowCount = Math.max(rowCount, sheetData.length)

			sheetData.forEach((row, rowIndex) => {
				if (Array.isArray(row)) {
					// 更新最大列数
					columnCount = Math.max(columnCount, row.length)

					// 处理每个单元格
					row.forEach((cellValue, colIndex) => {
						const rowKey = rowIndex.toString()
						const colKey = colIndex.toString()

						if (!cellData[rowKey]) {
							cellData[rowKey] = {}
						}

						const cellObj: ICellData = {}

						// 处理单元格值 - 支持富文本和HTML
						let finalCellValue = cellValue

						if (
							sheetStyles &&
							sheetStyles[rowIndex] &&
							sheetStyles[rowIndex][colIndex]
						) {
							const enhancedStyle = sheetStyles[rowIndex][colIndex]

							// 检查富文本内容
							if (enhancedStyle?._richText) {
								const richTextData = processExcelRichText(enhancedStyle._richText)
								if (richTextData) {
									finalCellValue = richTextData.body.dataStream // 使用富文本的文本内容
									// 将富文本数据存储到单元格中 - 符合Univer标准
									cellObj.p = richTextData
								} else {
									finalCellValue = cellValue
								}
							} else if (enhancedStyle?._htmlContent) {
								// 使用新的HTML到富文本转换函数
								const richTextData = convertHtmlToRichText(
									enhancedStyle._htmlContent,
								)
								if (richTextData && richTextData.text) {
									finalCellValue = richTextData.text
									// 将富文本数据存储到单元格中 - 符合Univer标准
									if (richTextData.textRuns && richTextData.textRuns.length > 0) {
										// 构建符合 dataStream 特殊格式的数据
										const htmlDataStream = richTextData.text + "\r\n"
										cellObj.p = {
											body: {
												dataStream: htmlDataStream,
												textRuns: richTextData.textRuns.map((run: any) => ({
													ts: run.style,
													st: run.startIndex,
													ed: run.endIndex,
												})),
												paragraphs: [
													{
														startIndex: 0,
													},
												],
												sectionBreaks: [
													{
														startIndex: htmlDataStream.length, // 修复：使用完整 dataStream 长度
													},
												],
											},
										}
									}
								} else {
									// 回退：移除HTML标签
									const plainText = enhancedStyle._htmlContent.replace(
										/<[^>]*>/g,
										"",
									)
									finalCellValue = plainText || cellValue
								}
							} else if (enhancedStyle?._formattedText) {
								// 使用格式化文本
								finalCellValue = enhancedStyle._formattedText
							} else {
								finalCellValue = cellValue
							}
						} else {
							finalCellValue = cellValue
						}

						// 处理公式信息
						if (
							sheetStyles &&
							sheetStyles[rowIndex] &&
							sheetStyles[rowIndex][colIndex] &&
							sheetStyles[rowIndex][colIndex]._formula
						) {
							const formula = sheetStyles[rowIndex][colIndex]._formula

							// 转换公式格式并设置到单元格
							cellObj.f = convertFormulaToUniver(formula)
						}

						// 确定单元格类型和值
						const { type, value } = determineCellTypeAndValue(finalCellValue)
						cellObj.v = value
						cellObj.t = type

						// 添加样式信息
						if (
							sheetStyles &&
							sheetStyles[rowIndex] &&
							sheetStyles[rowIndex][colIndex] !== undefined
						) {
							const excelStyle = sheetStyles[rowIndex][colIndex]

							// 如果样式明确设置为 null，则不应用任何样式
							if (excelStyle === null) {
								// 不设置 cellObj.s，保持为 undefined
							} else {
								let univerStyle = convertExcelStyleToUniver(excelStyle)

								if (univerStyle) {
									// 合并默认样式和用户样式
									univerStyle = mergeWithDefaultStyle(univerStyle)
									// 生成样式ID并存储到全局样式表
									const currentStyleId = nanoid()
									globalStyles[currentStyleId] = univerStyle
									cellObj.s = currentStyleId
								} else {
									// 如果没有特定样式，使用默认样式
									cellObj.s = getDefaultStyleId()
								}
							}
						} else {
							// 如果没有样式信息，使用默认样式
							cellObj.s = getDefaultStyleId()
						}

						cellData[rowKey][colKey] = cellObj
					})
				}
			})
		}

		// 处理合并单元格数据
		const mergeData: any[] = []
		if (mergeRanges && mergeRanges.length > 0) {
			// 转换为Univer格式的合并数据
			mergeRanges.forEach((merge) => {
				const { start, end } = merge
				mergeData.push({
					startRow: start.r,
					endRow: end.r,
					startColumn: start.c,
					endColumn: end.c,
				})
			})

			// 清理合并单元格的数据
			cleanMergedCellData(cellData, mergeRanges)
		}

		// 处理行高数据 - 使用智能行高计算
		let rowData: Record<string, any> = {}

		// 使用智能行高计算系统
		if (Array.isArray(sheetData)) {
			// 提取列宽信息用于更精确的行高计算
			const columnWidths: number[] = []
			columnProperties.forEach((colProp, index) => {
				let width = 73 // 统一默认列宽，与其他逻辑保持一致
				if (
					colProp &&
					(colProp.width || colProp.wpx || colProp.wch || colProp.excelWidth)
				) {
					// 使用与列宽处理相同的优先级和转换逻辑
					if (colProp.wpx) {
						width = colProp.wpx
					} else if (colProp.wch) {
						width = Math.round(colProp.wch * 7.5)
					} else if (colProp.excelWidth) {
						width = Math.round(colProp.excelWidth * 7)
					} else if (colProp.width) {
						width = colProp.width
					}
				}
				columnWidths[index] = width
			})

			// 使用增强版计算，考虑列宽
			const calculatedRowData: Record<string, any> = {}
			sheetData.forEach((row, rowIndex) => {
				const height = calculateRowHeightWithColumns(row, undefined, columnWidths)
				calculatedRowData[rowIndex.toString()] = {
					h: height,
					hd: 0,
					ah: height,
				}
			})

			// 如果有Excel原始行属性，合并两者
			if (rowProperties.length > 0) {
				rowData = mergeRowHeights(rowProperties, calculatedRowData, sheetData)
			} else {
				rowData = calculatedRowData
			}
		} else {
			// 如果没有数据，使用基础行高
			const baseRowHeight = 23
			for (
				let rowIndex = 0;
				rowIndex < Math.max(rowCount, rowProperties.length);
				rowIndex++
			) {
				const rowProp = rowProperties[rowIndex]
				let height = baseRowHeight
				let isHidden = false

				if (rowProp) {
					isHidden = rowProp.hidden || false
					if (rowProp.hpt && !rowProp.hpx) {
						height = Math.round(rowProp.hpt * 1.33)
					} else if (rowProp.hpx) {
						height = rowProp.hpx
					} else if (rowProp.height) {
						height = rowProp.height
					}
				}

				rowData[rowIndex.toString()] = {
					h: height,
					hd: isHidden ? BooleanNumber.TRUE : BooleanNumber.FALSE,
					ah: height,
				}
			}
		}

		// 处理列宽数据
		const columnData: Record<string, any> = {}
		columnProperties.forEach((colProp, index) => {
			if (
				colProp &&
				(colProp.width ||
					colProp.wpx ||
					colProp.wch ||
					colProp.excelWidth ||
					colProp.hidden)
			) {
				// Excel列宽转换：优先级 wpx(像素) > wch(字符宽度) > excelWidth(Excel单位) > width
				// 字符宽度转像素：1字符 ≈ 7.5像素，Excel单位转像素：Excel单位 * 7
				let width = 73 // 统一默认值
				if (colProp.wpx) {
					// 优先使用像素宽度
					width = colProp.wpx
				} else if (colProp.wch) {
					// 字符宽度转像素，1字符约7.5像素
					width = Math.round(colProp.wch * 7.5)
				} else if (colProp.excelWidth) {
					// Excel的"Max Digit Width"单位转像素
					width = Math.round(colProp.excelWidth * 7)
				} else if (colProp.width) {
					// 使用原始宽度值
					width = colProp.width
				}

				columnData[index.toString()] = {
					w: width, // 列宽（像素）
					hd: colProp.hidden ? BooleanNumber.TRUE : BooleanNumber.FALSE, // 是否隐藏
				}
			}
		})

		// 计算默认行高和列宽，针对中文环境优化
		let defaultRowHeight = 23 // 默认行高适应中文显示
		let defaultColumnWidth = 73

		// 如果有行属性，尝试从第一个有效行属性中获取默认高度
		const firstRowWithHeight = rowProperties.find(
			(row) => row && (row.height || row.hpt || row.hpx),
		)
		if (firstRowWithHeight) {
			if (firstRowWithHeight.hpx) {
				defaultRowHeight = Math.max(20, firstRowWithHeight.hpx) // 确保最小20px
			} else if (firstRowWithHeight.hpt) {
				defaultRowHeight = Math.max(20, Math.round(firstRowWithHeight.hpt * 1.33))
			} else {
				defaultRowHeight = Math.max(20, firstRowWithHeight.height)
			}
		}

		// 如果表格包含中文内容，进一步调整默认行高
		if (Array.isArray(sheetData)) {
			const hasChineseContent = sheetData.some(
				(row) =>
					Array.isArray(row) &&
					row.some(
						(cell) => cell && typeof cell === "string" && /[\u4e00-\u9fff]/.test(cell),
					),
			)

			if (hasChineseContent) {
				defaultRowHeight = Math.max(defaultRowHeight, 25)
			}
		}

		// 如果有列属性，尝试从第一个有效列属性中获取默认宽度
		const firstColWithWidth = columnProperties.find(
			(col) => col && (col.width || col.wpx || col.wch || col.excelWidth),
		)
		if (firstColWithWidth) {
			// 使用与单独列处理相同的转换逻辑，确保一致性
			if (firstColWithWidth.wpx) {
				defaultColumnWidth = firstColWithWidth.wpx
			} else if (firstColWithWidth.wch) {
				defaultColumnWidth = Math.round(firstColWithWidth.wch * 7.5)
			} else if (firstColWithWidth.excelWidth) {
				defaultColumnWidth = Math.round(firstColWithWidth.excelWidth * 7)
			} else if (firstColWithWidth.width) {
				defaultColumnWidth = firstColWithWidth.width
			}
		}

		// 构建符合IWorksheetData的工作表数据
		const worksheetData = {
			id: sheetId,
			name: sheetName || `工作表${index + 1}`,
			tabColor: "",
			hidden: isHidden ? BooleanNumber.TRUE : BooleanNumber.FALSE,
			rowCount: rowCount,
			columnCount: columnCount,
			defaultColumnWidth: defaultColumnWidth,
			defaultRowHeight: defaultRowHeight,
			freeze: freezeInfo,
			mergeData: mergeData,
			cellData: cellData,
			rowData: rowData,
			columnData: columnData,
			showGridlines: BooleanNumber.TRUE, // 显示网格线
			rowHeader: {
				width: 46,
				hidden: BooleanNumber.FALSE,
			},
			columnHeader: {
				height: 20,
				hidden: BooleanNumber.FALSE,
			},
			rightToLeft: BooleanNumber.FALSE,
		}

		sheets[sheetId] = worksheetData
	})

	// 构建符合IWorkbookData的工作簿数据
	const finalWorkbookData = {
		id: workbookId,
		name: fileName || "工作簿",
		appVersion: "0.5.0",
		locale: "zh-CN",
		styles: globalStyles, // 包含所有样式信息
		sheetOrder: sheetOrder,
		sheets: sheets,
		resources: [
			{
				name: "SHEET_DEFINED_NAME_PLUGIN",
				data: "",
			},
		],
	}

	return finalWorkbookData
}

/**
 * 将通用数据转换为Univer表格工作簿格式，符合IWorkbookData接口
 */
function transformToWorkbookData(data: any, fileName?: string): any {
	// 如果数据已经是标准Univer工作簿格式，直接返回
	if (data && data.id && data.sheets && data.sheetOrder) {
		return data
	}

	const workbookId = `workbook_${Date.now()}`
	const sheetId = `sheet_${Date.now()}`

	// 创建默认样式
	const globalStyles = createDefaultStylesMap()

	// 如果是字符串，尝试解析JSON
	if (typeof data === "string") {
		try {
			const parsedData = JSON.parse(data)
			if (parsedData && typeof parsedData === "object") {
				return transformToWorkbookData(parsedData, fileName)
			}
		} catch (e) {
			// 如果不是有效的JSON，将其作为简单文本内容处理
			data = [[data]]
		}
	}

	// 处理单元格数据
	const cellData: ICellMatrix = {}
	let rowCount = 30
	let columnCount = 10

	// 处理数组格式 (二维数组转为单元格数据)
	if (Array.isArray(data)) {
		rowCount = Math.max(rowCount, data.length)

		data.forEach((row, rowIndex) => {
			if (Array.isArray(row)) {
				// 更新最大列数
				columnCount = Math.max(columnCount, row.length)

				// 处理每个单元格
				row.forEach((cellValue, colIndex) => {
					const rowKey = rowIndex.toString()
					const colKey = colIndex.toString()

					if (!cellData[rowKey]) {
						cellData[rowKey] = {}
					}

					// 确定单元格类型和值
					const { type, value } = determineCellTypeAndValue(cellValue)
					cellData[rowKey][colKey] = {
						v: value, // 单元格值
						t: type, // 单元格类型
						s: getDefaultStyleId(), // 应用默认样式
					}
				})
			}
		})
	} else if (data && typeof data === "object" && data.cellData) {
		// 如果已经有cellData结构
		Object.assign(cellData, data.cellData)
		rowCount = data.rowCount || rowCount
		columnCount = data.columnCount || columnCount
	}

	// 构建符合IWorksheetData的工作表数据
	const worksheetData = {
		id: sheetId,
		name: "工作表1",
		tabColor: "",
		hidden: BooleanNumber.FALSE,
		rowCount: rowCount,
		columnCount: columnCount,
		defaultColumnWidth: 73,
		defaultRowHeight: 23,
		freeze: {
			startRow: -1,
			startColumn: -1,
			ySplit: 0,
			xSplit: 0,
		},
		mergeData: [],
		cellData: cellData,
		rowData: {},
		columnData: {},
		showGridlines: BooleanNumber.TRUE, // 显示网格线
		rowHeader: {
			width: 46,
			hidden: BooleanNumber.FALSE,
		},
		columnHeader: {
			height: 20,
			hidden: BooleanNumber.FALSE,
		},
		rightToLeft: BooleanNumber.FALSE,
	}

	// 构建符合IWorkbookData的工作簿数据
	return {
		id: workbookId,
		name: fileName || "工作簿",
		appVersion: "0.5.0",
		locale: "zh-CN",
		styles: globalStyles, // 包含默认样式
		sheetOrder: [sheetId],
		sheets: {
			[sheetId]: worksheetData,
		},
		resources: [
			{
				name: "SHEET_DEFINED_NAME_PLUGIN",
				data: "",
			},
		],
	}
}

// Worker 消息处理
self.onmessage = async function (event: MessageEvent<WorkerMessage>) {
	const message = event.data

	if (message.type === TransformWorkerMessageType.TRANSFORM_REQUEST) {
		const { id, data, fileType, fileName } = (message as TransformRequestMessage).payload

		try {
			console.log(`[Worker] 开始处理转换任务: ${id}`)
			sendProgress(id, 5, "任务已开始")

			const result = await transformDataInWorker(data, fileType, fileName, id)

			sendProgress(id, 100, "转换完成")
			sendResponse(id, result)
			console.log(`[Worker] 任务完成: ${id}`)
		} catch (error) {
			console.error(`[Worker] 任务失败: ${id}`, error)
			sendError(id, error as Error)
		}
	}
}

console.log("[Worker] Transform Data Worker 已启动")
