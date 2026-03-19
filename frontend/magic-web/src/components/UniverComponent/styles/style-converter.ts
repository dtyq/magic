/**
 * 样式转换工具模块
 * 处理Excel样式到Univer样式的转换
 */
import { processExcelColor } from "./color-utils"
import { processExcelRichText, convertHtmlToRichText } from "./text-processor"

/**
 * 将Excel样式转换为Univer样式格式 - 增强版
 * @param excelStyle Excel样式对象
 * @param isReadonly 是否为只读模式
 * @returns Univer样式对象
 */
export function convertExcelStyleToUniver(excelStyle: any, isReadonly?: boolean): any {
	if (!excelStyle) return null

	const univerStyle: any = {}

	// 处理富文本内容
	if (excelStyle._richText) {
		const richTextData = processExcelRichText(excelStyle._richText)
		if (richTextData) {
			univerStyle.richText = richTextData
		}
	}

	// 处理HTML内容 - 新增功能
	if (excelStyle._htmlContent && !excelStyle._richText) {
		const richTextData = convertHtmlToRichText(excelStyle._htmlContent)
		if (richTextData && richTextData.textRuns && richTextData.textRuns.length > 0) {
			univerStyle.richText = richTextData
		}
	}

	// 字体样式转换 - 增强版
	if (excelStyle.font) {
		const font = excelStyle.font

		// 字体大小
		if (font.sz) {
			univerStyle.fs = Number(font.sz)
		}

		// 字体名称
		if (font.name) {
			univerStyle.ff = String(font.name)
		}

		// 字体样式
		if (font.bold) univerStyle.bl = 1
		if (font.italic) univerStyle.it = 1

		// 文本装饰
		if (font.underline) {
			univerStyle.ul = { s: 1 }
		}
		if (font.strike) {
			univerStyle.st = { s: 1 }
		}

		// 字体颜色 - 使用增强的颜色处理
		if (font.color) {
			const fontColor = processExcelColor(font.color, "#000000")
			univerStyle.cl = { rgb: fontColor }
		}

		// 上标/下标
		if (font.vertAlign) {
			if (font.vertAlign === "superscript") {
				univerStyle.va = 1 // 上标
			} else if (font.vertAlign === "subscript") {
				univerStyle.va = 2 // 下标
			}
		}
	}

	// 背景填充转换 - 增强版
	if (excelStyle.fill) {
		const fill = excelStyle.fill

		// 处理不同的填充模式
		if (fill.patternType === "solid" || !fill.patternType) {
			if (fill.fgColor) {
				const bgColor = processExcelColor(fill.fgColor, "#FFFFFF")
				if (bgColor && bgColor !== "#FFFFFF") {
					univerStyle.bg = { rgb: bgColor }
				}
			}
		} else if (fill.patternType === "lightGray" || fill.patternType === "darkGray") {
			// 处理灰色填充模式
			const grayColor = fill.patternType === "lightGray" ? "#F0F0F0" : "#D0D0D0"
			univerStyle.bg = { rgb: grayColor }
		}
	}

	// 兼容旧格式的背景色处理
	if (!univerStyle.bg) {
		if (excelStyle.fgColor) {
			const bgColor = processExcelColor(excelStyle.fgColor, "#FFFFFF")
			if (bgColor && bgColor !== "#FFFFFF") {
				univerStyle.bg = { rgb: bgColor }
			}
		} else if (excelStyle.bgColor) {
			const bgColor = processExcelColor(excelStyle.bgColor, "#FFFFFF")
			if (bgColor && bgColor !== "#FFFFFF") {
				univerStyle.bg = { rgb: bgColor }
			}
		}
	}

	// 对齐方式转换 - 增强版
	if (excelStyle.alignment) {
		const align = excelStyle.alignment

		// 水平对齐
		if (align.horizontal) {
			switch (align.horizontal) {
				case "left":
					univerStyle.ht = 1
					break
				case "center":
					univerStyle.ht = 2
					break
				case "right":
					univerStyle.ht = 3
					break
				case "justify":
					univerStyle.ht = 4
					break
				case "distributed":
					univerStyle.ht = 5
					break
			}
		}

		// 垂直对齐
		if (align.vertical) {
			switch (align.vertical) {
				case "top":
					univerStyle.vt = 1
					break
				case "middle":
				case "center":
					univerStyle.vt = 2
					break
				case "bottom":
					univerStyle.vt = 3
					break
				case "justify":
					univerStyle.vt = 4
					break
				case "distributed":
					univerStyle.vt = 5
					break
			}
		}

		// 文本换行
		if (align.wrapText) {
			univerStyle.tb = 1
		}

		// 文本旋转
		if (align.textRotation) {
			univerStyle.tr = {
				a: align.textRotation, // 角度
				v: 0, // 垂直对齐
			}
		}

		// 缩进
		if (align.indent) {
			univerStyle.pd = {
				l: align.indent * 8, // 左缩进，转换为像素
			}
		}
	}

	// 边框转换 - 保持原有逻辑，使用增强的颜色处理
	if (excelStyle.border) {
		const borderStyle: any = {}

		const convertBorderSide = (side: any) => {
			if (!side || !side.style) return null

			// 边框样式映射
			let borderType = 1
			switch (side.style) {
				case "thin":
					borderType = 1
					break
				case "medium":
					borderType = 2
					break
				case "thick":
					borderType = 3
					break
				case "dashed":
					borderType = 8
					break
				case "dotted":
					borderType = 4
					break
				case "double":
					borderType = 6
					break
				case "hair":
					borderType = 1
					break
				case "dashDot":
					borderType = 9
					break
				case "dashDotDot":
					borderType = 10
					break
				case "slantDashDot":
					borderType = 11
					break
				default:
					borderType = 1
					break
			}

			// 边框颜色 - 使用增强的颜色处理
			const borderColor = processExcelColor(side.color, "#000000")

			return {
				s: borderType,
				cl: { rgb: borderColor },
			}
		}

		// 处理四个边框方向
		if (excelStyle.border.top) {
			borderStyle.t = convertBorderSide(excelStyle.border.top)
		}
		if (excelStyle.border.bottom) {
			borderStyle.b = convertBorderSide(excelStyle.border.bottom)
		}
		if (excelStyle.border.left) {
			borderStyle.l = convertBorderSide(excelStyle.border.left)
		}
		if (excelStyle.border.right) {
			borderStyle.r = convertBorderSide(excelStyle.border.right)
		}

		if (Object.keys(borderStyle).length > 0) {
			univerStyle.bd = borderStyle
		}
	}

	// 数字格式转换 - 增强版
	if (excelStyle.numFmt || excelStyle._numberFormat) {
		const numFmt = excelStyle.numFmt || excelStyle._numberFormat
		univerStyle.n = {
			pattern: numFmt,
		}
	}

	// 单元格保护 - 根据模式控制
	if (isReadonly) {
		// 只读模式：强制锁定所有单元格，禁用双击编辑
		univerStyle.protection = {
			locked: true,
			hidden: false,
		}
	} else if (excelStyle.protection) {
		// 编辑模式：只有明确设置了保护的单元格才应用保护
		univerStyle.protection = {
			locked: excelStyle.protection.locked === true,
			hidden: excelStyle.protection.hidden === true,
		}
	}

	const hasStyles = Object.keys(univerStyle).length > 0
	return hasStyles ? univerStyle : null
}
