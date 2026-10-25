import { act, cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Editor, EditorContent } from "@/infrastructure/editors/tiptap/react"
import { StarterKit } from "@/infrastructure/editors/tiptap/starter-kit"
import { Markdown } from "@/infrastructure/editors/tiptap/markdown"
import { CodeBlockNode } from "./code-block-node-extension"

describe("code block editing", () => {
	let editor: Editor
	afterEach(() => {
		cleanup()
		editor?.destroy()
	})

	it.each([
		["prepend", "gi", "git"],
		["append", "est", "test"],
		["prepend", "第一行\n", "第一行\nt"],
	] as const)("saves and reopens code after %s input", async (operation, input, expected) => {
		let saved = "```\nt\n```"
		editor = new Editor({
			extensions: [StarterKit.configure({ codeBlock: false }), CodeBlockNode, Markdown],
			content: "```\nt\n```",
			onUpdate: ({ editor }) => {
				saved = editor.storage.markdown.getMarkdown()
			},
		})
		const { container } = render(<EditorContent editor={editor} />)
		await waitFor(() =>
			expect(container.querySelector("[data-node-view-content]")).not.toBeNull(),
		)
		const editableCode = container.querySelector("pre > code")
		if (!editableCode) throw new Error("Editable code block is missing")
		// Browser typing mutates the visible code DOM before ProseMirror observes it.
		// Dispatching insertText directly would bypass the wrapper bug entirely.
		await act(async () => {
			editableCode[operation](document.createTextNode(input))
		})
		await waitFor(() => expect(saved).toBe(`\`\`\`\n${expected}\n\`\`\``))
		expect(editor.state.doc.textContent).toBe(expected)
		const reopened = new Editor({
			extensions: [StarterKit.configure({ codeBlock: false }), CodeBlockNode, Markdown],
			content: saved,
		})
		try {
			expect(reopened.state.doc.firstChild?.type.name).toBe("codeBlock")
			expect(reopened.state.doc.textContent).toBe(expected)
		} finally {
			reopened.destroy()
		}
	})
})
