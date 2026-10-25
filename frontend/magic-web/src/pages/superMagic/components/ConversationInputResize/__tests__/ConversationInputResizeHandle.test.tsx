import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ConversationInputResizeHandle from "../ConversationInputResizeHandle"

describe("ConversationInputResizeHandle", () => {
	let frameCallbacks: FrameRequestCallback[]

	/** Dispatch a pointer event with stable coordinates across jsdom versions. */
	function dispatchPointerEvent(
		target: EventTarget,
		type: string,
		init: {
			button?: number
			clientY: number
			isPrimary?: boolean
			pointerId: number
			pointerType: string
		},
	) {
		const event = new Event(type, { bubbles: true, cancelable: true })
		Object.defineProperties(event, {
			button: { value: init.button ?? 0 },
			clientY: { value: init.clientY },
			isPrimary: { value: init.isPrimary ?? true },
			pointerId: { value: init.pointerId },
			pointerType: { value: init.pointerType },
		})
		fireEvent(target, event)
	}

	beforeEach(() => {
		frameCallbacks = []
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			frameCallbacks.push(callback)
			return frameCallbacks.length
		})
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	/** Run the next queued frame to simulate the browser's paint cadence. */
	function flushNextFrame() {
		const callback = frameCallbacks.shift()
		if (!callback) return
		act(() => callback(performance.now()))
	}

	it("coalesces rapid pointer movement into one resize update per frame", () => {
		const onResize = vi.fn()
		const onResizeStateChange = vi.fn()
		render(
			<ConversationInputResizeHandle
				value={240}
				min={200}
				max={560}
				onResizeStart={vi.fn()}
				onResize={onResize}
				onResizeEnd={vi.fn()}
				onDoubleClick={vi.fn()}
				onResizeStateChange={onResizeStateChange}
			/>,
		)

		const handle = screen.getByTestId("conversation-input-resize-handle")
		expect(handle.className).toContain("before:bg-gradient-to-r")
		dispatchPointerEvent(handle, "pointerdown", {
			button: 0,
			clientY: 100,
			isPrimary: true,
			pointerId: 7,
			pointerType: "touch",
		})
		dispatchPointerEvent(window, "pointermove", {
			clientY: 92,
			pointerId: 7,
			pointerType: "touch",
		})
		dispatchPointerEvent(window, "pointermove", {
			clientY: 76,
			pointerId: 7,
			pointerType: "touch",
		})

		expect(onResize).not.toHaveBeenCalled()
		flushNextFrame()
		expect(onResize).toHaveBeenCalledTimes(1)
		expect(onResize).toHaveBeenLastCalledWith(-24)

		dispatchPointerEvent(window, "pointerup", {
			clientY: 76,
			pointerId: 7,
			pointerType: "touch",
		})
		expect(onResizeStateChange).toHaveBeenNthCalledWith(1, true)
		expect(onResizeStateChange).toHaveBeenLastCalledWith(false)
	})

	it("flushes the latest pending movement before ending the resize", () => {
		const onResize = vi.fn()
		const onResizeEnd = vi.fn()
		render(
			<ConversationInputResizeHandle
				value={240}
				min={200}
				max={560}
				onResizeStart={vi.fn()}
				onResize={onResize}
				onResizeEnd={onResizeEnd}
				onDoubleClick={vi.fn()}
			/>,
		)

		const handle = screen.getByTestId("conversation-input-resize-handle")
		dispatchPointerEvent(handle, "pointerdown", {
			button: 0,
			clientY: 100,
			isPrimary: true,
			pointerId: 8,
			pointerType: "mouse",
		})
		dispatchPointerEvent(window, "pointermove", {
			clientY: 68,
			pointerId: 8,
			pointerType: "mouse",
		})
		dispatchPointerEvent(window, "pointerup", {
			clientY: 68,
			pointerId: 8,
			pointerType: "mouse",
		})

		expect(onResize).toHaveBeenCalledWith(-32)
		expect(onResizeEnd).toHaveBeenCalledTimes(1)
	})

	it("cleans up a cancelled pointer gesture without committing it", () => {
		const onResize = vi.fn()
		const onResizeEnd = vi.fn()
		const onResizeStateChange = vi.fn()
		render(
			<ConversationInputResizeHandle
				value={240}
				min={200}
				max={560}
				onResizeStart={vi.fn()}
				onResize={onResize}
				onResizeEnd={onResizeEnd}
				onDoubleClick={vi.fn()}
				onResizeStateChange={onResizeStateChange}
			/>,
		)

		const handle = screen.getByTestId("conversation-input-resize-handle")
		dispatchPointerEvent(handle, "pointerdown", {
			clientY: 100,
			isPrimary: true,
			pointerId: 9,
			pointerType: "touch",
		})
		dispatchPointerEvent(window, "pointermove", {
			clientY: 64,
			pointerId: 9,
			pointerType: "touch",
		})
		dispatchPointerEvent(window, "pointercancel", {
			clientY: 64,
			pointerId: 9,
			pointerType: "touch",
		})

		expect(onResize).not.toHaveBeenCalled()
		expect(onResizeEnd).not.toHaveBeenCalled()
		expect(onResizeStateChange).toHaveBeenNthCalledWith(1, true)
		expect(onResizeStateChange).toHaveBeenLastCalledWith(false)
	})
})
