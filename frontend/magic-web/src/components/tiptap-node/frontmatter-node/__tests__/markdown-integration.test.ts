import { afterEach, describe, expect, it } from "vitest"
import { Editor } from "@tiptap/core"
import Document from "@tiptap/extension-document"
import Paragraph from "@tiptap/extension-paragraph"
import Text from "@tiptap/extension-text"
import { Markdown } from "tiptap-markdown"
import { MarkdownFrontmatterNode } from "../frontmatter-node-extension"
import { preprocessMarkdownFrontmatter } from "../frontmatter-node-utils"

describe("MarkdownFrontmatterNode markdown integration", () => {
	let editor: Editor | null = null

	function createEditor(content = "") {
		editor = new Editor({
			extensions: [Document, Paragraph, Text, MarkdownFrontmatterNode, Markdown],
			content,
		})

		return editor
	}

	afterEach(() => {
		if (!editor) return

		editor.destroy()
		editor = null
	})

	it("parses frontmatter into a dedicated node and keeps markdown round-trip", () => {
		const originalMarkdown = [
			"---",
			"title: Demo",
			"tags:",
			"  - alpha",
			"  - beta",
			"published: true",
			"---",
			"",
			"Body text",
		].join("\n")

		const editor = createEditor(preprocessMarkdownFrontmatter(originalMarkdown))
		const json = editor.getJSON()

		expect(json.content?.[0]).toMatchObject({
			type: "markdownFrontmatter",
			attrs: {
				raw: "title: Demo\ntags:\n  - alpha\n  - beta\npublished: true",
			},
		})

		// @ts-expect-error - markdown storage extension
		const resultMarkdown = editor.storage.markdown.getMarkdown()

		expect(resultMarkdown).toContain("---\ntitle: Demo")
		expect(resultMarkdown).toContain("published: true\n---")
		expect(resultMarkdown).toContain("Body text")
	})

	it("leaves normal markdown untouched", () => {
		const editor = createEditor(preprocessMarkdownFrontmatter("Plain text"))

		expect(editor.getJSON().content?.[0]).toMatchObject({
			type: "paragraph",
		})
	})

	it("toggles frontmatter only at document start", () => {
		const editor = createEditor("Body text")

		editor.commands.toggleFrontmatterAtStart("title: Demo")

		expect(editor.getJSON().content?.[0]).toMatchObject({
			type: "markdownFrontmatter",
			attrs: {
				raw: "title: Demo",
			},
		})

		// @ts-expect-error - markdown storage extension
		expect(editor.storage.markdown.getMarkdown()).toContain("---\ntitle: Demo\n---")

		editor.commands.toggleFrontmatterAtStart()

		expect(editor.getJSON().content?.[0]).toMatchObject({
			type: "paragraph",
		})

		// @ts-expect-error - markdown storage extension
		expect(editor.storage.markdown.getMarkdown()).not.toContain("---\ntitle: Demo\n---")
	})
})
