import { describe, expect, it } from "vitest"
import {
	extractMarkdownFrontmatter,
	parseEditableMarkdownFrontmatter,
	parseMarkdownFrontmatter,
	preprocessMarkdownFrontmatter,
	serializeMarkdownFrontmatter,
} from "../frontmatter-node-utils"

describe("frontmatter-node-utils", () => {
	it("extracts yaml frontmatter from markdown", () => {
		const markdown = ["---", "title: Demo", "tags:", "  - tiptap", "---", "", "Body"].join("\n")

		expect(extractMarkdownFrontmatter(markdown)).toEqual({
			raw: "title: Demo\ntags:\n  - tiptap",
			body: "\nBody",
		})
	})

	it("preprocesses frontmatter into an html placeholder", () => {
		const markdown = ["---", "title: Demo", "---", "", "Body"].join("\n")
		const result = preprocessMarkdownFrontmatter(markdown)

		expect(result).toContain('data-type="markdown-frontmatter"')
		expect(result).toContain("data-frontmatter-raw=")
		expect(result).toContain("Body")
	})

	it("serializes raw yaml into markdown frontmatter", () => {
		expect(serializeMarkdownFrontmatter("title: Demo")).toBe("---\ntitle: Demo\n---")
	})

	it("parses editable yaml block into raw yaml", () => {
		const editableValue = ["---", "title: Demo", "published: true", "---"].join("\n")

		expect(parseEditableMarkdownFrontmatter(editableValue)).toBe("title: Demo\npublished: true")
	})

	it("parses yaml values for validation", () => {
		const result = parseMarkdownFrontmatter("title: Demo\npublished: true")

		expect(result.error).toBeNull()
		expect(result.data).toEqual({
			title: "Demo",
			published: true,
		})
	})

	it("returns a parse error for invalid yaml", () => {
		const result = parseMarkdownFrontmatter("title: [demo")

		expect(result.error).toBeInstanceOf(Error)
		expect(result.data).toBeNull()
	})
})
