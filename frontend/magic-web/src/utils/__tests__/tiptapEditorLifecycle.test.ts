import { describe, expect, it, vi } from "vitest"
import { isEditorActive, runActiveEditor } from "../tiptapEditorLifecycle"
import type { Editor } from "@/infrastructure/editors/tiptap/react"

function createEditorLike(overrides: Partial<Editor> & { isDestroyed: boolean }) {
	return overrides as Editor
}

function createActiveEditorLike(overrides: Partial<Editor> = {}) {
	return createEditorLike({
		isDestroyed: false,
		commands: {
			insertContent: vi.fn(),
			focus: vi.fn(),
		} as unknown as Editor["commands"],
		...overrides,
	})
}

describe("tiptapEditorLifecycle", () => {
	it("skips destroyed editors without touching commands", () => {
		const commandsGetter = vi.fn()
		const editor = createEditorLike({ isDestroyed: true })

		Object.defineProperty(editor, "commands", {
			get: commandsGetter,
		})

		const result = runActiveEditor<unknown>(
			editor,
			(activeEditor) => activeEditor.commands,
			"fallback",
		)

		expect(result).toBe("fallback")
		expect(commandsGetter).not.toHaveBeenCalled()
		expect(isEditorActive(editor)).toBe(false)
	})

	it("skips values that are not TipTap editors", () => {
		const action = vi.fn()
		const result = runActiveEditor({} as Editor, action, "fallback")

		expect(result).toBe("fallback")
		expect(action).not.toHaveBeenCalled()
		expect(isEditorActive({} as Editor)).toBe(false)
	})

	it("falls back when TipTap command getters throw after a lifecycle race", () => {
		const editor = createEditorLike({ isDestroyed: false })

		Object.defineProperty(editor, "commands", {
			get() {
				throw new TypeError("Cannot read properties of null (reading 'commands')")
			},
		})

		const result = runActiveEditor<unknown>(
			editor,
			(activeEditor) => activeEditor.commands,
			"fallback",
		)

		expect(result).toBe("fallback")
	})

	it("skips editor-like values missing required mention commands", () => {
		const action = vi.fn()
		const editor = createEditorLike({
			isDestroyed: false,
			commands: {} as Editor["commands"],
		})

		const result = runActiveEditor(editor, action, "fallback")

		expect(result).toBe("fallback")
		expect(action).not.toHaveBeenCalled()
		expect(isEditorActive(editor)).toBe(false)
	})

	it("rethrows non-lifecycle errors", () => {
		const editor = createActiveEditorLike()

		expect(() =>
			runActiveEditor(editor, () => {
				throw new Error("business invariant failed")
			}),
		).toThrow("business invariant failed")
	})
})
