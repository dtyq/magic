import { describe, it, expect } from "vitest"
import { parseTable } from "../utils"
import { TABLE_REGEX } from "../defaultPreprocessRules"
import PreprocessService from "../index"

describe("Complex Table Parsing", () => {
	const complexTableMarkdown = `测试数据文档如下，包含复杂表格样例。

—————— 主信息表格 ——————
|        字段        |                说明                |
|:------------------:|:----------------------------------:|
|   📄 名称   | 测试项目                        |
| 🏢 部门 | （请补充部门信息）           |
| 🏷️ 标签   | 示例标签内容    |
| 🎯 主体     | 示例主体名称                    |
| 💳 信息     | 示例银行信息<br>账号：123456789 |
| 📅 计划时间 | 2024-06-27（示例时间）                  |
| 📅 到期时间 | 2024-07-06（示例日期）                |
| 💰 总金额   | ¥5,000                              |
| 📚 分类         | 示例分类                                 |
| 🏦 方式     | 第三方平台                           |
| 📃 附件     | ![附件](https://example.com/test-image.png) |
| 📢 备注     | 测试备注信息                        |

—————— 明细表格 ——————
| 🗂️ 类型 | 💰 金额 | 📅 日期 | 📍 地点 | 📝 备注 | 📎文件 |
|:----------:|:----------:|:----------:|:----------:|:------:|:------:|
| 示例类型       | ¥5,000     | 2024-06    | 示例城市       |        |        |

这是测试文档的结束部分。`

	it("should detect complex tables with TABLE_REGEX", () => {
		const matches = Array.from(complexTableMarkdown.matchAll(TABLE_REGEX))

		// Should detect both tables in the markdown
		expect(matches.length).toBeGreaterThan(0)

		if (matches.length > 0) {
			console.log("First table match:")
			console.log("Header:", JSON.stringify(matches[0][1]))
			console.log("Separator:", JSON.stringify(matches[0][2]))
			console.log("Rows:", JSON.stringify(matches[0][3]))
		}
	})

	it("should handle table with emoji headers and Chinese text", () => {
		const header = "|        字段        |                说明                |"
		const separator = "|:------------------:|:----------------------------------:|"
		const rows =
			"|   📄 名称   | 测试项目                        |\n| 🏢 部门 | （请补充部门信息）           |"

		const result = parseTable(header, separator, rows)

		// Should contain emoji characters
		expect(result).toContain("📄")
		expect(result).toContain("🏢")

		// Should contain Chinese text
		expect(result).toContain("名称")
		expect(result).toContain("测试项目")

		// Should have center alignment
		expect(result).toContain('style="text-align:center"')
	})

	it("should handle cells with HTML br tags", () => {
		const header = "| 字段 | 说明 |"
		const separator = "|------|------|"
		const rows = "| 💳 信息 | 示例银行信息<br>账号：123456789 |"

		const result = parseTable(header, separator, rows)

		// Should preserve br tags in cell content
		expect(result).toContain("<br>")
		expect(result).toContain("示例银行信息<br>账号：123456789")
	})

	it("should handle cells with image markdown", () => {
		const header = "| 字段 | 说明 |"
		const separator = "|------|------|"
		const rows = "| 📃 附件 | ![附件](https://example.com/image.png) |"

		const result = parseTable(header, separator, rows)

		// Should preserve image markdown in cell content
		expect(result).toContain("![附件](https://example.com/image.png)")
		expect(result).toContain("📃")
	})

	it("should handle tables with varying cell widths and Unicode", () => {
		const header = "| 🗂️ 类型 | 💰 金额 | 📅 日期 | 📍 地点 | 📝 备注 | 📎文件 |"
		const separator = "|:----------:|:----------:|:----------:|:----------:|:------:|:------:|"
		const rows =
			"| 示例类型       | ¥5,000     | 2024-06    | 示例城市       |        |        |"

		const result = parseTable(header, separator, rows)

		// Should contain all emoji headers
		expect(result).toContain("🗂️ 类型")
		expect(result).toContain("💰 金额")
		expect(result).toContain("📅 日期")
		expect(result).toContain("📍 地点")
		expect(result).toContain("📝 备注")
		expect(result).toContain("📎文件")

		// Should contain data with currency symbol
		expect(result).toContain("¥5,000")
		expect(result).toContain("示例类型")
		expect(result).toContain("示例城市")

		// Should have center alignment for all columns
		expect(result).toContain('style="text-align:center"')
	})

	it("should handle empty cells in complex tables", () => {
		const header = "| A | B | C |"
		const separator = "|---|---|---|"
		const rows = "| 有内容 |   | 空的 |\n| 📄 | | 🎯 |"

		const result = parseTable(header, separator, rows)

		// Should handle empty cells gracefully
		expect(result).toContain('<td style="text-align:left">有内容</td>')
		expect(result).toContain('<td style="text-align:left"></td>')
		expect(result).toContain('<td style="text-align:left">空的</td>')
		expect(result).toContain('<td style="text-align:left">📄</td>')
		expect(result).toContain('<td style="text-align:left">🎯</td>')
	})

	it("should not break with malformed complex tables", () => {
		const header = "| 字段 |"
		const separator = "|------|"
		const rows = "| 📄 名称 | 测试项目 | 额外列 |"

		const result = parseTable(header, separator, rows)

		// Should still generate valid HTML even with mismatched columns
		expect(result).toContain("<table>")
		expect(result).toContain("<thead>")
		expect(result).toContain("<tbody>")
		expect(result).toContain("</table>")

		// Should not contain the extra column content
		expect(result).not.toContain("额外列")
	})

	it("should preserve special characters and punctuation", () => {
		const header = "| 字段 | 说明 |"
		const separator = "|------|------|"
		const rows = "| 金额 | ¥5,000（含税） |\n| 时间 | 2024-06-27（今天） |"

		const result = parseTable(header, separator, rows)

		// Should preserve parentheses, currency symbols, and other punctuation
		expect(result).toContain("¥5,000（含税）")
		expect(result).toContain("2024-06-27（今天）")
	})

	it("should process complex tables through the full preprocessing pipeline", () => {
		const result = PreprocessService.preprocess(complexTableMarkdown, { enableLatex: false })

		console.log("Preprocessing result blocks:", result.length)
		result.forEach((block, index) => {
			if (block.includes("<table>")) {
				console.log(`Block ${index} contains table HTML (${block.length} chars)`)
			}
		})

		// Should convert tables to HTML
		const hasTableHTML = result.some((block) => block.includes("<table>"))
		expect(hasTableHTML).toBe(true)

		// Should preserve emojis and Chinese text
		const hasEmojis = result.some((block) => block.includes("📄") || block.includes("🏢"))
		expect(hasEmojis).toBe(true)

		// Should preserve br tags
		const hasBrTags = result.some((block) => block.includes("<br>"))
		expect(hasBrTags).toBe(true)

		// Should preserve image markdown
		const hasImageMarkdown = result.some((block) => block.includes("![附件]"))
		expect(hasImageMarkdown).toBe(true)
	})

	it("should handle complex tables with LaTeX enabled", () => {
		const result = PreprocessService.preprocess(complexTableMarkdown, { enableLatex: true })

		// Should still convert tables correctly even with LaTeX processing
		const hasTableHTML = result.some((block) => block.includes("<table>"))
		expect(hasTableHTML).toBe(true)
	})

	it("should not extract images from within table cells during splitBlockCode", () => {
		// Test that images inside table cells are not extracted as separate blocks
		const tableWithImage = `<table><thead><tr><th>字段</th><th>说明</th></tr></thead><tbody><tr><td>📃 附件</td><td>![附件](https://example.com/image.png)</td></tr></tbody></table>`

		const result = PreprocessService.splitBlockCode(tableWithImage)

		// Should return a single block containing the entire table
		expect(result).toHaveLength(1)
		expect(result[0]).toContain("<table>")
		expect(result[0]).toContain("![附件](https://example.com/image.png)")
		expect(result[0]).toContain("</table>")
	})

	it("should extract images outside tables but not inside tables", () => {
		const mixedContent = `外部图片: ![external](https://example.com/external.png)

<table><thead><tr><th>字段</th></tr></thead><tbody><tr><td>![internal](https://example.com/internal.png)</td></tr></tbody></table>

另一个外部图片: ![another](https://example.com/another.png)`

		const result = PreprocessService.splitBlockCode(mixedContent)

		// Should have multiple blocks: text, external image, table with internal image, text, another external image
		expect(result.length).toBeGreaterThan(3)

		// Should have blocks with external images
		const externalImageBlocks = result.filter(
			(block) =>
				block.includes("![external](https://example.com/external.png)") ||
				block.includes("![another](https://example.com/another.png)"),
		)
		expect(externalImageBlocks.length).toBeGreaterThan(0)

		// Should have a table block that contains the internal image
		const tableBlock = result.find((block) => block.includes("<table>"))
		expect(tableBlock).toBeDefined()
		expect(tableBlock).toContain("![internal](https://example.com/internal.png)")
	})

	it("should handle nested tables correctly", () => {
		const nestedContent = `<table><tr><td><table><tr><td>![nested](https://example.com/nested.png)</td></tr></table></td></tr></table>`

		const result = PreprocessService.splitBlockCode(nestedContent)

		// Should return a single block with the nested structure intact
		expect(result).toHaveLength(1)
		expect(result[0]).toContain("![nested](https://example.com/nested.png)")
		expect(result[0]).toContain("<table><tr><td><table>")
	})
})
