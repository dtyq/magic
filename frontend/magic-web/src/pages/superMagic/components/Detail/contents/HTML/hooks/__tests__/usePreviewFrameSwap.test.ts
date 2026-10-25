import { describe, expect, it } from "vitest"
import {
	createFrameSwapState,
	markFrameReady,
	reconcileFrameSwap,
	type PreviewFrameSwapInput,
	type PreviewFrameSwapState,
} from "../usePreviewFrameSwap"

type Props = { tag: string }
const PROPS: Props = { tag: "latest" }

function input(
	overrides: Partial<PreviewFrameSwapInput<Props>> = {},
): PreviewFrameSwapInput<Props> {
	return {
		token: "file:0",
		content: "a",
		isEditing: false,
		contentIsEditVariant: false,
		latestProps: PROPS,
		...overrides,
	}
}

function readyState(content = "a"): PreviewFrameSwapState<Props> {
	return markFrameReady(createFrameSwapState<Props>("file:0", content), 0)
}

describe("reconcileFrameSwap", () => {
	it("is idempotent when nothing changed", () => {
		const state = readyState()
		expect(reconcileFrameSwap(state, input())).toBe(state)
	})

	it("updates the live frame in place until it has rendered", () => {
		const state = createFrameSwapState<Props>("file:0", "")
		const next = reconcileFrameSwap(state, input({ content: "a" }))
		expect(next.frames).toHaveLength(1)
		expect(next.frames[0].content).toBe("a")
	})

	it("keeps the rendered frame and adds a new live frame on new content", () => {
		const next = reconcileFrameSwap(readyState(), input({ content: "b" }))
		expect(next.frames.map((frame) => frame.content)).toEqual(["a", "b"])
		expect(next.frames[0].frozenProps).toBe(PROPS)
		expect(next.liveId).toBe(1)
		expect(next.readyId).toBeNull()
	})

	it("retires the previous frame once the new live frame is ready", () => {
		const swapped = reconcileFrameSwap(readyState(), input({ content: "b" }))
		const done = markFrameReady(swapped, 1)
		expect(done.frames.map((frame) => frame.id)).toEqual([1])
		expect(done.readyId).toBe(1)
	})

	it("ignores readiness reported by a frozen frame", () => {
		const swapped = reconcileFrameSwap(readyState(), input({ content: "b" }))
		expect(markFrameReady(swapped, 0)).toBe(swapped)
	})

	it("holds the frame while leaving the editor, then swaps on settled content", () => {
		const editing = reconcileFrameSwap(
			readyState("edit"),
			input({ content: "edit", isEditing: true, contentIsEditVariant: true }),
		)
		const limbo = reconcileFrameSwap(
			editing,
			input({ content: "edit", contentIsEditVariant: true }),
		)
		expect(limbo.liveId).toBeNull()
		expect(limbo.frames).toHaveLength(1)
		expect(
			reconcileFrameSwap(limbo, input({ content: "edit", contentIsEditVariant: true })),
		).toBe(limbo)

		const settled = reconcileFrameSwap(limbo, input({ content: "final" }))
		expect(settled.frames.map((frame) => frame.content)).toEqual(["edit", "final"])
		expect(settled.liveId).toBe(1)
	})

	it("reuses the held frame when the editor is re-entered", () => {
		const limbo = reconcileFrameSwap(
			readyState("edit"),
			input({ content: "edit", contentIsEditVariant: true }),
		)
		const editing = reconcileFrameSwap(
			limbo,
			input({ content: "edit", isEditing: true, contentIsEditVariant: true }),
		)
		expect(editing.liveId).toBe(0)
		expect(editing.frames[0].frozenProps).toBeNull()
	})

	it("keeps the document untouched when the editor is entered with unchanged content", () => {
		const state = readyState()
		expect(
			reconcileFrameSwap(state, input({ isEditing: true, contentIsEditVariant: true })),
		).toBe(state)
	})

	it("updates a live frame that has not rendered yet in place while editing", () => {
		const state = createFrameSwapState<Props>("file:0", "a")
		const editing = reconcileFrameSwap(
			state,
			input({ content: "c", isEditing: true, contentIsEditVariant: true }),
		)
		expect(editing.frames).toHaveLength(1)
		expect(editing.frames[0].content).toBe("c")
		expect(editing.liveId).toBe(editing.frames[0].id)
	})

	it("swaps to a fresh frame instead of rewriting a rendered document while editing", () => {
		const editing = reconcileFrameSwap(
			readyState(),
			input({ content: "saved", isEditing: true, contentIsEditVariant: true }),
		)
		expect(editing.frames.map((frame) => frame.content)).toEqual(["a", "saved"])
		expect(editing.frames[0].frozenProps).toBe(PROPS)
		expect(editing.liveId).toBe(1)
		expect(editing.readyId).toBeNull()

		const done = markFrameReady(editing, 1)
		expect(done.frames.map((frame) => frame.id)).toEqual([1])
	})

	it("starts over when the token changes", () => {
		const next = reconcileFrameSwap(readyState(), input({ token: "file:1", content: "z" }))
		expect(next.token).toBe("file:1")
		expect(next.frames.map((frame) => frame.content)).toEqual(["z"])
	})
})
