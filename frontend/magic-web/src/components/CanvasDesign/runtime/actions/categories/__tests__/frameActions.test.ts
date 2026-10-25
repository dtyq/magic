import { describe, expect, it, vi } from "vitest"
import type { Canvas } from "../../../core/Canvas"
import type { UserAction } from "../../types"
import { frameActions } from "../frameActions"

function getCreateFrameAction() {
	const action = frameActions.find((item) => item.id === "frame.create") as
		| UserAction<"frame.create">
		| undefined
	if (!action) {
		throw new Error("Expected frame.create action")
	}
	return action
}

function createCanvas() {
	const createFrame = vi.fn()
	const elements = new Map([
		["first", { id: "first", type: "image" }],
		["second", { id: "second", type: "text" }],
	])
	return {
		canvas: {
			can: vi.fn(() => true),
			selectionManager: {
				getSelectedIds: vi.fn(() => ["first", "second"]),
			},
			permissionManager: {
				can: vi.fn(() => true),
				isAnySelectedElementLocked: vi.fn(() => false),
			},
			elementManager: {
				getElementData: vi.fn((id: string) => elements.get(id)),
				findParentIdForElement: vi.fn(() => undefined),
			},
			frameManager: { createFrame },
		} as unknown as Canvas,
		createFrame,
	}
}

describe("frameActions", () => {
	it("forwards the requested selection bounds expansion", () => {
		const action = getCreateFrameAction()
		const { canvas, createFrame } = createCanvas()

		expect(action.canExecute(canvas, { boundsExpansion: 24 })).toBe(true)
		action.execute(canvas, { boundsExpansion: 24 })

		expect(createFrame).toHaveBeenCalledWith(24)
	})

	it("uses the default frame padding when callers omit options", () => {
		const action = getCreateFrameAction()
		const { canvas, createFrame } = createCanvas()

		action.execute(canvas)

		expect(createFrame).toHaveBeenCalledWith()
	})
})
