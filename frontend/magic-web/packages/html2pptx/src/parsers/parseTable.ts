/**
 * 表格解析器
 * 将 HTML <table> 转换为 PPT 表格格式
 */

import type {
	ElementNode,
	PPTTableNode,
	PPTNodeBase,
	SlideConfig,
	PPTTableRow,
	PPTTableCell,
	PPTTableCellBorder,
} from "../types/index"
import { colorToHex, hasVisibleBackground, getTransparency } from "../utils/color"
import { pxToInch } from "../utils/unit"

/**
 * 解析 HTML 表格为 PPT 表格节点
 */
export function parseTable(
	node: ElementNode,
	base: PPTNodeBase,
	config: SlideConfig,
	iWindow: Window,
): PPTTableNode | null {
	const { element, rect } = node

	if (element.tagName !== "TABLE") return null

	const tableElement = element as HTMLTableElement

	// 获取当前 table 的行（不包含嵌套 table 的行）
	const tableRows = Array.from(tableElement.rows)
	if (tableRows.length === 0) return null

	// 解析表格结构
	const { rows, colCount } = parseTableRows(tableRows, iWindow, config)
	if (rows.length === 0) return null

	// 计算列宽
	const colWidths = calculateColumnWidths(tableElement, colCount, rect.w, config)

	// 计算行高
	const rowHeights = calculateRowHeights(tableRows, config)

	return {
		...base,
		type: "table",
		rows,
		colWidths,
		rowHeights,
	}
}

/**
 * 解析表格行
 */
function parseTableRows(
	tableRows: HTMLTableRowElement[],
	iWindow: Window,
	config: SlideConfig,
): { rows: PPTTableRow[]; colCount: number } {
	const rows: PPTTableRow[] = []
	let maxColCount = 0

	// 创建合并单元格跟踪矩阵
	const mergeMatrix: Array<Array<{ skip: boolean; rowspan: number; colspan: number }>> = []

	tableRows.forEach((tr, rowIndex) => {
		const cells: PPTTableCell[] = []
		// 只取当前行的直属单元格，避免误取嵌套表格单元格
		const tdElements = Array.from(tr.cells)

		let colIndex = 0

		// 初始化当前行的合并矩阵
		if (!mergeMatrix[rowIndex]) {
			mergeMatrix[rowIndex] = []
		}

		tdElements.forEach((td) => {
			// 跳过被 rowspan 占用的列
			while (mergeMatrix[rowIndex]?.[colIndex]?.skip) {
				colIndex++
			}

			// 传入 tr 以便继承行样式
			const cell = parseCellElement(td as HTMLTableCellElement, tr, iWindow)
			cells.push(cell)

			// 处理 colspan 和 rowspan
			const colspan = parseInt(td.getAttribute("colspan") || "1")
			const rowspan = parseInt(td.getAttribute("rowspan") || "1")

			// 更新合并矩阵
			for (let r = 0; r < rowspan; r++) {
				for (let c = 0; c < colspan; c++) {
					if (r === 0 && c === 0) continue // 跳过当前单元格

					const targetRow = rowIndex + r
					const targetCol = colIndex + c

					if (!mergeMatrix[targetRow]) {
						mergeMatrix[targetRow] = []
					}
					mergeMatrix[targetRow][targetCol] = { skip: true, rowspan, colspan }
				}
			}

			colIndex += colspan
		})

		maxColCount = Math.max(maxColCount, colIndex)
		rows.push({ cells })
	})

	return { rows, colCount: maxColCount }
}

/**
 * 解析单元格元素
 * @param td - 单元格元素 (td/th)
 * @param tr - 所在行元素 (用于继承行样式)
 * @param iWindow - iframe window
 */
