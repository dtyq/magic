// 简单的样式测试脚本
function convertExcelStyleToUniver(excelStyle) {
	if (!excelStyle) return null

	const univerStyle = {}

	// 字体样式转换
	if (excelStyle.font) {
		if (excelStyle.font.sz) {
			univerStyle.fs = Number(excelStyle.font.sz) // font size - 确保是数字
		}
		if (excelStyle.font.name) {
			univerStyle.ff = String(excelStyle.font.name) // font family - 确保是字符串
		}

		if (excelStyle.font.bold) {
			univerStyle.bl = 1 // bold
		}
		if (excelStyle.font.italic) {
			univerStyle.it = 1 // italic
		}
		if (excelStyle.font.underline) {
			univerStyle.ul = { s: 1 } // underline - 恢复对象格式
		}
		if (excelStyle.font.strike) {
			univerStyle.st = { s: 1 } // strikethrough - 恢复对象格式
		}
		if (excelStyle.font.color) {
			// 颜色转换
			let colorValue = "#000000"
			if (excelStyle.font.color.rgb) {
				colorValue = `#${excelStyle.font.color.rgb.substring(2)}` // 移除Alpha通道
			}
			univerStyle.cl = { rgb: colorValue }
		}
	}

	// 背景填充转换
	if (excelStyle.fill) {
		let bgColor = null

		// 对于solid填充，fgColor是实际的填充颜色
		if (excelStyle.fill.fgColor) {
			if (excelStyle.fill.fgColor.rgb) {
				bgColor = `#${excelStyle.fill.fgColor.rgb.substring(2)}`
			}
		}

		if (bgColor) {
			univerStyle.bg = { rgb: bgColor }
		}
	}

	// 对齐方式转换
	if (excelStyle.alignment) {
		if (excelStyle.alignment.horizontal) {
			switch (excelStyle.alignment.horizontal) {
				case "left":
					univerStyle.ht = 1
					break
				case "center":
					univerStyle.ht = 2
					break
				case "right":
					univerStyle.ht = 3
					break
			}
		}
		if (excelStyle.alignment.vertical) {
			switch (excelStyle.alignment.vertical) {
				case "top":
					univerStyle.vt = 1
					break
				case "middle":
					univerStyle.vt = 2
					break
				case "bottom":
					univerStyle.vt = 3
					break
			}
		}
		if (excelStyle.alignment.wrapText) {
			univerStyle.tb = 1 // text wrap
		}
	}

	return Object.keys(univerStyle).length > 0 ? univerStyle : null
}

// 测试样式转换
const testStyles = [
	{
		name: "粗体字体",
		excel: { font: { bold: true, sz: 14, name: "Arial" } },
	},
	{
		name: "斜体红色",
		excel: { font: { italic: true, color: { rgb: "FFFF0000" } } },
	},
	{
		name: "蓝色背景",
		excel: { fill: { fgColor: { rgb: "FF0000FF" } } },
	},
	{
		name: "居中对齐",
		excel: { alignment: { horizontal: "center", vertical: "middle" } },
	},
]

console.log("🎨 样式转换测试结果:")
testStyles.forEach((test, index) => {
	const result = convertExcelStyleToUniver(test.excel)
	console.log(`${index + 1}. ${test.name}:`)
	console.log("   Excel:", JSON.stringify(test.excel, null, 2))
	console.log("   Univer:", JSON.stringify(result, null, 2))
	console.log("")
})
