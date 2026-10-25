import {
	defaultProps,
	dispatchIframeMessage,
	flushReactEffects,
	getSetContentCalls,
	hookState,
	renderIsolated,
	useRendererTestSetup,
} from "./IsolatedHTMLRenderer.test-helpers"
import IsolatedHTMLRenderer from "../IsolatedHTMLRenderer"
import { act, fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
	extractSlideNotes,
	stripSlideNotes,
	upsertSlideNotes,
} from "../../../components/PPTRender/utils/slideNotes"

describe("PPT notes and visual editing share the latest source", () => {
	useRendererTestSetup()

	it.each([
		{
			name: "updated notes",
			notes: "New notes",
			isPptRender: true,
			source: "updated",
			expected: "New notes",
		},
		{ name: "cleared notes", notes: "", isPptRender: true, source: "updated", expected: "" },
		{
			name: "removed notes block",
			notes: "",
			isPptRender: true,
			source: "removed",
			expected: "",
		},
		{
			name: "ordinary HTML",
			notes: "New notes",
			isPptRender: false,
			source: "updated",
			expected: "Old notes",
		},
		{
			name: "unavailable host source",
			notes: "New notes",
			isPptRender: true,
			source: "unavailable",
			expected: "Old notes",
		},
	])(
		"keeps $name when an older iframe saves its body",
		async ({ notes, isPptRender, source, expected }) => {
			const original = upsertSlideNotes(
				"<html><body><h1>Before</h1></body></html>",
				"Old notes",
			)
			const latest =
				source === "unavailable"
					? undefined
					: source === "removed"
						? stripSlideNotes(original)
						: upsertSlideNotes(original, notes)
			const edited = original.replace("Before", "Edited title")
			const saveEditContent = vi
				.fn<(content: string) => Promise<boolean>>()
				.mockResolvedValue(true)
			const onSaveReady = vi.fn()
			const props = {
				...defaultProps,
				content: original,
				rawSourceCode: original,
				isPptRender,
				isEditMode: true,
				saveEditContent,
				onSaveReady,
			}
			const view = renderIsolated(<IsolatedHTMLRenderer {...props} />)
			await flushReactEffects()
			const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
			const postMessage = vi
				.spyOn(iframe.contentWindow as Window, "postMessage")
				.mockImplementation(vi.fn())
			fireEvent.load(iframe)
			dispatchIframeMessage(iframe, "iframeReady")
			await flushReactEffects()
			const initialContentWrites = getSetContentCalls(postMessage).length
			expect(initialContentWrites).toBe(1)
			view.rerender(<IsolatedHTMLRenderer {...props} rawSourceCode={latest} />)
			await flushReactEffects()
			// The sandbox keeps a body draft and its old inert metadata. Only the host source changes.
			const options = hookState.editorOptions
			if (!options?.saveEditContent) throw new Error("Visual editor save callback is missing")
			const saveEditorContent = options.saveEditContent
			Object.assign(options.editorRef, {
				current: {
					save: async () => {
						const cleanContent = options.prepareSaveContent?.(edited) ?? edited
						await saveEditorContent(
							cleanContent,
							defaultProps.fileId,
							true,
							undefined,
							true,
						)
						return {
							success: true,
							cleanContent,
							rawContent: edited,
							fileId: defaultProps.fileId,
						}
					},
				},
			})
			let result: { cleanContent: string } | undefined
			const triggerSave = onSaveReady.mock.calls.at(-1)?.[0]
			if (!triggerSave) throw new Error("Renderer save callback is missing")
			await act(async () => {
				result = await triggerSave()
			})
			const saved = saveEditContent.mock.calls[0][0] as string
			expect(extractSlideNotes(saved)).toBe(expected)
			expect(saved).toContain("Edited title")
			expect(result?.cleanContent).toBe(saved)
			expect(screen.getByTestId("isolated-html-content-iframe")).toBe(iframe)
			expect(getSetContentCalls(postMessage)).toHaveLength(initialContentWrites)
		},
	)

	it("also preserves current notes and the original EOF newline for legacy saves", async () => {
		const original = `${upsertSlideNotes("<html><body><h1>Before</h1></body></html>", "Old notes")}\n`
		const latest = upsertSlideNotes(original, "New notes")
		const edited = original.trimEnd().replace("Before", "Edited title")
		const saveEditContent = vi
			.fn<(content: string) => Promise<boolean>>()
			.mockResolvedValue(true)
		const props = {
			...defaultProps,
			content: original,
			rawSourceCode: original,
			isPptRender: true,
			isEditMode: true,
			saveEditContent,
		}
		const view = renderIsolated(<IsolatedHTMLRenderer {...props} />)
		await flushReactEffects()
		const iframe = screen.getByTestId("isolated-html-content-iframe") as HTMLIFrameElement
		view.rerender(<IsolatedHTMLRenderer {...props} rawSourceCode={latest} />)
		dispatchIframeMessage(iframe, "saveContent", window.location.origin, { content: edited })
		await flushReactEffects()
		const saved = saveEditContent.mock.calls[0]?.[0]
		expect(extractSlideNotes(saved ?? "")).toBe("New notes")
		expect(saved).toContain("Edited title")
		expect(saved?.endsWith("\n")).toBe(true)
	})
})
