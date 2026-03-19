import type { JSONContent } from "@tiptap/core"
import { describe, expect, it } from "vitest"
import { collectMarkdownImages, collectRichTextNodes } from "../getMessageImage"

describe("getMessageImage", () => {
	describe("collectRichTextNodes", () => {
		it("should collect matching nodes from a simple structure", () => {
			const data: JSONContent = {
				type: "doc",
				content: [{ type: "image", attrs: { src: "test.jpg" } }, { type: "paragraph" }],
			}
			const result = collectRichTextNodes(data, ["image"], [])
			expect(result).toEqual([{ type: "image", attrs: { src: "test.jpg" } }])
		})

		it("should collect matching nodes from a nested structure", () => {
			const data: JSONContent = {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "image", attrs: { src: "test.jpg" } }, { type: "text" }],
					},
				],
			}
			const result = collectRichTextNodes(data, ["image"], [])
			expect(result).toEqual([{ type: "image", attrs: { src: "test.jpg" } }])
		})

		it("should handle empty or invalid input", () => {
			expect(collectRichTextNodes(null as any, ["image"], [])).toEqual([])
			expect(collectRichTextNodes({} as JSONContent, ["image"], [])).toEqual([])
		})
	})

	describe("collectMarkdownImages", () => {
		it("should collect markdown images", () => {
			const mdText = "![test](test.jpg)"
			const result = collectMarkdownImages(mdText)
			expect(result).toEqual(["test.jpg"])
		})

		it("should handle empty or invalid input", () => {
			expect(collectMarkdownImages(null as any)).toEqual([])
			expect(collectMarkdownImages("")).toEqual([])
		})

		it("should handle markdown links", () => {
			const mdText = "[test](test.jpg)"
			const result = collectMarkdownImages(mdText)
			expect(result).toEqual([])
		})

		it("should handle markdown inline images", () => {
			const mdText = "![](test.jpg)"
			const result = collectMarkdownImages(mdText)
			expect(result).toEqual(["test.jpg"])
		})

		it("should handle markdown image references", () => {
			const mdText = "[![test](test.jpg)](test.jpg)"
			const result = collectMarkdownImages(mdText)
			expect(result).toEqual(["test.jpg"])
		})

		it("should handle markdown image references with title", () => {
			const mdText = "[![test](test.jpg) title](test.jpg)"
			const result = collectMarkdownImages(mdText)
			expect(result).toEqual(["test.jpg"])
		})

		it("multiple images", () => {
			const mdText = `
      ![](test.jpg)
      ![](test2.jpg)
      `
			const result = collectMarkdownImages(mdText)
			expect(result).toEqual(["test.jpg", "test2.jpg"])
		})

		it("multiple images with links", () => {
			const mdText = `
      [![test](test.jpg)](test.jpg)
      [![test2](test2.jpg)](test2.jpg)
      `
			const result = collectMarkdownImages(mdText)
			expect(result).toEqual(["test.jpg", "test2.jpg"])
		})
	})
})
