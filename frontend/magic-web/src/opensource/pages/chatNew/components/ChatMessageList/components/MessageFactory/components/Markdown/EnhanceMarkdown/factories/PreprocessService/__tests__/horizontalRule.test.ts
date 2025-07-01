import { describe, it, expect } from "vitest"
import PreprocessService from "../index"

describe("PreprocessService - Horizontal Rule", () => {
	it("should correctly parse horizontal rules with ---", () => {
		const markdown = `
text before

---

text after
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should convert --- to <hr />
		expect(content).toContain("<hr />")
		expect(content).toContain("text before")
		expect(content).toContain("text after")
	})

	it("should correctly parse horizontal rules with ***", () => {
		const markdown = `
text before

***

text after
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should convert *** to <hr />
		expect(content).toContain("<hr />")
	})

	it("should correctly parse horizontal rules with ___", () => {
		const markdown = `
text before

___

text after
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should convert ___ to <hr />
		expect(content).toContain("<hr />")
	})

	it("should handle multiple horizontal rules", () => {
		const markdown = `
First section

---

Second section

***

Third section

___

Fourth section
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should convert all variations to <hr />
		const hrCount = (content.match(/<hr \/>/g) || []).length
		expect(hrCount).toBe(3)
	})

	it("should handle horizontal rules with more than 3 characters", () => {
		const markdown = `
Before

----

Middle

*****

After
		`.trim()

		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should convert extended rules to <hr />
		const hrCount = (content.match(/<hr \/>/g) || []).length
		expect(hrCount).toBe(2)
	})

	it("should not interfere with inline dashes", () => {
		const markdown = "This is a test-case with-dashes in the text"
		const result = PreprocessService.preprocess(markdown, { enableLatex: false })
		const content = result.join(" ")

		// Should not convert inline dashes
		expect(content).not.toContain("<hr />")
		expect(content).toContain("test-case")
		expect(content).toContain("with-dashes")
	})
})
