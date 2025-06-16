import { describe, it, expect } from "vitest"
import PreprocessService from "../index"

describe("PreprocessService - Linked Image", () => {
	it("should correctly parse linked images", () => {
		const markdown =
			"[![链接图片](https://via.placeholder.com/100x50)](https://www.example.com)"
		const result = PreprocessService.preprocess(markdown, { enableLatex: false })

		// Should process the linked image syntax
		const expectedHtml =
			'<a href="https://www.example.com"><img src="https://via.placeholder.com/100x50" alt="链接图片" /></a>'
		expect(result[0]).toContain(expectedHtml)
	})

	it("should handle multiple linked images", () => {
		const markdown = `
[![图片1](https://via.placeholder.com/100x50)](https://www.example1.com)
[![图片2](https://via.placeholder.com/200x100)](https://www.example2.com)
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		expect(content).toContain(
			'<a href="https://www.example1.com"><img src="https://via.placeholder.com/100x50" alt="图片1" /></a>',
		)
		expect(content).toContain(
			'<a href="https://www.example2.com"><img src="https://via.placeholder.com/200x100" alt="图片2" /></a>',
		)
	})

	it("should handle linked images with empty alt text", () => {
		const markdown = "[![](https://via.placeholder.com/100x50)](https://www.example.com)"
		const result = PreprocessService.preprocess(markdown, { enableLatex: false })

		const expectedHtml =
			'<a href="https://www.example.com"><img src="https://via.placeholder.com/100x50" alt="" /></a>'
		expect(result[0]).toContain(expectedHtml)
	})

	it("should not interfere with regular images", () => {
		const markdown = "![regular image](https://via.placeholder.com/100x50)"
		const result = PreprocessService.preprocess(markdown, { enableLatex: false })

		// Should not be transformed, let markdown-to-jsx handle it normally
		expect(result[0]).toBe(markdown)
	})

	it("should not interfere with regular links", () => {
		const markdown = "[regular link](https://www.example.com)"
		const result = PreprocessService.preprocess(markdown, { enableLatex: false })

		// Should not be transformed, let markdown-to-jsx handle it normally
		expect(result[0]).toBe(markdown)
	})

	it("should handle complex scenarios with text and linked images", () => {
		const markdown = `
这里有一个链接图片：[![测试图片](https://via.placeholder.com/100x50)](https://www.example.com)

还有普通文本和[普通链接](https://www.test.com)
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		expect(content).toContain(
			'<a href="https://www.example.com"><img src="https://via.placeholder.com/100x50" alt="测试图片" /></a>',
		)
		expect(content).toContain("[普通链接](https://www.test.com)")
	})
})
