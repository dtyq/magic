// 处理表格的辅助函数

export const parseTable = (header: string, separator: string, rows: string) => {
	// 解析表头
	const headerCells = header
		.trim()
		.replace(/^\||\|$/g, "")
		.split("|")
		.map((cell) => cell.trim())

	// 解析分隔行，以确定对齐方式
	const alignments = separator
		.trim()
		.replace(/^\||\|$/g, "")
		.split("|")
		.map((cell) => {
			cell = cell.trim()
			if (cell.startsWith(":") && cell.endsWith(":")) return "center"
			if (cell.endsWith(":")) return "right"
			return "left"
		})

	// 解析数据行
	const dataRows = rows
		.trim()
		.split("\n")
		.map((row) =>
			row
				.replace(/^\||\|$/g, "")
				.split("|")
				.map((cell) => cell.trim()),
		)

	// 构建HTML表格
	let tableHtml = "<table><thead><tr>"

	// 添加表头
	headerCells.forEach((cell, i) => {
		const align = alignments[i] || "left"
		tableHtml += `<th style="text-align:${align}">${cell}</th>`
	})

	tableHtml += "</tr></thead><tbody>"

	// 添加数据行
	dataRows.forEach((row) => {
		tableHtml += "<tr>"
		row.forEach((cell, i) => {
			const align = alignments[i] || "left"
			tableHtml += `<td style="text-align:${align}">${cell}</td>`
		})
		tableHtml += "</tr>"
	})

	tableHtml += "</tbody></table>"

	return tableHtml
}
