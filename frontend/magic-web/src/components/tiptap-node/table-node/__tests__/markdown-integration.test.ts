import { afterEach, describe, expect, it } from "vitest"
import { Editor } from "@/infrastructure/editors/tiptap/core"
import { StarterKit } from "@/infrastructure/editors/tiptap/starter-kit"
import { TableCell, TableHeader, TableRow } from "@/infrastructure/editors/tiptap/extension-table"
import { Markdown } from "@/infrastructure/editors/tiptap/markdown"
import { TableWithWrapper } from "../table-node-extension"

describe("table markdown round-trip", () => {
	const editors: Editor[] = []
	function createEditor(content: string) {
		const editor = new Editor({
			extensions: [StarterKit, TableWithWrapper, TableRow, TableCell, TableHeader, Markdown],
			content,
		})
		editors.push(editor)
		return editor
	}
	afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()))

	it("saves Enter inside a header as a table and preserves the line break when reopened", () => {
		const editor = createEditor("| firstsecond | empty |\n| --- | --- |\n| body | |")
		editor.commands.setTextSelection(9)
		expect(editor.commands.splitBlock()).toBe(true)
		const markdown = editor.storage.markdown.getMarkdown()
		expect(markdown).toContain("| first<br>second | empty |")
		expect(markdown).not.toContain("<table")
		expect(markdown).not.toContain("tableWrapper")
		const reopened = createEditor(markdown)
		expect(reopened.state.doc.firstChild?.type.name).toBe("table")
		expect(reopened.getHTML()).toContain("first<br>second")
		expect(reopened.storage.markdown.getMarkdown()).toBe(markdown)
	})

	it("preserves body paragraphs, blank lines, formatting and escaped pipe characters", () => {
		const editor = createEditor(
			"<table><tr><th><p>Header</p></th></tr><tr><td><p><strong>one | two</strong></p><p></p><p>three</p></td></tr></table>",
		)
		const markdown = editor.storage.markdown.getMarkdown()
		expect(markdown).toContain("**one \\| two**<br><br>three")
		const reopened = createEditor(markdown)
		expect(reopened.getHTML()).toContain("<strong>one | two</strong><br><br>three")
	})

	it.each(["<p>text</p><p></p>", "<p></p><p></p><p></p>"])(
		"preserves trailing and empty-cell line breaks across repeated saves: %s",
		(content) => {
			const editor = createEditor(
				`<table><tr><th>${content}</th></tr><tr><td>body</td></tr></table>`,
			)
			const markdown = editor.storage.markdown.getMarkdown()
			expect(markdown).toContain("<br>")
			const reopened = createEditor(markdown)
			expect(reopened.storage.markdown.getMarkdown()).toBe(markdown)
		},
	)

	it.each([
		'<table><tr><th colspan="2"><p>merged</p></th></tr><tr><td>a</td><td>b</td></tr></table>',
		"<table><tr><th>Header</th></tr><tr><td><ul><li><p>item</p></li></ul></td></tr></table>",
	])("keeps unsupported table structures intact", (content) => {
		const editor = createEditor(content)
		const markdown = editor.storage.markdown.getMarkdown()
		expect(markdown).toContain("<table")
		expect(createEditor(markdown).getJSON()).toEqual(editor.getJSON())
	})
})
