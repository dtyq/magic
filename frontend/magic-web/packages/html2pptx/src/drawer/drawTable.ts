import type { PPTTableNode, Slide } from "../ir/node"
import type { PPTTableCellBorder, PPTTableTextRun } from "../ir/style"
import { log, LogLevel } from "../logger"

/**
 * Draw a table onto the slide
 */
export function drawTable(slide: Slide, node: PPTTableNode): void {
	const { rows, colWidths, rowHeights, x, y, w } = node

	// Convert to pptxgenjs format
	const tableRows = rows.map((row) =>
		row.cells.map((cell) => {
			const cellOptions: Record<string, unknown> = {}

			// Background color with transparency support
			if (cell.options?.fill) {
				const fillObj: { color: string; transparency?: number } = {
					color: cell.options.fill,
				}
				if (
					cell.options.fillTransparency !== undefined &&
					cell.options.fillTransparency > 0
				) {
					fillObj.transparency = cell.options.fillTransparency
				}
				cellOptions.fill = fillObj
			}

			// Text color
			if (cell.options?.color) {
				cellOptions.color = cell.options.color
			}

			// Font size
			if (cell.options?.fontSize) {
				cellOptions.fontSize = cell.options.fontSize
			}

			// Font family
			if (cell.options?.fontFace) {
				cellOptions.fontFace = cell.options.fontFace
			}

			// Bold
			if (cell.options?.bold) {
				cellOptions.bold = cell.options.bold
			}

			// Italic
			if (cell.options?.italic) {
				cellOptions.italic = cell.options.italic
			}

			// Character spacing
			if (cell.options?.charSpacing !== undefined) {
				cellOptions.charSpacing = cell.options.charSpacing
			}

			// Text transparency
			if (cell.options?.transparency !== undefined) {
				cellOptions.transparency = cell.options.transparency
			}

			// Horizontal alignment
			if (cell.options?.align) {
				cellOptions.align = cell.options.align
			}

			// Vertical alignment
			if (cell.options?.valign) {
				cellOptions.valign = cell.options.valign
			}

			// Merged cells
			if (cell.options?.colspan) {
				cellOptions.colspan = cell.options.colspan
			}
			if (cell.options?.rowspan) {
				cellOptions.rowspan = cell.options.rowspan
			}

			if (cell.options?.margin !== undefined) {
				cellOptions.margin = cell.options.margin
			}

			if (cell.options?.wrap === false) {
				cellOptions.wrap = false
			}

			// Border
			if (cell.options?.border) {
				cellOptions.border = formatBorder(cell.options.border)
			}

			// pptxgenjs supports text as string or array of { text, options }
			let text: string | Array<{ text: string; options?: Record<string, unknown> }> = ""
			if (Array.isArray(cell.text)) {
				text = (cell.text as PPTTableTextRun[]).map((run) => ({
					text: run.text,
					options: run.options as Record<string, unknown> | undefined,
				}))
			} else {
				text = cell.text
			}

			return {
				text,
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

	// Add row heights
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
 * Format borders for pptxgenjs
 */
function formatBorder(
	border:
		| PPTTableCellBorder
		| [PPTTableCellBorder, PPTTableCellBorder, PPTTableCellBorder, PPTTableCellBorder],
): unknown {
	if (Array.isArray(border)) {
		// Different sides: [top, right, bottom, left]
		return border.map((b) => formatSingleBorder(b))
	}
	// Same on all sides
	return formatSingleBorder(border)
}

/**
 * Format a per-side border
 */
function formatSingleBorder(border: PPTTableCellBorder): Record<string, unknown> {
	const result: Record<string, unknown> = {}

	if (border.color) result.color = border.color
	if (border.pt !== undefined) result.pt = border.pt
	if (border.type) result.type = border.type
	// Support border transparency through the native PptxGenJS v5 table-cell path.
	if (border.transparency !== undefined && border.transparency > 0) {
		result.transparency = border.transparency
	}

	return result
}