function parseCellElement(
	td: HTMLTableCellElement,
	tr: HTMLTableRowElement,
	iWindow: Window,
): PPTTableCell {
	const computed = iWindow.getComputedStyle(td)
	const trComputed = iWindow.getComputedStyle(tr)

	// 获取文本内容
	const text = td.textContent?.trim() || ""

	// 解析样式
	const options: PPTTableCell["options"] = {}

	// 背景色继承链：
	// cell (td/th) -> row (tr) -> section (thead/tbody/tfoot) -> table
	const section = tr.parentElement
	const table = tr.closest("table")
	const sectionComputed = section ? iWindow.getComputedStyle(section) : null
	const tableComputed = table ? iWindow.getComputedStyle(table) : null

	const effectiveBgColor = resolveEffectiveBackgroundColor({
		cellBgColor: computed.backgroundColor,
		rowBgColor: trComputed.backgroundColor,
		sectionBgColor: sectionComputed?.backgroundColor,
		tableBgColor: tableComputed?.backgroundColor,
	})

	if (effectiveBgColor) {
		options.fill = colorToHex(effectiveBgColor)
		// 获取透明度 (0=不透明, 100=完全透明)
		const transparency = getTransparency(effectiveBgColor)
		if (transparency > 0) {
			options.fillTransparency = transparency
		}
	}

	// 文字颜色
	options.color = colorToHex(computed.color)

	// 字号
	const fontSize = parseFloat(computed.fontSize)
	if (fontSize && fontSize !== 16) {
		options.fontSize = Math.round(fontSize * 0.75) // px to pt
	}

	// 粗体
	const fontWeight = parseInt(computed.fontWeight)
	if (fontWeight >= 700 || computed.fontWeight === "bold") {
		options.bold = true
	}

	// 对齐
	const textAlign = computed.textAlign
	if (textAlign === "center" || textAlign === "right") {
		options.align = textAlign
	}

	// 垂直对齐
	const verticalAlign = computed.verticalAlign
	if (verticalAlign === "middle" || verticalAlign === "bottom") {
		options.valign = verticalAlign as "middle" | "bottom"
	}

	// 边距 (padding + 文本偏移)
	const margin = calculateCellMargin(td, computed)
	if (margin) {
		options.margin = margin
	}

	// colspan / rowspan
	const colspan = parseInt(td.getAttribute("colspan") || "1")
	const rowspan = parseInt(td.getAttribute("rowspan") || "1")
	if (colspan > 1) options.colspan = colspan
	if (rowspan > 1) options.rowspan = rowspan

	// 边框 - 同时考虑单元格和行的边框
	const border = parseCellBorder(computed, trComputed)
	if (border) options.border = border

	return { text, options: Object.keys(options).length > 0 ? options : undefined }
}

function resolveEffectiveBackgroundColor(input: {
	cellBgColor: string
	rowBgColor: string
	sectionBgColor?: string
	tableBgColor?: string
}): string | null {
	const { cellBgColor, rowBgColor, sectionBgColor, tableBgColor } = input
	if (hasVisibleBackground(cellBgColor)) return cellBgColor
	if (hasVisibleBackground(rowBgColor)) return rowBgColor
	if (sectionBgColor && hasVisibleBackground(sectionBgColor)) return sectionBgColor
	if (tableBgColor && hasVisibleBackground(tableBgColor)) return tableBgColor
	return null
}

/**
 * 解析单元格边框
 * @param computed - 单元格的计算样式
 * @param trComputed - 行的计算样式 (用于继承行边框)
 */
