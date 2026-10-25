import { act, cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Editor, EditorContent } from "@/infrastructure/editors/tiptap/react"
import { StarterKit } from "@/infrastructure/editors/tiptap/starter-kit"
import { SearchAndReplace } from "../search-and-replace-node/search-and-replace-extension"
import { CodeBlockNode } from "./code-block-node-extension"
import {
	escapeCodeHtml,
	highlightCodeHtml,
	type CodeSearchHighlight,
} from "@/components/base/MagicCode/search-highlights"

vi.mock("@/components/base/MagicCode", () => ({
	default: ({
		data,
		searchHighlights,
	}: {
		data: string
		searchHighlights: CodeSearchHighlight[]
	}) => (
		<div
			data-testid="code-preview"
			dangerouslySetInnerHTML={{
				__html: highlightCodeHtml(
					`<pre><code>${escapeCodeHtml(data)}</code></pre>`,
					searchHighlights,
				),
			}}
		/>
	),
}))

describe("read-only code search", () => {
	let editor: Editor
	afterEach(() => {
		cleanup()
		editor?.destroy()
	})

	it("projects matches into the visible node view and updates current, case, regex and clearing", async () => {
		editor = new Editor({
			extensions: [
				StarterKit.configure({ codeBlock: false }),
				CodeBlockNode,
				SearchAndReplace,
			],
			editable: false,
			content: "<p>test</p><pre><code>  function test() {}\nTEST</code></pre>",
		})
		const { container } = render(<EditorContent editor={editor} />)
		await waitFor(() =>
			expect(container.querySelector('[data-testid="code-preview"]')).not.toBeNull(),
		)
		act(() => {
			editor.commands.setSearchTerm("test")
		})
		await waitFor(() =>
			expect(
				container.querySelectorAll('[data-testid="code-preview"] .search-result'),
			).toHaveLength(2),
		)
		expect(editor.storage.searchAndReplace.results).toHaveLength(3)
		act(() => {
			editor.commands.nextSearchResult()
		})
		await waitFor(() =>
			expect(
				container.querySelector('[data-testid="code-preview"] .search-result-current')
					?.textContent,
			).toBe("test"),
		)
		act(() => {
			editor.commands.nextSearchResult()
		})
		await waitFor(() =>
			expect(
				container.querySelector('[data-testid="code-preview"] .search-result-current')
					?.textContent,
			).toBe("TEST"),
		)
		act(() => {
			editor.commands.setCaseSensitive(true)
		})
		await waitFor(() =>
			expect(
				container.querySelectorAll('[data-testid="code-preview"] .search-result'),
			).toHaveLength(1),
		)
		act(() => {
			editor.chain().setDisableRegex(false).setSearchTerm("T.ST").resetIndex().run()
		})
		await waitFor(() =>
			expect(
				container.querySelector('[data-testid="code-preview"] .search-result-current')
					?.textContent,
			).toBe("TEST"),
		)
		act(() => {
			editor.commands.setSearchTerm("")
		})
		await waitFor(() => expect(container.querySelectorAll(".search-result")).toHaveLength(0))
		expect(container.querySelector('[data-testid="code-preview"]')?.textContent).toBe(
			"  function test() {}\nTEST",
		)
	})
})
