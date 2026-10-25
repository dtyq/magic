import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { pptNotesPreferenceStore } from "@/stores/layout/PPTNotesPreferenceStore"
import { extractSlideNotes } from "../../utils/slideNotes"
import { unshadow } from "@/utils/shadow"
import SpeakerNotesEditor from "../SpeakerNotesEditor"
import type { Editor } from "@/infrastructure/editors/tiptap/core"

const runtime = vi.hoisted(() => ({ editor: null as Editor | null }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
// Use a small real Tiptap runtime: the notes wrapper, patch extension and save path are real.
vi.mock("@/components/tiptap-templates/simple/simple-editor", async () => {
	const React = await import("react")
	const { useEditor, EditorContent } = await import("@/infrastructure/editors/tiptap/react")
	const { StarterKit } = await import("@/infrastructure/editors/tiptap/starter-kit")
	const { Markdown } = await import("@/infrastructure/editors/tiptap/markdown")
	return {
		SimpleEditor: React.forwardRef(function Runtime(
			props: import("@/components/tiptap-templates/simple/types").SimpleEditorProps,
			ref,
		) {
			const editor = useEditor({
				extensions: [StarterKit, Markdown, ...(props.additionalExtensions ?? [])],
				content: props.content,
				onUpdate: ({ editor }) =>
					props.onContentChange?.(editor.storage.markdown.getMarkdown()),
			})
			React.useEffect(() => {
				editor?.setEditable(props.isEditable !== false)
			}, [editor, props.isEditable])
			React.useImperativeHandle(ref, () => ({ editor }), [editor])
			runtime.editor = editor
			return <EditorContent editor={editor} />
		}),
	}
})
function setup({ autoApply = true, saveSuccess = true } = {}) {
	pptNotesPreferenceStore.setAutoApply(autoApply)
	const saveEditContent = vi.fn().mockResolvedValue(saveSuccess)
	const onGenerate = vi.fn().mockResolvedValue("新的开场\n\n保留段落\n\n新的结尾")
	const props = {
		slideIndex: 0,
		fileId: "one",
		rawContent:
			'<main>Slide</main><template data-magic-slide-notes data-format="plain-text" data-version="1">旧的开场\n\n保留段落\n\n旧的结尾</template>',
		allowEdit: true,
		onSaved: vi.fn().mockResolvedValue(undefined),
		saveEditContent,
		onGenerate,
		isCurrentPage: true,
		onSaveStateChange: vi.fn(),
		onDraftChange: vi.fn(),
		onDraftSaved: vi.fn(),
	}
	render(<SpeakerNotesEditor {...props} />)
	return props
}
beforeEach(() => {
	localStorage.clear()
	vi.stubGlobal(
		"matchMedia",
		vi.fn(() => ({ matches: true })),
	)
})
afterEach(() => {
	runtime.editor = null
	vi.unstubAllGlobals()
})
describe("notes AI integration", () => {
	it("applies the response, persists only notes and preserves undo", async () => {
		const props = setup()
		await waitFor(() => expect(runtime.editor).not.toBeNull())
		fireEvent.click(screen.getByText("ppt.speakerNotes.polish"))
		await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1))
		expect(extractSlideNotes(unshadow(props.saveEditContent.mock.calls[0][0]))).toContain(
			"新的开场",
		)
		expect(unshadow(props.saveEditContent.mock.calls[0][0])).toContain("<main>Slide</main>")
		expect(runtime.editor?.getText()).toContain("新的结尾")
		act(() => {
			runtime.editor?.commands.undo()
		})
		expect(runtime.editor?.getText()).toContain("旧的开场")
		expect(props.onDraftChange).toHaveBeenCalled()
	})
	it("keeps manual suggestions out of saved notes and retains pending items across saves", async () => {
		const props = setup({ autoApply: false })
		fireEvent.click(screen.getByText("ppt.speakerNotes.polish"))
		await screen.findByText("ppt.speakerNotes.acceptAllChanges")
		expect(props.saveEditContent).not.toHaveBeenCalled()
		expect(runtime.editor?.getText()).toContain("旧的开场")
		fireEvent.click(screen.getByText("ppt.speakerNotes.acceptChange"))
		expect(props.onSaved).not.toHaveBeenCalled()
		expect(screen.getByText("ppt.speakerNotes.acceptAllChanges")).toBeEnabled()
		fireEvent.click(screen.getByText("ppt.speakerNotes.rejectAllChanges"))
		expect(runtime.editor?.getText()).toContain("旧的结尾")
		expect(runtime.editor?.getText()).toContain("新的开场")
		await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1))
	})
	it("retains an applied draft when saving fails and allows retry", async () => {
		const props = setup({ saveSuccess: false })
		fireEvent.click(screen.getByText("ppt.speakerNotes.polish"))
		await waitFor(() => expect(props.saveEditContent).toHaveBeenCalledTimes(1))
		expect(runtime.editor?.getText()).toContain("新的开场")
		props.saveEditContent.mockResolvedValue(true)
		fireEvent.click(screen.getByText("ppt.speakerNotes.save"))
		await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1))
	})
})
