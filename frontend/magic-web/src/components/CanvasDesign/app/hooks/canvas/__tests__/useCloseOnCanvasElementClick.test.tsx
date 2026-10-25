import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { CanvasPointerInput } from "../../../../runtime/interaction/input"
import useCloseOnCanvasElementClick from "../useCloseOnCanvasElementClick"

type InputHandler = (input: CanvasPointerInput) => void

const mocks = vi.hoisted(() => ({
	canvas: {
		stage: {} as object,
		inputManager: {
			on: vi.fn(),
		},
	},
	inputHandler: null as InputHandler | null,
	unsubscribe: vi.fn(),
}))

vi.mock("../../../providers/CanvasProvider", () => ({
	useCanvas: () => ({ canvas: mocks.canvas }),
}))

vi.mock("../../../../runtime/interaction/transform/elementNodeUtils", () => ({
	resolveManagedElementIdFromKonvaNode: vi.fn(() => "image-1"),
	pickContentElementIdAtStagePointer: vi.fn(() => undefined),
}))

describe("useCloseOnCanvasElementClick", () => {
	beforeEach(() => {
		mocks.inputHandler = null
		mocks.unsubscribe.mockClear()
		mocks.canvas.inputManager.on.mockImplementation((_event: string, handler: InputHandler) => {
			mocks.inputHandler = handler
			return mocks.unsubscribe
		})
	})

	afterEach(() => {
		cleanup()
		vi.restoreAllMocks()
	})

	it("closes on a plain click of the anchored canvas element", () => {
		const onClose = vi.fn()
		renderHook(() => useCloseOnCanvasElementClick("image-1", onClose))

		act(() => {
			mocks.inputHandler?.({
				button: 0,
				activePointerCount: 1,
				modifiers: {},
				target: mocks.canvas.stage,
				stage: {},
			} as CanvasPointerInput)
		})

		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it("ignores modified clicks and removes the listener on unmount", () => {
		const onClose = vi.fn()
		const { unmount } = renderHook(() => useCloseOnCanvasElementClick("image-1", onClose))

		act(() => {
			mocks.inputHandler?.({
				button: 0,
				activePointerCount: 1,
				modifiers: { shift: true },
				target: mocks.canvas.stage,
				stage: {},
			} as CanvasPointerInput)
		})

		expect(onClose).not.toHaveBeenCalled()
		unmount()
		expect(mocks.unsubscribe).toHaveBeenCalledTimes(1)
	})
})