function parseCellBorder(
	computed: CSSStyleDeclaration,
	trComputed: CSSStyleDeclaration,
): PPTTableCellBorder | [PPTTableCellBorder, PPTTableCellBorder, PPTTableCellBorder, PPTTableCellBorder] | undefined {
	// 单元格边框
	let topWidth = parseFloat(computed.borderTopWidth) || 0
	let rightWidth = parseFloat(computed.borderRightWidth) || 0
	let bottomWidth = parseFloat(computed.borderBottomWidth) || 0
	let leftWidth = parseFloat(computed.borderLeftWidth) || 0

	let topColor = computed.borderTopColor
	let rightColor = computed.borderRightColor
	let bottomColor = computed.borderBottomColor
	let leftColor = computed.borderLeftColor

	let topStyle = computed.borderTopStyle
	let rightStyle = computed.borderRightStyle
	let bottomStyle = computed.borderBottomStyle
	let leftStyle = computed.borderLeftStyle

	// 如果单元格没有边框，尝试从行继承
	const trTopWidth = parseFloat(trComputed.borderTopWidth) || 0
	const trRightWidth = parseFloat(trComputed.borderRightWidth) || 0
	const trBottomWidth = parseFloat(trComputed.borderBottomWidth) || 0
	const trLeftWidth = parseFloat(trComputed.borderLeftWidth) || 0

	if (topWidth === 0 && trTopWidth > 0) {
		topWidth = trTopWidth
		topColor = trComputed.borderTopColor
		topStyle = trComputed.borderTopStyle
	}
	if (rightWidth === 0 && trRightWidth > 0) {
		rightWidth = trRightWidth
		rightColor = trComputed.borderRightColor
		rightStyle = trComputed.borderRightStyle
	}
	if (bottomWidth === 0 && trBottomWidth > 0) {
		bottomWidth = trBottomWidth
		bottomColor = trComputed.borderBottomColor
		bottomStyle = trComputed.borderBottomStyle
	}
	if (leftWidth === 0 && trLeftWidth > 0) {
		leftWidth = trLeftWidth
		leftColor = trComputed.borderLeftColor
		leftStyle = trComputed.borderLeftStyle
	}

	// 没有边框
	if (topWidth === 0 && rightWidth === 0 && bottomWidth === 0 && leftWidth === 0) {
		return undefined
	}

	const mapBorderStyle = (style: string): "solid" | "dash" | "dot" | "none" => {
		switch (style) {
			case "dashed":
				return "dash"
			case "dotted":
				return "dot"
			case "none":
			case "hidden":
				return "none"
			default:
				return "solid"
		}
	}

	// 构建单边边框（支持透明度）
	const buildBorder = (
		width: number,
		color: string,
		style: string,
	): PPTTableCellBorder => {
		if (width <= 0) {
			return { type: "none" }
		}
		const border: PPTTableCellBorder = {
			color: colorToHex(color),
			pt: width * 0.75,
			type: mapBorderStyle(style),
		}
		// 获取透明度并添加到边框对象
		const transparency = getTransparency(color)
		if (transparency > 0) {
			border.transparency = transparency
		}
		return border
	}

	// 如果四边相同，返回单一边框
	if (
		topWidth === rightWidth &&
		rightWidth === bottomWidth &&
		bottomWidth === leftWidth &&
		topColor === rightColor &&
		rightColor === bottomColor &&
		bottomColor === leftColor &&
		topStyle === rightStyle &&
		rightStyle === bottomStyle &&
		bottomStyle === leftStyle
	) {
		return buildBorder(topWidth, topColor, topStyle)
	}

	// 四边不同，返回数组 [top, right, bottom, left]
	return [
		buildBorder(topWidth, topColor, topStyle),
		buildBorder(rightWidth, rightColor, rightStyle),
		buildBorder(bottomWidth, bottomColor, bottomStyle),
		buildBorder(leftWidth, leftColor, leftStyle),
	]
}

/**
 * 计算列宽
 */
