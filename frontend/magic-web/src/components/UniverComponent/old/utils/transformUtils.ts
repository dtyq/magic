/**
 * 数据转换工具模块
 * 处理不同格式数据到Univer格式的转换
 */
import { nanoid } from "nanoid"
import { readAllExcelSheets, readFileAsText, parseCsvToArray } from "./excelUtils"
import { convertExcelStyleToUniver } from "./styleUtils"
import { processExcelRichText, convertHtmlToRichText } from "./textUtils"
import { getDefaultStyleId, createDefaultStylesMap, mergeWithDefaultStyle } from "./defaultStyles"
import { mergeRowHeights, calculateRowHeightWithColumns } from "./rowHeightUtils"
import { convertFormulaToUniver } from "./formulaUtils"

// 使用 Vite 标准的 Worker 导入方式
import TransformWorker from "../workers/transform-data/worker?worker"

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

// Worker 实例变量 - 单例模式
let workerInstance: Worker | null = null
const workerTasks: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }> =
	new Map()

/**
 * 设置 Worker 事件处理器
 */
function setupWorkerHandlers(worker: Worker): void {
	// 处理 worker 消息
	worker.onmessage = (event: MessageEvent) => {
		const message = event.data
		const taskId = message.payload?.id

		if (!taskId || !workerTasks.has(taskId)) {
			console.warn("[transformData] 收到未知任务消息:", message)
			return
		}

		const task = workerTasks.get(taskId)!

		switch (message.type) {
			case "TRANSFORM_RESPONSE":
				task.resolve(message.payload.result)
				workerTasks.delete(taskId)
				break
			case "TRANSFORM_ERROR":
				const error = new Error(message.payload.error.message)
				if (message.payload.error.stack) {
					error.stack = message.payload.error.stack
				}
				task.reject(error)
				workerTasks.delete(taskId)
				break
			case "TRANSFORM_PROGRESS":
				// 可以在这里处理进度更新
				console.log(
					`[Worker] 任务 ${taskId}: ${message.payload.progress}% - ${message.payload.stage}`,
				)
				break
		}
	}

	// 处理 worker 错误
	worker.onerror = (error) => {
		console.error("[transformData] Worker 错误:", error)
		// 拒绝所有待处理的任务
		workerTasks.forEach((task) => {
			task.reject(new Error("Worker 遇到错误"))
		})
		workerTasks.clear()
		workerInstance = null
	}
}

/**
 * 获取或创建 Worker 实例
 */
function getWorkerInstance(): Worker | null {
	// 检查是否支持 Worker
	if (typeof Worker === "undefined") {
		console.warn("[transformData] Web Workers 不可用，将使用主线程处理")
		return null
	}

	if (!workerInstance) {
		try {
			// 使用 Vite 标准的 worker 加载方式 - 直接使用导入的 Worker 类
			workerInstance = new TransformWorker()

			setupWorkerHandlers(workerInstance)
			console.log("[transformData] Worker 已初始化")
		} catch (error) {
			console.warn("[transformData] Worker 初始化失败，使用主线程处理:", error)
			return null
		}
	}

	return workerInstance
}

/**
 * 根据文件类型转换数据为Univer可用格式，支持字符串内容或File对象
 * 优先使用 Web Worker 处理，如果不可用则回退到主线程
 * @param data 原始数据：字符串内容或File对象
 * @param fileType 文件类型 'doc' | 'sheet' | 'slide'
 * @param fileName 文件名
 * @returns 转换后的Univer数据
 */
export async function transformData(data: any, fileType: string, fileName: string): Promise<any> {
	const worker = getWorkerInstance()

	// 尝试使用 Worker 处理
	if (worker && workerTasks.size < 3) {
		// 限制并发任务数
		try {
			const taskId = nanoid()

			return new Promise((resolve, reject) => {
				// 注册任务
				workerTasks.set(taskId, { resolve, reject })

				// 设置超时
				const timeout = setTimeout(() => {
					if (workerTasks.has(taskId)) {
						workerTasks.delete(taskId)
						reject(new Error("转换任务超时"))
					}
				}, 30000) // 30 秒超时

				// 监听任务完成以清除超时
				const originalResolve = resolve
				const originalReject = reject

				workerTasks.set(taskId, {
					resolve: (value) => {
						clearTimeout(timeout)
						originalResolve(value)
					},
					reject: (error) => {
						clearTimeout(timeout)
						originalReject(error)
					},
				})

				// 发送任务到 Worker
				worker.postMessage({
					type: "TRANSFORM_REQUEST",
					payload: {
						id: taskId,
						data,
						fileType,
						fileName,
					},
				})
			})
		} catch (error) {
			console.warn("[transformData] Worker 处理失败，回退到主线程:", error)
			// 继续使用主线程处理
		}
	}

	// 回退到主线程处理（原始逻辑）
	return transformDataInMainThread(data, fileType, fileName)
}

/**
 * 在主线程中处理数据转换（原始逻辑）
 * @param data 原始数据
 * @param fileType 文件类型
 * @param fileName 文件名
 * @returns 转换后的数据
 */
