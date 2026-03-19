import { describe, it, expect } from "vitest"
import PreprocessService from "../index"

describe("PreprocessService - Table and LaTeX Conflict", () => {
	it("should not interfere with table cells containing dollar signs", () => {
		const markdown = `
| 产品   | 价格 | 库存 |
|--------|------|------|
| 产品 A | $15  | 100  |
| 产品 B | $25  | 50   |
| 产品 C | $35  | 20   |
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: true })
		const content = result.join("")

		// Should generate table HTML
		expect(content).toContain("<table>")
		expect(content).toContain('<th style="text-align:left">产品</th>')
		expect(content).toContain('<th style="text-align:left">价格</th>')
		expect(content).toContain('<th style="text-align:left">库存</th>')

		// Should display dollar signs correctly in table cells
		expect(content).toContain("$15")
		expect(content).toContain("$25")
		expect(content).toContain("$35")

		// Should NOT contain LaTeX components for table prices
		expect(content).not.toContain('<MagicLatexInline math="15')
		expect(content).not.toContain('<MagicLatexInline math="25')
		expect(content).not.toContain('<MagicLatexInline math="35')

		// Should NOT contain any placeholder remnants
		expect(content).not.toContain("__DOLLAR_PLACEHOLDER__")
	})

	it("should still process actual LaTeX formulas outside of tables", () => {
		const markdown = `
| 产品   | 价格 | 库存 |
|--------|------|------|
| 产品 A | $15  | 100  |

这是一个数学公式：$E = mc^2$
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: true })
		const content = result.join("")

		// Should display the table with correct dollar signs
		expect(content).toContain("$15")

		// Should still process real LaTeX formulas
		expect(content).toContain('<MagicLatexInline math="E = mc^2" />')

		// Should NOT contain any placeholder remnants
		expect(content).not.toContain("__DOLLAR_PLACEHOLDER__")
	})

	it("should handle complex table with various content types", () => {
		const markdown = `
| 类型 | 值 | 备注 |
|------|----|----- |
| 价格 | $100.50 | 含税 |
| 公式 | 这不是公式：$x + y$ | 只是文本 |
| 数量 | 50 | 个 |

实际的数学公式：$\\sum_{i=1}^{n} x_i = total$
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: true })
		const content = result.join("")

		// Table content should display dollar signs correctly
		expect(content).toContain("$100.50")
		expect(content).toContain("这不是公式：$x + y$")

		// Real LaTeX outside table should work (note: single backslash in output)
		expect(content).toContain('<MagicLatexInline math="\\sum_{i=1}^{n} x_i = total" />')

		// Should not create LaTeX components for table content
		expect(content).not.toContain('<MagicLatexInline math="100.50')
		expect(content).not.toContain('<MagicLatexInline math="x + y')

		// Should NOT contain any placeholder remnants
		expect(content).not.toContain("__DOLLAR_PLACEHOLDER__")
	})

	it("should handle empty table cells and edge cases", () => {
		const markdown = `
| 产品 | 价格 | 状态 |
|------|------|------|
| A    | $0   | 有效 |
| B    |      | 无价格 |
| C    | $$$  | 多个美元符号 |
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: true })
		const content = result.join("")

		// Should display all dollar signs correctly
		expect(content).toContain("$0")
		expect(content).toContain("$$$")

		// Should handle empty cells (with style attribute)
		expect(content).toContain('<td style="text-align:left"></td>')

		// Should NOT contain any placeholder remnants
		expect(content).not.toContain("__DOLLAR_PLACEHOLDER__")
	})
})
