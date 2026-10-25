import { act, fireEvent, renderHook, waitFor } from "@testing-library/react"
import type { RefObject } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const storeMocks = vi.hoisted(() => ({
	getChatInputHeightPreference: vi.fn(),
	setChatInputHeightPreference: vi.fn(),
}))

vi.mock("@/stores/interface", () => ({
	interfaceStore: {
		getChatInputHeightPreference: storeMocks.getChatInputHeightPreference,
		setChatInputHeightPreference: storeMocks.setChatInputHeightPreference,
	},
}))

import { useConversationInputHeight } from "../useConversationInputHeight"

class MockResizeObserver {
	/** Match the browser observer API without producing unrelated resize notifications. */
	observe() {
		return undefined
	}

	/** Release mock observer resources. */
	disconnect() {
		return undefined
	}
}

/** Build the minimal DOMRect fields used by layout measurements. */
function createRect(height: number): DOMRect {
	return {
		x: 0,
		y: 0,
		width: 800,
		height,
		top: 0,
		right: 800,
		bottom: height,
		left: 0,
		toJSON: () => ({}),
	}
}

describe("useConversationInputHeight", () => {
	let containerHeight: number
	let availableHeight: number
	let container: HTMLDivElement
	let available: HTMLDivElement

	beforeEach(() => {
		containerHeight = 240
		availableHeight = 800
		container = document.createElement("div")
		available = document.createElement("div")
		Object.defineProperty(container, "offsetHeight", {
			configurable: true,
			get: () => containerHeight,
		})
		Object.defineProperty(container, "scrollHeight", {
			configurable: true,
			get: () => containerHeight,
		})
		available.getBoundingClientRect = () => createRect(availableHeight)
		container.getBoundingClientRect = () => createRect(containerHeight)
		storeMocks.getChatInputHeightPreference.mockReset()
		storeMocks.getChatInputHeightPreference.mockReturnValue({ mode: "auto", height: 240 })
		storeMocks.setChatInputHeightPreference.mockReset()
		vi.stubGlobal("ResizeObserver", MockResizeObserver)
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			return window.setTimeout(() => callback(performance.now()), 0)
		})
		vi.stubGlobal("cancelAnimationFrame", (handle: number) => window.clearTimeout(handle))
	})

	it("automatically grows, clamps at fifty percent, and shrinks again", async () => {
		const { result } = renderHook(() =>
			useConversationInputHeight({
				scope: "test-conversation",
				enabled: true,
				containerRef: { current: container } as RefObject<HTMLDivElement>,
				availableRef: { current: available } as RefObject<HTMLDivElement>,
			}),
		)

		await waitFor(() => expect(result.current.maxHeight).toBe(400))
		expect(result.current.effectiveHeight).toBe(240)
		expect(result.current.fillHeight).toBe(true)

		containerHeight = 500
		fireEvent.input(container)
		await waitFor(() => expect(result.current.effectiveHeight).toBe(400))
		expect(result.current.fillHeight).toBe(true)

		containerHeight = 260
		fireEvent.input(container)
		await waitFor(() => expect(result.current.maxHeight).toBe(400))
		await waitFor(() => expect(result.current.effectiveHeight).toBe(260))
		expect(result.current.fillHeight).toBe(true)
	})

	it("fills the panel when automatic height is expanded by the minimum bound", async () => {
		storeMocks.getChatInputHeightPreference.mockReturnValue({ mode: "auto", height: 240 })
		containerHeight = 150

		const { result } = renderHook(() =>
			useConversationInputHeight({
				scope: "synthetic-conversation",
				enabled: true,
				containerRef: { current: container } as RefObject<HTMLDivElement>,
				availableRef: { current: available } as RefObject<HTMLDivElement>,
				minHeight: 260,
			}),
		)

		await waitFor(() => expect(result.current.maxHeight).toBe(400))
		await waitFor(() => expect(result.current.effectiveHeight).toBe(260))
		expect(result.current.fillHeight).toBe(true)
	})

	it("follows a lower minimum bound without waiting for a content change", async () => {
		containerHeight = 150
		const { result, rerender } = renderHook(
			({ minHeight }) =>
				useConversationInputHeight({
					scope: "lowered-floor-conversation",
					enabled: true,
					containerRef: { current: container } as RefObject<HTMLDivElement>,
					availableRef: { current: available } as RefObject<HTMLDivElement>,
					minHeight,
				}),
			{ initialProps: { minHeight: 182 } },
		)

		await waitFor(() => expect(result.current.maxHeight).toBe(400))
		// A content measurement under the old floor clamps the automatic height up to it.
		fireEvent.input(container)
		await waitFor(() => expect(result.current.effectiveHeight).toBe(182))

		rerender({ minHeight: 177.2 })

		await waitFor(() => expect(result.current.effectiveHeight).toBe(177.2))
	})

	it("lets manual Splitter resizing override automatic measurements until restored", async () => {
		const { result } = renderHook(() =>
			useConversationInputHeight({
				scope: "test-conversation",
				enabled: true,
				containerRef: { current: container } as RefObject<HTMLDivElement>,
				availableRef: { current: available } as RefObject<HTMLDivElement>,
			}),
		)

		await waitFor(() => expect(result.current.maxHeight).toBe(400))
		act(() => {
			result.current.onSplitterResizeStart([560, 240])
			result.current.onSplitterResize([480, 320])
			result.current.onSplitterResizeEnd([480, 320])
		})

		expect(result.current.effectiveHeight).toBe(320)
		expect(result.current.fillHeight).toBe(true)
		expect(storeMocks.setChatInputHeightPreference).toHaveBeenLastCalledWith(
			"test-conversation",
			{ mode: "manual", height: 320 },
		)

		containerHeight = 360
		fireEvent.input(container)
		await waitFor(() => expect(result.current.effectiveHeight).toBe(320))
		expect(result.current.effectiveHeight).toBe(320)

		act(() => result.current.restoreAutoHeight())
		await waitFor(() => expect(result.current.effectiveHeight).toBe(360))
		expect(storeMocks.setChatInputHeightPreference).toHaveBeenLastCalledWith(
			"test-conversation",
			{ mode: "auto", height: 240 },
		)
	})

	it("uses upward pointer movement to increase and persist manual height", async () => {
		const { result } = renderHook(() =>
			useConversationInputHeight({
				scope: "test-conversation",
				enabled: true,
				containerRef: { current: container } as RefObject<HTMLDivElement>,
				availableRef: { current: available } as RefObject<HTMLDivElement>,
			}),
		)

		await waitFor(() => expect(result.current.maxHeight).toBe(400))
		act(() => {
			result.current.startPointerResize()
			result.current.resizeByPointerDelta(-80)
			result.current.finishPointerResize()
		})

		expect(result.current.effectiveHeight).toBe(320)
		expect(storeMocks.setChatInputHeightPreference).toHaveBeenLastCalledWith(
			"test-conversation",
			{ mode: "manual", height: 320 },
		)
	})

	it("discards the manual height and returns to the initial auto state on double-click", async () => {
		storeMocks.getChatInputHeightPreference.mockReturnValue({ mode: "auto", height: 240 })
		const { result } = renderHook(() =>
			useConversationInputHeight({
				scope: "reset-height-conversation",
				enabled: true,
				containerRef: { current: container } as RefObject<HTMLDivElement>,
				availableRef: { current: available } as RefObject<HTMLDivElement>,
				manualMaxRatio: 0.7,
			}),
		)

		await waitFor(() => expect(result.current.effectiveHeight).toBe(240))
		act(() => {
			result.current.startPointerResize()
			result.current.resizeByPointerDelta(-260)
		})
		await waitFor(() => expect(result.current.effectiveHeight).toBe(500))
		act(() => result.current.restoreAutoHeight())

		await waitFor(() => expect(result.current.effectiveHeight).toBe(240))
		expect(storeMocks.setChatInputHeightPreference).toHaveBeenLastCalledWith(
			"reset-height-conversation",
			{ mode: "auto", height: 240 },
		)
	})

	it("freezes an expanded height when the employee or mode layout changes", async () => {
		const { result, rerender } = renderHook(
			({ layoutKey }: { layoutKey: string }) =>
				useConversationInputHeight({
					scope: "test-conversation",
					layoutKey,
					enabled: true,
					containerRef: { current: container } as RefObject<HTMLDivElement>,
					availableRef: { current: available } as RefObject<HTMLDivElement>,
				}),
			{ initialProps: { layoutKey: "general:employee-a" } },
		)

		await waitFor(() => expect(result.current.effectiveHeight).toBe(240))
		containerHeight = 500
		fireEvent.input(container)
		await waitFor(() => expect(result.current.effectiveHeight).toBe(400))

		rerender({ layoutKey: "general:employee-b" })
		await waitFor(() => expect(result.current.effectiveHeight).toBe(400))
		expect(storeMocks.setChatInputHeightPreference).toHaveBeenLastCalledWith(
			"test-conversation",
			{ mode: "manual", height: 400 },
		)

		containerHeight = 200
		fireEvent.input(container)
		await waitFor(() => expect(result.current.effectiveHeight).toBe(400))
	})

	it("does not freeze a layout change that happened while the panel was collapsed", async () => {
		const { result, rerender } = renderHook(
			({ enabled, layoutKey }: { enabled: boolean; layoutKey: string }) =>
				useConversationInputHeight({
					scope: "collapsed-conversation",
					layoutKey,
					enabled,
					containerRef: { current: container } as RefObject<HTMLDivElement>,
					availableRef: { current: available } as RefObject<HTMLDivElement>,
				}),
			{ initialProps: { enabled: false, layoutKey: "summary:initial" } },
		)

		rerender({ enabled: false, layoutKey: "summary:loaded" })
		rerender({ enabled: true, layoutKey: "summary:loaded" })
		await waitFor(() => expect(result.current.maxHeight).toBe(400))

		expect(storeMocks.setChatInputHeightPreference).not.toHaveBeenCalled()
	})

	it("preserves automatic height when the panel is collapsed and reopened", async () => {
		const { result, rerender } = renderHook(
			({ enabled }: { enabled: boolean }) =>
				useConversationInputHeight({
					scope: "collapsed-auto-height",
					enabled,
					containerRef: { current: container } as RefObject<HTMLDivElement>,
					availableRef: { current: available } as RefObject<HTMLDivElement>,
				}),
			{ initialProps: { enabled: true } },
		)

		await waitFor(() => expect(result.current.maxHeight).toBe(400))
		containerHeight = 500
		fireEvent.input(container)
		await waitFor(() => expect(result.current.effectiveHeight).toBe(400))

		rerender({ enabled: false })
		rerender({ enabled: true })
		await waitFor(() => expect(result.current.effectiveHeight).toBe(400))
	})

	it("keeps automatic growth at fifty percent while allowing a larger manual ceiling", async () => {
		const { result } = renderHook(() =>
			useConversationInputHeight({
				scope: "test-conversation",
				enabled: true,
				containerRef: { current: container } as RefObject<HTMLDivElement>,
				availableRef: { current: available } as RefObject<HTMLDivElement>,
				maxRatio: 0.5,
				manualMaxRatio: 0.7,
				manualMinAvailableHeight: 240,
			}),
		)

		await waitFor(() => expect(result.current.maxHeight).toBe(560))
		containerHeight = 500
		fireEvent.input(container)
		await waitFor(() => expect(result.current.effectiveHeight).toBe(400))

		act(() => {
			result.current.startPointerResize()
			result.current.resizeByPointerDelta(-500)
		})

		expect(result.current.effectiveHeight).toBe(560)

		availableHeight = 500
		fireEvent.input(container)
		await waitFor(() => expect(result.current.maxHeight).toBe(260))
		expect(result.current.effectiveHeight).toBe(260)
	})

	it("adds task queue chrome to a manual preference without persisting the temporary offset", async () => {
		storeMocks.getChatInputHeightPreference.mockReturnValue({ mode: "manual", height: 200 })
		const { result } = renderHook(() =>
			useConversationInputHeight({
				scope: "test-conversation",
				enabled: true,
				containerRef: { current: container } as RefObject<HTMLDivElement>,
				availableRef: { current: available } as RefObject<HTMLDivElement>,
			}),
		)

		await waitFor(() => expect(result.current.effectiveHeight).toBe(200))

		const accessory = document.createElement("div")
		accessory.dataset.conversationInputAccessory = "true"
		accessory.getBoundingClientRect = () => createRect(72)
		container.appendChild(accessory)

		await waitFor(() => expect(result.current.effectiveHeight).toBe(272))
		expect(result.current.minHeight).toBe(272)

		accessory.remove()
		await waitFor(() => expect(result.current.effectiveHeight).toBe(200))

		expect(storeMocks.setChatInputHeightPreference).not.toHaveBeenCalled()
	})
})
