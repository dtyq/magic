/**
 * Excel 数据转换工具模块
 * 专门处理 xlsx -> univer 的数据转换逻辑
 * 使用新的样式处理模块
 */
import { nanoid } from "nanoid"
import { convertExcelStyleToUniver } from "./styles/style-converter"
import { processExcelRichText, convertHtmlToRichText } from "./styles/text-processor"
import {
	getDefaultStyleId,
	createDefaultStylesMap,
	mergeWithDefaultStyle,
} from "./styles/default-styles"
import { calculateRowHeightWithColumns, mergeRowHeights } from "./utils/row-height-utils"

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
		// const topLeftColKey = start.c.toString() // 暂时不需要使用

		if (!cellData[topLeftRowKey]) {
			cellData[topLeftRowKey] = {}
		}

		// 获取左上角单元格的富文本数据（如果存在）
		// const topLeftCell = cellData[topLeftRowKey][topLeftColKey] // 暂时不需要使用

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
 * @param isReadonly 是否为只读模式
 * @returns 符合Univer标准的工作簿数据
 */
export function transformExcelToUniverWorkbook(
	sheetsData: Record<string, any>,
	fileName?: string,
	isReadonly?: boolean,
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
		let columnCount = 26 // 最少26列（A-Z）

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

			// 优化：单次遍历处理所有单元格数据，避免重复遍历
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
														startIndex: htmlDataStream.length,
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
							cellObj.f = formula.startsWith("=") ? formula : "=" + formula
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
								let univerStyle = convertExcelStyleToUniver(excelStyle, isReadonly)

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
							if (isReadonly) {
								// 只读模式：为没有样式的单元格也添加保护
								const protectionStyle = {
									protection: {
										locked: true,
										hidden: false,
									},
								}
								const mergedStyle = mergeWithDefaultStyle(protectionStyle)
								const currentStyleId = nanoid()
								globalStyles[currentStyleId] = mergedStyle
								cellObj.s = currentStyleId
							} else {
								cellObj.s = getDefaultStyleId()
							}
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

		// 优化：预先计算列宽信息，避免重复计算
		const columnWidths: number[] = []
		columnProperties.forEach((colProp, index) => {
			let width = 73 // 统一默认列宽，与其他逻辑保持一致
			if (colProp && (colProp.width || colProp.wpx || colProp.wch || colProp.excelWidth)) {
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

		// 处理行高数据 - 使用智能行高计算系统
		let rowData: Record<string, any> = {}

		// 使用智能行高计算系统
		if (Array.isArray(sheetData)) {
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

				// 确保最小宽度
				width = Math.max(width, 20) // 设置20像素的最小宽度

				columnData[index.toString()] = {
					w: width, // 列宽（像素）
					hd: colProp.hidden ? BooleanNumber.TRUE : BooleanNumber.FALSE, // 保持原始隐藏状态
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

		// 优化：中文内容检测已在主遍历中完成，这里直接使用结果
		// 在主遍历中收集中文内容信息，避免重复遍历
		let hasChineseContent = false
		if (Array.isArray(sheetData)) {
			// 使用 some 进行早期退出优化
			hasChineseContent = sheetData.some(
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
			// 只读模式下启用工作表保护
			...(isReadonly && {
				protection: {
					sheet: true,
					objects: true,
					scenarios: true,
				},
			}),
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
