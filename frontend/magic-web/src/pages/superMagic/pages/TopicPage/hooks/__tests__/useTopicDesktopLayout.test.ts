import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTopicDesktopLayout } from "../useTopicDesktopLayout"
import {
	DEFAULT_WIDTH,
	MESSAGE_PANEL_WIDTH_STORAGE_KEY,
	PROJECT_SIDER_WIDTH_STORAGE_KEY,
} from "../../../../constants/resizablePanel"

class MockResizeObserver {
	observe = vi.fn()
	disconnect = vi.fn()

	constructor(callback: ResizeObserverCallback) {
		void callback
	}
}

describe("useTopicDesktopLayout", () => {
	beforeEach(() => {
		vi.stubGlobal("ResizeObserver", MockResizeObserver)
		localStorage.clear()
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		localStorage.clear()
	})

	it("should return default widths", () => {
		const { result } = renderHook(() => useTopicDesktopLayout({ isReadOnly: false }))

		expect(result.current.projectSiderWidthPx).toBe(DEFAULT_WIDTH.PROJECT_SIDER)
		expect(result.current.messagePanelWidthPx).toBe(DEFAULT_WIDTH.MESSAGE_PANEL)
		expect(result.current.isConversationPanelCollapsed).toBe(false)
	})

	it("should resize project sider and persist width", () => {
		const { result, rerender } = renderHook(() => useTopicDesktopLayout({ isReadOnly: false }))

		act(() => {
			result.current.startDragProjectSider(100)
		})
		rerender()

		act(() => {
			document.dispatchEvent(new MouseEvent("mousemove", { clientX: 150 }))
			document.dispatchEvent(new MouseEvent("mouseup", { clientX: 150 }))
		})
		rerender()

		expect(result.current.projectSiderWidthPx).toBe(DEFAULT_WIDTH.PROJECT_SIDER + 50)
		expect(localStorage.getItem(PROJECT_SIDER_WIDTH_STORAGE_KEY)).toBe(
			String(DEFAULT_WIDTH.PROJECT_SIDER + 50),
		)
	})

	it("should toggle conversation panel collapse state", () => {
		const { result, rerender } = renderHook(() => useTopicDesktopLayout({ isReadOnly: false }))

		act(() => {
			result.current.toggleConversationPanel()
		})
		rerender()
		expect(result.current.isConversationPanelCollapsed).toBe(true)

		act(() => {
			result.current.toggleConversationPanel()
		})
		rerender()
		expect(result.current.isConversationPanelCollapsed).toBe(false)
	})

	it("should expand collapsed panel when detail panel becomes visible", () => {
		const { result, rerender } = renderHook(() => useTopicDesktopLayout({ isReadOnly: false }))

		act(() => {
			result.current.toggleConversationPanel()
		})
		rerender()
		expect(result.current.isConversationPanelCollapsed).toBe(true)

		act(() => {
			result.current.ensureExpandedWhenDetailVisible(true)
		})
		rerender()
		expect(result.current.isConversationPanelCollapsed).toBe(false)
	})

	it("should ignore message panel percentage values from storage", () => {
		localStorage.setItem(MESSAGE_PANEL_WIDTH_STORAGE_KEY, "60")

		const { result } = renderHook(() => useTopicDesktopLayout({ isReadOnly: false }))

		expect(result.current.messagePanelWidthPx).toBe(DEFAULT_WIDTH.MESSAGE_PANEL)
	})
})
