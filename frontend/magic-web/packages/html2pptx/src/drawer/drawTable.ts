import type { PPTTableNode, PPTTableCellBorder, Slide } from "../types/index"
import { log, LogLevel } from "../logger"

/**
 * 绘制表格到幻灯片
 */
export function drawTable(
	slide: Slide,
	node: PPTTableNode,
): void {
	const { rows, colWidths, rowHeights, x, y, w } = node

	// 转换为 pptxgenjs 格式
	const tableRows = rows.map((row) =>
		row.cells.map((cell) => {
			const cellOptions: Record<string, unknown> = {}

			// 背景色（支持透明度）
			if (cell.options?.fill) {
				const fillObj: { color: string; transparency?: number } = {
					color: cell.options.fill,
				}
				if (cell.options.fillTransparency !== undefined && cell.options.fillTransparency > 0) {
					fillObj.transparency = cell.options.fillTransparency
				}
				cellOptions.fill = fillObj
			}

			// 文字颜色
			if (cell.options?.color) {
				cellOptions.color = cell.options.color
			}

			// 字号
			if (cell.options?.fontSize) {
				cellOptions.fontSize = cell.options.fontSize
			}

			// 粗体
			if (cell.options?.bold) {
				cellOptions.bold = cell.options.bold
			}

			// 水平对齐
			if (cell.options?.align) {
				cellOptions.align = cell.options.align
			}

			// 垂直对齐
			if (cell.options?.valign) {
				cellOptions.valign = cell.options.valign
			}

			// 合并单元格
			if (cell.options?.colspan) {
				cellOptions.colspan = cell.options.colspan
			}
			if (cell.options?.rowspan) {
				cellOptions.rowspan = cell.options.rowspan
			}

			// 边距
			if (cell.options?.margin !== undefined) {
				cellOptions.margin = cell.options.margin
			}

			// 边框
			if (cell.options?.border) {
				cellOptions.border = formatBorder(cell.options.border)
			}

			return {
				text: cell.text,
				options: cellOptions,
			}
		}),
	)

	const options: Record<string, unknown> = {
		x,
		y,
		w,
		colW: colWidths,
	}

	// 添加行高
	if (rowHeights && rowHeights.length > 0) {
		options.rowH = rowHeights
	}

	try {
		slide.addTable(tableRows, options)
	} catch (error) {
		log(LogLevel.L3, "Failed to add table", { error: String(error) })
	}
}

/**
 * 格式化边框为 pptxgenjs 格式
 */
function formatBorder(
	border: PPTTableCellBorder | [PPTTableCellBorder, PPTTableCellBorder, PPTTableCellBorder, PPTTableCellBorder],
): unknown {
	if (Array.isArray(border)) {
		// 四边不同: [top, right, bottom, left]
		return border.map((b) => formatSingleBorder(b))
	}
	// 四边相同
	return formatSingleBorder(border)
}

/**
 * 格式化单边边框
 */
function formatSingleBorder(border: PPTTableCellBorder): Record<string, unknown> {
	const result: Record<string, unknown> = {}

	if (border.color) result.color = border.color
	if (border.pt !== undefined) result.pt = border.pt
	if (border.type) result.type = border.type
	// 支持边框透明度（需要 pptxgenjs 补丁支持）
	if (border.transparency !== undefined && border.transparency > 0) {
		result.transparency = border.transparency
	}

	return result
}
