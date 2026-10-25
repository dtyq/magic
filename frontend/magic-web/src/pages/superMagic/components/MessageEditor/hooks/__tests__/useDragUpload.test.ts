import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MAGIC_NODE_DRAG_MIME } from "../../extensions/node-drag"
import { useDragUpload } from "../useDragUpload"

function createDragEvent(types: string[]) {
	return {
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
		dataTransfer: {
			types,
			files: [],
		},
	} as unknown as React.DragEvent
}

describe("useDragUpload", () => {
	afterEach(() => {
		document.documentElement.classList.remove(
			"magic-node-pointer-pending",
			"magic-node-dragging",
		)
	})

	it("does not show the upload overlay for editor node drags", () => {
		const { result } = renderHook(() => useDragUpload({ onFilesDropped: vi.fn() }))
		const event = createDragEvent([MAGIC_NODE_DRAG_MIME])

		act(() => result.current.dragEvents.onDragEnter(event))
		result.current.dragEvents.onDragOver(event)
		result.current.dragEvents.onDrop(event)

		expect(result.current.isDragOver).toBe(false)
		expect(event.preventDefault).not.toHaveBeenCalled()
		expect(event.stopPropagation).not.toHaveBeenCalled()
	})

	it("does not show the upload overlay during pointer node drags", () => {
		document.documentElement.classList.add("magic-node-pointer-pending")
		const { result } = renderHook(() => useDragUpload({ onFilesDropped: vi.fn() }))
		const event = createDragEvent(["Files", "text/plain"])

		act(() => result.current.dragEvents.onDragEnter(event))

		expect(result.current.isDragOver).toBe(false)
		expect(event.preventDefault).not.toHaveBeenCalled()
		expect(event.stopPropagation).not.toHaveBeenCalled()
	})

	it("keeps file drag behavior unchanged", () => {
		const { result } = renderHook(() => useDragUpload({ onFilesDropped: vi.fn() }))
		const event = createDragEvent(["Files"])

		act(() => result.current.dragEvents.onDragEnter(event))

		expect(result.current.isDragOver).toBe(true)
		expect(event.preventDefault).toHaveBeenCalled()
		expect(event.stopPropagation).toHaveBeenCalled()
	})
})
