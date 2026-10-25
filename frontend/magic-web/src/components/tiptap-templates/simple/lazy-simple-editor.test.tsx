import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { forwardRef, useImperativeHandle, useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SimpleEditorRef } from "./types"
import { LazySimpleEditor } from "./lazy-simple-editor"

const onReady = vi.fn()
const setContent = vi.fn()

vi.mock("./simple-editor", () => ({
	SimpleEditor: forwardRef<SimpleEditorRef, { content?: string }>(function MockSimpleEditor(
		{ content },
		ref,
	) {
		const [editor, setEditor] = useState<SimpleEditorRef["editor"]>(null)
		useImperativeHandle(ref, () => ({ editor, setContent }), [editor])
		return (
			<div data-testid="lazy-simple-editor-loaded">
				{content}
				<button onClick={() => setEditor({} as NonNullable<SimpleEditorRef["editor"]>)}>
					Initialize TipTap
				</button>
			</div>
		)
	}),
}))

describe("LazySimpleEditor", () => {
	beforeEach(() => {
		onReady.mockClear()
		setContent.mockClear()
	})

	it("loads the editor on demand and exposes its ref after initialization", async () => {
		const editorRef = { current: null as SimpleEditorRef | null }

		render(<LazySimpleEditor ref={editorRef} content="lazy content" onReady={onReady} />)

		expect(screen.getByTestId("simple-editor-loading")).toBeInTheDocument()
		await waitFor(() =>
			expect(screen.getByTestId("lazy-simple-editor-loaded")).toBeInTheDocument(),
		)

		expect(editorRef.current).not.toBeNull()
		expect(onReady).not.toHaveBeenCalled()
		fireEvent.click(screen.getByText("Initialize TipTap"))
		expect(onReady).toHaveBeenCalledWith(editorRef.current)
	})

	it("notifies readiness once when the parent callback identity changes", async () => {
		const firstReady = vi.fn()
		const secondReady = vi.fn()
		const { rerender } = render(<LazySimpleEditor content="first" onReady={firstReady} />)

		await screen.findByText("Initialize TipTap")
		fireEvent.click(screen.getByText("Initialize TipTap"))
		expect(firstReady).toHaveBeenCalledTimes(1)

		rerender(<LazySimpleEditor content="second" onReady={secondReady} />)

		expect(firstReady).toHaveBeenCalledTimes(1)
		expect(secondReady).not.toHaveBeenCalled()
	})

	it("transfers the handle when the forwarded ref changes and clears it on unmount", async () => {
		const first = { current: null as SimpleEditorRef | null }
		const second = { current: null as SimpleEditorRef | null }
		const { rerender, unmount } = render(<LazySimpleEditor ref={first} onReady={onReady} />)
		await waitFor(() => expect(first.current).not.toBeNull())
		fireEvent.click(screen.getByText("Initialize TipTap"))
		const handle = first.current
		rerender(<LazySimpleEditor ref={second} onReady={onReady} />)
		expect(first.current).toBeNull()
		expect(second.current?.editor).toBe(handle?.editor)
		expect(onReady).toHaveBeenCalledTimes(1)
		unmount()
		expect(second.current).toBeNull()
	})
})