function calculateColumnWidths(
	table: HTMLTableElement,
	colCount: number,
	tableWidth: number,
	config: SlideConfig,
): number[] {
	const widths: number[] = []

	// 尝试从 colgroup/col 获取宽度
	const colElements = table.querySelectorAll("col")
	if (colElements.length > 0) {
		Array.from(colElements).forEach((col) => {
			const style = col.getAttribute("style") || ""
			const widthMatch = style.match(/width:\s*([\d.]+)(px|%)/)
			if (widthMatch) {
				const value = parseFloat(widthMatch[1])
				const unit = widthMatch[2]
				if (unit === "%") {
					widths.push(pxToInch(tableWidth * value / 100, config))
				} else {
					widths.push(pxToInch(value, config))
				}
			} else {
				// 没有指定宽度，后面平均分配
				widths.push(0)
			}
		})
	}

	// 如果没有 col 元素或宽度不完整，从第一行单元格测量
	if (widths.length === 0 || widths.every((w) => w === 0)) {
		const firstRow = table.rows[0]
		if (firstRow) {
			const cells = Array.from(firstRow.cells)
			const totalWidth = tableWidth
			const cellWidths: number[] = []

			cells.forEach((cell) => {
				const rect = cell.getBoundingClientRect()
				cellWidths.push(rect.width)
			})

			// 考虑 colspan
			let expandedWidths: number[] = []
			cells.forEach((cell, i) => {
				const colspan = parseInt(cell.getAttribute("colspan") || "1")
				const cellWidth = cellWidths[i] || 0
				const perColWidth = cellWidth / colspan

				for (let c = 0; c < colspan; c++) {
					expandedWidths.push(perColWidth)
				}
			})

			// 补齐到 colCount
			while (expandedWidths.length < colCount) {
				expandedWidths.push(totalWidth / colCount)
			}

			return expandedWidths.map((w) => pxToInch(w, config))
		}
	}

	// 补齐列宽
	const tableWidthInch = pxToInch(tableWidth, config)
	const avgWidth = tableWidthInch / colCount

	while (widths.length < colCount) {
		widths.push(avgWidth)
	}

	// 替换零宽度
	const nonZeroWidths = widths.filter((w) => w > 0)
	const avgNonZero = nonZeroWidths.length > 0
		? nonZeroWidths.reduce((a, b) => a + b, 0) / nonZeroWidths.length
		: avgWidth

	return widths.map((w) => (w > 0 ? w : avgNonZero))
}

/**
 * 计算行高
 */
function calculateRowHeights(
	tableRows: HTMLTableRowElement[],
	config: SlideConfig,
): number[] {
	const heights: number[] = []

	tableRows.forEach((tr) => {
		const rect = tr.getBoundingClientRect()
		heights.push(pxToInch(rect.height, config))
	})

	return heights
}

/**
 * 计算单元格边距 (padding + 文本偏移)
 * 返回值单位为英寸 (pptxgenjs 要求)
 */
function calculateCellMargin(
	td: HTMLTableCellElement,
	computed: CSSStyleDeclaration,
): [number, number, number, number] | undefined {
	const paddingTopPx = parseFloat(computed.paddingTop) || 0
	const paddingRightPx = parseFloat(computed.paddingRight) || 0
	const paddingBottomPx = parseFloat(computed.paddingBottom) || 0
	const paddingLeftPx = parseFloat(computed.paddingLeft) || 0

	// 默认使用 padding
	let marginLeftPx = paddingLeftPx

	// 尝试检测是否有图标等元素导致文本偏移
	// 找到第一个文本节点
	const textNode = findFirstTextNode(td)
	if (textNode) {
		try {
			const range = td.ownerDocument.createRange()
			range.selectNode(textNode)
			const textRect = range.getBoundingClientRect()
			const tdRect = td.getBoundingClientRect()

			// 计算实际的左侧偏移量
			// textRect.left - tdRect.left 包含了 borderLeftWidth + paddingLeft + iconWidth + margin
			// 我们需要去掉 borderLeftWidth
			const borderLeftWidth = parseFloat(computed.borderLeftWidth) || 0
			const visualOffset = textRect.left - tdRect.left - borderLeftWidth

			// 如果视觉偏移明显大于 padding-left (允许 2px 误差)，说明有东西挤占了空间
			if (visualOffset > paddingLeftPx + 2) {
				marginLeftPx = visualOffset
			}
		} catch (e) {
			// 忽略 Range 错误
		}
	}

	const top = pxToInch(paddingTopPx)
	const right = pxToInch(paddingRightPx)
	const bottom = pxToInch(paddingBottomPx)
	const left = pxToInch(marginLeftPx)
	
	// 如果都是 0，返回 undefined
	if (top === 0 && right === 0 && bottom === 0 && left === 0) {
		return undefined
	}

	return [top, right, bottom, left]
}

function findFirstTextNode(element: Element): Node | null {
	for (const child of Array.from(element.childNodes)) {
		if (child.nodeType === Node.TEXT_NODE) {
			if (child.textContent?.trim()) {
				return child
			}
		} else if (child.nodeType === Node.ELEMENT_NODE) {
			// 递归查找，但不进入某些特定容器？目前简单处理，递归查找
			const found = findFirstTextNode(child as Element)
			if (found) return found
		}
	}
	return null
}
