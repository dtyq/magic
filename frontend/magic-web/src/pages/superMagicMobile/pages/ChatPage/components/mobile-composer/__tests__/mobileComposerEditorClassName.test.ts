import { describe, expect, it } from "vitest"
import { getMobileComposerEditorClassName } from "../mobileComposerEditorClassName"

const TRAILING_BREAK_HIDDEN = "ProseMirror-trailingBreak]:hidden"
const TRAILING_BREAK_VISIBLE = "ProseMirror-trailingBreak]:inline"

describe("getMobileComposerEditorClassName", () => {
	it("lets the placeholder own the height when it has text", () => {
		const className = getMobileComposerEditorClassName("有什么可以帮你的吗？")

		// The in-flow placeholder replaces the caret line, so hiding the auxiliary <br>
		// prevents a blank row under the prompt text.
		expect(className).toContain(TRAILING_BREAK_HIDDEN)
		expect(className).not.toContain(TRAILING_BREAK_VISIBLE)
	})

	it.each([
		["empty", ""],
		["whitespace only", "   "],
		["undefined", undefined],
		["null", null],
	])("keeps one text line when the placeholder is %s", (_label, placeholder) => {
		const className = getMobileComposerEditorClassName(placeholder)

		// Without placeholder text the ::before block collapses to zero height, so the paragraph
		// needs its own line box back; otherwise the dock shrinks to 0px and the caret vanishes.
		expect(className).toContain(TRAILING_BREAK_VISIBLE)
		expect(className).not.toContain(TRAILING_BREAK_HIDDEN)
	})

	it("keeps the in-flow placeholder layout in both states", () => {
		for (const placeholder of ["提示文案", ""]) {
			const className = getMobileComposerEditorClassName(placeholder)

			expect(className).toContain(
				"[&_.ProseMirror_.is-editor-empty:first-child::before]:block",
			)
			expect(className).toContain(
				"[&_.ProseMirror_.is-editor-empty:first-child::before]:whitespace-normal",
			)
			expect(className).toContain("min-h-0")
		}
	})
})