export async function transformDataInMainThread(
	data: any,
	fileType: string,
	fileName: string,
): Promise<any> {
	// 如果是File对象，先读取文件内容
	if (data instanceof File) {
		const fileExtension = data.name.split(".").pop()?.toLowerCase()

		// 根据文件类型和扩展名选择适当的读取方式
		if (fileType === "sheet" && (fileExtension === "xlsx" || fileExtension === "xls")) {
			// 使用xlsx库读取Excel文件的所有工作表
			try {
				console.log("📊 Reading Excel file with styles...")
				const allSheetsData = await readAllExcelSheets(data)
				console.log("📊 Excel sheets data loaded:", allSheetsData)

				const workbookData = transformMultiSheetsToWorkbookData(allSheetsData, fileName)
				return workbookData
			} catch (error) {
				console.error("读取Excel文件失败:", error)
				throw new Error("Excel文件读取失败")
			}
		} else if (fileType === "sheet" && fileExtension === "csv") {
			// 处理CSV文件
			const content = await readFileAsText(data)
			return transformCsvToWorkbook(content, fileName)
		} else {
			// 对于其他文件类型，读取为文本
			const content = await readFileAsText(data)

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
}

/**
 * 将原始数据转换为文档格式
 * @param data 原始文档数据
 * @param fileName 文件名
 * @returns 转换后的文档数据
 */
export function transformDataForDoc(data: any, fileName: string): any {
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
 * @param data 原始表格数据
 * @param fileName 文件名
 * @returns 转换后的表格数据
 */
export function transformDataForSheet(data: any, fileName: string): any {
	// 如果数据已经是正确格式则直接返回
	if (data && typeof data === "object" && data.id && data.sheets) {
		return data
	}

	// 使用transformToWorkbookData生成标准的工作簿数据
	return transformToWorkbookData(data, fileName)
}

/**
 * 将原始数据转换为幻灯片格式
 * @param data 原始幻灯片数据
 * @param fileName 文件名
 * @returns 转换后的幻灯片数据
 */
export function transformDataForSlide(data: any, fileName: string): any {
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
 * @param csvContent CSV文本内容
 * @param fileName 文件名
 * @returns 工作簿数据
 */
function transformCsvToWorkbook(csvContent: string, fileName: string): any {
	const rows = parseCsvToArray(csvContent)
	// 使用现有的转换函数处理二维数组
	return transformToWorkbookData(rows, fileName)
}

/**
 * 清理合并单元格的数据，确保只有左上角单元格保留数据
 * @param cellData 单元格数据矩阵
 * @param mergeRanges 合并单元格范围数组
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
 * @param sheetsData 包含多个工作表数据和样式的对象
 * @param fileName 文件名
 * @returns 符合Univer标准的工作簿数据
 *
 * 工作表隐藏功能：
 * - 如果 sheetInfo 包含 hidden: true，则该工作表将被隐藏
 * - 如果 sheetInfo 不包含 hidden 属性或 hidden: false，则该工作表可见
 * - 旧格式（直接二维数组）的工作表默认为可见
 * - 隐藏的工作表仍然包含在工作簿中，但在UI中不会显示标签页
 */
export function transformMultiSheetsToWorkbookData(
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
						// let hasRichText = false

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
										// hasRichText = true
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
 * @param data 原始数据
 * @param fileName 文件名
 * @returns 符合Univer标准的工作簿数据
 */
export function transformToWorkbookData(data: any, fileName?: string): any {
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

/**
 * 将通用数据转换为Univer文档格式
 */
export function transformToDocumentData(data: unknown, fileName?: string): any {
	// 如果数据已经是Univer格式，直接返回
	if (data && typeof data === "object" && (data as any).id && (data as any).body) {
		return data
	}

	// 如果是字符串，将其作为文本内容
	if (typeof data === "string") {
		try {
			// 尝试解析为JSON
			const parsedData = JSON.parse(data)
			if (parsedData && typeof parsedData === "object") {
				return transformToDocumentData(parsedData)
			}
		} catch (e) {
			// 如果不是有效的JSON，将其作为文本内容
			const dataStream = data + "\r\n"
			return {
				id: `doc_${Date.now()}`,
				name: fileName || "Document",
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
			}
		}
	}

	// 默认返回空文档
	return {
		id: `doc_${Date.now()}`,
		name: fileName || "Document",
		body: {
			dataStream: "",
			textRuns: [],
			paragraphs: [],
		},
	}
}

/**
 * 将通用数据转换为Univer幻灯片格式
 */
export function transformToSlidesData(data: unknown, fileName?: string): any {
	// 如果数据已经是Univer格式，直接返回
	if (data && typeof data === "object" && (data as any).id && (data as any).slides) {
		return data
	}

	// 默认返回空的幻灯片
	return {
		id: `slides_${Date.now()}`,
		name: fileName || "Presentation",
		slides: {
			slide1: {
				id: "slide1",
				title: "标题",
				pageElements: [],
			},
		},
		activeSlide: "slide1",
	}
}
