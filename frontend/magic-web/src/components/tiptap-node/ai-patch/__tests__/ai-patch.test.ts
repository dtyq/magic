import { afterEach, describe, expect, it, vi } from "vitest"
import { Editor } from "@/infrastructure/editors/tiptap/core"
import { StarterKit } from "@/infrastructure/editors/tiptap/starter-kit"
import { Markdown } from "@/infrastructure/editors/tiptap/markdown"
import { LinkNode } from "@/components/tiptap-node/link-node/link-node-extension"
import { HeadingNode } from "@/components/tiptap-node/heading-node/heading-node-extension"
import { AiPatch, getAiPatchState, proposeAiPatchMarkdown } from ".."

describe("AiPatch", () => {
	const editors: Editor[] = []
	function createEditor(content: string) {
		const editor = new Editor({
			extensions: [StarterKit.configure({ link: false }), LinkNode, Markdown, AiPatch],
			content,
		})
		editors.push(editor)
		return editor
	}
	function propose(editor: Editor, markdown: string) {
		expect(proposeAiPatchMarkdown(editor, markdown, { autoApply: false })).toBe(true)
		return getAiPatchState(editor.state).patches
	}
	afterEach(() => {
		editors.splice(0).forEach((editor) => editor.destroy())
		vi.useRealTimers()
		vi.unstubAllGlobals()
	})

	it("aligns repeated Chinese text and emoji without replacing unchanged ranges", () => {
		const editor = createEditor("今天介绍项目。今天介绍项目。😀")
		const patches = propose(editor, "今天介绍项目。今天汇报进展。😃")
		expect(patches.every((patch) => patch.kind === "inline")).toBe(true)
		expect(patches[0].from).toBeGreaterThan(8)
		expect(editor.getText()).toBe("今天介绍项目。今天介绍项目。😀")
		expect(editor.commands.acceptAiPatch()).toBe(true)
		expect(editor.getText()).toBe("今天介绍项目。今天汇报进展。😃")
		expect(getAiPatchState(editor.state).appliedRevision).toBe(1)
		expect(editor.commands.undo()).toBe(true)
		expect(editor.getText()).toBe("今天介绍项目。今天介绍项目。😀")
		expect(getAiPatchState(editor.state).patches).toHaveLength(0)
	})

	it("preserves heading/list structure and inline formatting through Markdown parsing", () => {
		const editor = createEditor("# 标题\n\n普通文字\n\n保留段落")
		const patches = propose(editor, "## 标题\n\n- **重点**\n- 第二项\n\n保留段落")
		expect(patches.some((patch) => patch.kind === "block")).toBe(true)
		expect(editor.commands.acceptAiPatch()).toBe(true)
		expect(editor.getHTML()).toContain("<h2>标题</h2>")
		expect(editor.getHTML()).toContain("<strong>重点</strong>")
		expect(editor.state.doc.child(1).type.name).toBe("bulletList")
		expect(editor.state.doc.lastChild?.textContent).toBe("保留段落")
	})

	it("represents a formatting-only change even when the text is identical", () => {
		const editor = createEditor("今天介绍项目")
		const patches = propose(editor, "今天**介绍**项目")
		expect(patches).toHaveLength(1)
		expect(patches[0].oldText).toBe("介绍")
		expect(patches[0].newText).toBe("介绍")
		expect(editor.commands.acceptAiPatch()).toBe(true)
		expect(editor.getHTML()).toContain("今天<strong>介绍</strong>项目")
	})

	it("supports additions and deletions without rebuilding the document", () => {
		const editor = createEditor("保留\n\n删除\n\n结尾")
		propose(editor, "新增\n\n保留\n\n结尾")
		expect(editor.commands.acceptAiPatch()).toBe(true)
		expect(editor.getText()).toBe("新增\n\n保留\n\n结尾")
	})

	it("accepts one item and rejects remaining items without storing previews in content", () => {
		const editor = createEditor("aaa\n\n保留\n\nbbb")
		const patches = propose(editor, "AAA\n\n保留\n\nBBB")
		expect(patches).toHaveLength(2)
		expect(editor.view.dom.querySelectorAll(".ai-patch-preview")).toHaveLength(2)
		expect(editor.storage.markdown.getMarkdown()).toBe("aaa\n\n保留\n\nbbb")
		expect(editor.commands.acceptAiPatch(patches[0].id)).toBe(true)
		expect(getAiPatchState(editor.state).phase).toBe("review")
		expect(getAiPatchState(editor.state).appliedRevision).toBe(1)
		expect(editor.commands.rejectAiPatch()).toBe(true)
		expect(editor.getText()).toBe("AAA\n\n保留\n\nbbb")
		expect(getAiPatchState(editor.state).patches).toHaveLength(0)
	})

	it("maps a suggestion over non-overlapping user edits and retains its stable id", () => {
		const editor = createEditor("前言\n\nold")
		const [patch] = propose(editor, "前言\n\nnew")
		editor.view.dispatch(editor.state.tr.insertText("新增", 1))
		const [mapped] = getAiPatchState(editor.state).patches
		expect(mapped.id).toBe(patch.id)
		expect(mapped.from).toBe(patch.from + 2)
		expect(editor.commands.acceptAiPatch(patch.id)).toBe(true)
		expect(editor.getText()).toBe("新增前言\n\nnew")
	})

	it("invalidates only overlapping suggestions when the user edits inside one", () => {
		const editor = createEditor("old\n\n保留\n\nlast")
		const [first, second] = propose(editor, "NEW\n\n保留\n\nEND")
		editor.view.dispatch(editor.state.tr.insertText("用户", first.from + 1))
		expect(getAiPatchState(editor.state).patches.map((patch) => patch.id)).toEqual([second.id])
		expect(getAiPatchState(editor.state).invalidatedCount).toBe(1)
		expect(editor.commands.acceptAiPatch(first.id)).toBe(false)
		expect(editor.commands.acceptAiPatch()).toBe(true)
		expect(editor.getText()).toBe("o用户ld\n\n保留\n\nEND")
	})

	it("invalidates a pending replacement on overlapping marks with an empty position map", () => {
		const editor = createEditor("old")
		const [patch] = propose(editor, "new")
		editor.view.dispatch(
			editor.state.tr.addMark(patch.from, patch.to, editor.schema.marks.bold.create()),
		)
		expect(getAiPatchState(editor.state).patches).toHaveLength(0)
		expect(getAiPatchState(editor.state).invalidatedCount).toBe(1)
	})

	it("rejects a late result whose request document has changed", () => {
		const editor = createEditor("原文")
		const expectedDoc = editor.getJSON()
		editor.view.dispatch(editor.state.tr.insertText("用户输入", 1))
		expect(proposeAiPatchMarkdown(editor, "新文", { expectedDoc })).toBe(false)
		expect(editor.getText()).toBe("用户输入原文")
		expect(getAiPatchState(editor.state).patches).toHaveLength(0)
	})

	it("isolates accept in history from immediately following user typing", () => {
		const editor = createEditor("old")
		propose(editor, "new")
		editor.commands.acceptAiPatch()
		editor.view.dispatch(editor.state.tr.insertText("!", 4))
		editor.commands.undo()
		expect(editor.getText()).toBe("new")
		editor.commands.undo()
		expect(editor.getText()).toBe("old")
	})

	it("applies automatically after removing, then clears the added decoration", () => {
		vi.useFakeTimers()
		const editor = createEditor("old")
		expect(proposeAiPatchMarkdown(editor, "new")).toBe(true)
		expect(getAiPatchState(editor.state).phase).toBe("removing")
		expect(editor.getText()).toBe("old")
		vi.advanceTimersByTime(180)
		expect(editor.getText()).toBe("new")
		expect(getAiPatchState(editor.state).phase).toBe("inserted")
		vi.advanceTimersByTime(220)
		expect(getAiPatchState(editor.state).phase).toBe("idle")
		expect(editor.view.dom.querySelector(".ai-patch-added")).toBeNull()
	})

	it("skips the removal delay for reduced motion", () => {
		vi.useFakeTimers()
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({ matches: true })),
		)
		const editor = createEditor("old")
		proposeAiPatchMarkdown(editor, "new")
		vi.advanceTimersByTime(0)
		expect(editor.getText()).toBe("new")
	})

	it("cleans pending automatic timers when suggestions are cleared or editor is destroyed", () => {
		vi.useFakeTimers()
		const editor = createEditor("old")
		proposeAiPatchMarkdown(editor, "new")
		editor.commands.clearAiPatches()
		vi.advanceTimersByTime(500)
		expect(editor.getText()).toBe("old")
		proposeAiPatchMarkdown(editor, "new")
		const dispatch = vi.spyOn(editor.view, "dispatch")
		editor.destroy()
		dispatch.mockClear()
		vi.advanceTimersByTime(500)
		expect(dispatch).not.toHaveBeenCalled()
	})

	it("does not accept read-only content and retains pending manual suggestions", () => {
		const editor = createEditor("old")
		propose(editor, "new")
		editor.setEditable(false)
		expect(editor.commands.acceptAiPatch()).toBe(false)
		expect(getAiPatchState(editor.state).patches).toHaveLength(1)
		editor.setEditable(true)
		expect(editor.commands.acceptAiPatch()).toBe(true)
		expect(editor.getText()).toBe("new")
	})

	it("renders schema-sanitized previews without executable HTML or unsafe links", () => {
		const editor = createEditor("原文")
		propose(
			editor,
			'安全 [链接](https://example.com)\n\n<script>window.aiPatchExecuted = true</script><p onclick="alert(1)">正文 <a href="javascript:alert(1)">危险链接</a></p>',
		)
		expect(editor.view.dom.querySelector("script,[onclick],a[href^='javascript:']")).toBeNull()
		expect(editor.view.dom.querySelector('a[href="https://example.com"]')).not.toBeNull()
		expect(editor.commands.acceptAiPatch()).toBe(true)
		expect(editor.getHTML()).not.toMatch(/script|onclick|javascript:/)
		expect(editor.getHTML()).toContain('href="https://example.com"')
	})

	it("does not revive superseded automatic suggestions or change content for identical input", () => {
		vi.useFakeTimers()
		const editor = createEditor("原文")
		proposeAiPatchMarkdown(editor, "旧结果")
		proposeAiPatchMarkdown(editor, "最新结果")
		vi.advanceTimersByTime(180)
		expect(editor.getText()).toBe("最新结果")
		const appliedRevision = getAiPatchState(editor.state).appliedRevision
		propose(editor, "最新结果")
		expect(getAiPatchState(editor.state).patches).toHaveLength(0)
		expect(getAiPatchState(editor.state).appliedRevision).toBe(appliedRevision)
	})

	it.each([
		["- 一\n- 二", "- 一\n  - 嵌套\n- 二"],
		["# 标题\n\n段落", "段落\n\n# 标题"],
		["**粗体** 和 *斜体*", "*粗体* 和 **斜体**"],
		["前\n\n中\n\n后", "前\n\n后"],
		["", "# 新备注\n\n第一段\n\n第二段"],
		["[链接](https://old.example.com)", "[链接](https://new.example.com)"],
	])("accepting parsed document patches round-trips %s", (before, after) => {
		const editor = createEditor(before)
		const expected = createEditor(after)
		// StarterKit normalizes a trailing paragraph on the first transaction, not during construction.
		expected.view.dispatch(expected.state.tr)
		propose(editor, after)
		expect(editor.commands.acceptAiPatch()).toBe(true)
		expect(editor.getJSON()).toEqual(expected.getJSON())
	})

	it.each(["javascript:alert(1)", "data:text/html,danger", "file:///etc/passwd"])(
		"drops the unsafe link protocol %s from preview and accepted content",
		(href) => {
			const editor = createEditor("原文")
			propose(editor, `<p><a href="${href}">链接</a></p>`)
			expect(editor.view.dom.querySelector(".ai-patch-preview a")).toBeNull()
			editor.commands.acceptAiPatch()
			expect(editor.getHTML()).not.toContain("href=")
		},
	)

	it("refuses empty or entirely unsafe output instead of replacing the original", () => {
		const editor = createEditor("原文")
		expect(proposeAiPatchMarkdown(editor, " ")).toBe(false)
		expect(proposeAiPatchMarkdown(editor, "<script>alert(1)</script>")).toBe(false)
		expect(editor.getText()).toBe("原文")
		expect(getAiPatchState(editor.state).patches).toHaveLength(0)
	})

	it("preserves generated heading IDs and only changes the requested text", () => {
		const editor = new Editor({
			extensions: [StarterKit.configure({ heading: false }), HeadingNode, Markdown, AiPatch],
			content: '<h1 id="original-heading">标题</h1><p>old</p>',
		})
		editors.push(editor)
		const patches = propose(editor, "# 标题\n\nnew")
		expect(patches).toHaveLength(1)
		expect(patches[0].kind).toBe("inline")
		expect(patches[0].oldText).toBe("old")
		editor.commands.acceptAiPatch()
		expect(editor.state.doc.firstChild?.attrs.id).toBe("original-heading")
	})
})
