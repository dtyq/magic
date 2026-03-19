import { describe, it, expect } from "vitest"
import PreprocessService from "../index"

describe("PreprocessService - LaTeX", () => {
	describe("Inline Math", () => {
		it("should correctly process inline math formulas", () => {
			const markdown = "这是一个行内公式：$E = mc^2$ 和另一个 $a + b = c$"
			const result = PreprocessService.preprocess(markdown, { enableLatex: true })
			const content = result.join(" ")

			expect(content).toContain('<MagicLatexInline math="E = mc^2" />')
			expect(content).toContain('<MagicLatexInline math="a + b = c" />')
		})

		it("should not process inline math when LaTeX is disabled", () => {
			const markdown = "这是一个公式：$E = mc^2$"
			const result = PreprocessService.preprocess(markdown, { enableLatex: false })
			const content = result.join(" ")

			expect(content).toContain("$E = mc^2$")
			expect(content).not.toContain("<MagicLatexInline")
		})

		it("should handle complex inline formulas", () => {
			const markdown = "复杂公式：$\\frac{a}{b} + \\sqrt{c^2 + d^2}$"
			const result = PreprocessService.preprocess(markdown, { enableLatex: true })
			const content = result.join(" ")

			expect(content).toContain(
				'<MagicLatexInline math="\\frac{a}{b} + \\sqrt{c^2 + d^2}" />',
			)
		})
	})

	describe("Block Math", () => {
		it("should correctly process block math formulas", () => {
			const markdown = `
这是块级公式：

$$
\\frac{d}{dx}\\left( \\int_{0}^{x} f(u)\\,du\\right)=f(x)
$$
			`.trim()

			const result = PreprocessService.preprocess(markdown, { enableLatex: true })
			const content = result.join(" ")

			expect(content).toContain(
				'<MagicLatexBlock math="\\frac{d}{dx}\\left( \\int_{0}^{x} f(u)\\,du\\right)=f(x)" />',
			)
		})

		it("should handle multiline block formulas", () => {
			const markdown = `
$$
\\begin{equation}
f(x) = a_0 + \\sum_{n=1}^{\\infty} \\left( a_n \\cos(nx) + b_n \\sin(nx) \\right)
\\end{equation}
$$
			`.trim()

			const result = PreprocessService.preprocess(markdown, { enableLatex: true })
			const content = result.join(" ")

			expect(content).toContain('<MagicLatexBlock math="\\begin{equation}')
			expect(content).toContain('\\end{equation}" />')
		})

		it("should not process block math when LaTeX is disabled", () => {
			const markdown = `
$$
E = mc^2
$$
			`.trim()

			const result = PreprocessService.preprocess(markdown, { enableLatex: false })
			const content = result.join(" ")

			expect(content).toContain("$$")
			expect(content).not.toContain("<MagicLatexBlock")
		})
	})

	describe("Mixed Math Content", () => {
		it("should correctly handle both inline and block math together", () => {
			const markdown = `
# 数学公式

行内公式：$E = mc^2$

块级公式：

$$
\\frac{d}{dx}\\left( \\int_{0}^{x} f(u)\\,du\\right)=f(x)
$$

另一个行内公式：$a + b = c$
			`.trim()

			const result = PreprocessService.preprocess(markdown, { enableLatex: true })
			const content = result.join(" ")

			// Should process both inline and block formulas
			expect(content).toContain('<MagicLatexInline math="E = mc^2" />')
			expect(content).toContain('<MagicLatexInline math="a + b = c" />')
			expect(content).toContain(
				'<MagicLatexBlock math="\\frac{d}{dx}\\left( \\int_{0}^{x} f(u)\\,du\\right)=f(x)" />',
			)
		})

		it("should not confuse block math delimiters with inline math", () => {
			const markdown = `
行内公式 $x = 1$ 和块级公式：

$$
y = x^2 + 2x + 1
$$

还有另一个行内公式 $z = \\sqrt{x}$
			`.trim()

			const result = PreprocessService.preprocess(markdown, { enableLatex: true })
			const content = result.join(" ")

			// Should correctly identify and process different formula types
			expect(content).toContain('<MagicLatexInline math="x = 1" />')
			expect(content).toContain('<MagicLatexInline math="z = \\sqrt{x}" />')
			expect(content).toContain('<MagicLatexBlock math="y = x^2 + 2x + 1" />')

			// Should not have any bare $ symbols
			const processedContent = content.replace(/<[^>]*>/g, "") // Remove HTML tags
			expect(processedContent).not.toMatch(/\$[^$]*\$/)
		})
	})

	describe("Edge Cases", () => {
		it("should handle empty formulas", () => {
			const markdown = "空公式：$$ $$ 和行内带数学符号的公式：$x = $"
			const result = PreprocessService.preprocess(markdown, { enableLatex: true })
			const content = result.join(" ")

			expect(content).toContain('<MagicLatexBlock math="" />')
			expect(content).toContain('<MagicLatexInline math="x = " />')
		})

		it("should not process formulas with newlines in inline math", () => {
			const markdown = `$a + 
b = c$`
			const result = PreprocessService.preprocess(markdown, { enableLatex: true })
			const content = result.join(" ")

			// Should not process inline math with newlines
			expect(content).toContain("$a +")
			expect(content).toContain("b = c$")
		})

		it("should handle dollar signs in text that are not formulas", () => {
			const markdown = "This costs $100 and that costs $200."
			const result = PreprocessService.preprocess(markdown, { enableLatex: true })
			const content = result.join(" ")

			// Should not process as formulas (no non-numeric characters between $)
			expect(content).toContain("$100")
			expect(content).toContain("$200")
		})
	})
})
