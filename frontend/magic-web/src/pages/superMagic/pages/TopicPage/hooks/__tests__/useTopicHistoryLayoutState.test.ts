import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
	TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS,
	useTopicHistoryLayoutState,
} from "../useTopicHistoryLayoutState"

const keyA = `${TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS.topicPage}.test-a`
const keyB = `${TOPIC_HISTORY_PANEL_OPEN_STORAGE_KEYS.topicPage}.test-b`

describe("useTopicHistoryLayoutState", () => {
	beforeEach(() => {
		localStorage.clear()
	})

	afterEach(() => {
		localStorage.removeItem(keyA)
		localStorage.removeItem(keyB)
	})

	it("defaults to closed when storage is empty", () => {
		const { result } = renderHook(() =>
			useTopicHistoryLayoutState({ storageKey: keyA, isEnabled: true }),
		)
		expect(result.current.isTopicHistoryPanelOpen).toBe(false)
	})

	it("restores open state from localStorage on mount", () => {
		localStorage.setItem(keyA, "true")
		const { result } = renderHook(() =>
			useTopicHistoryLayoutState({ storageKey: keyA, isEnabled: true }),
		)
		expect(result.current.isTopicHistoryPanelOpen).toBe(true)
	})

	it("persists open and close to localStorage", () => {
		const { result } = renderHook(() =>
			useTopicHistoryLayoutState({ storageKey: keyA, isEnabled: true }),
		)

		act(() => {
			result.current.openTopicHistoryPanel()
		})
		expect(result.current.isTopicHistoryPanelOpen).toBe(true)
		expect(localStorage.getItem(keyA)).toBe("true")

		act(() => {
			result.current.closeTopicHistoryPanel()
		})
		expect(result.current.isTopicHistoryPanelOpen).toBe(false)
		expect(localStorage.getItem(keyA)).toBe("false")
	})

	it("toggle writes storage", () => {
		const { result } = renderHook(() =>
			useTopicHistoryLayoutState({ storageKey: keyA, isEnabled: true }),
		)

		act(() => {
			result.current.toggleTopicHistoryPanel()
		})
		expect(result.current.isTopicHistoryPanelOpen).toBe(true)
		expect(localStorage.getItem(keyA)).toBe("true")
	})

	it("isolates state by storage key", () => {
		localStorage.setItem(keyA, "true")
		localStorage.setItem(keyB, "false")

		const { result: a } = renderHook(() =>
			useTopicHistoryLayoutState({ storageKey: keyA, isEnabled: true }),
		)
		const { result: b } = renderHook(() =>
			useTopicHistoryLayoutState({ storageKey: keyB, isEnabled: true }),
		)

		expect(a.current.isTopicHistoryPanelOpen).toBe(true)
		expect(b.current.isTopicHistoryPanelOpen).toBe(false)
	})

	it("when disabled, forces UI closed without clearing stored preference", () => {
		localStorage.setItem(keyA, "true")

		const { result, rerender } = renderHook(
			({ enabled }: { enabled: boolean }) =>
				useTopicHistoryLayoutState({ storageKey: keyA, isEnabled: enabled }),
			{ initialProps: { enabled: true } },
		)

		expect(result.current.isTopicHistoryPanelOpen).toBe(true)

		rerender({ enabled: false })
		expect(result.current.isTopicHistoryPanelOpen).toBe(false)
		expect(localStorage.getItem(keyA)).toBe("true")

		act(() => {
			result.current.openTopicHistoryPanel()
		})
		expect(result.current.isTopicHistoryPanelOpen).toBe(false)

		rerender({ enabled: true })
		expect(result.current.isTopicHistoryPanelOpen).toBe(true)
	})

	it("does not write storage when closing while disabled", () => {
		localStorage.setItem(keyA, "true")

		const { result, rerender } = renderHook(
			({ enabled }: { enabled: boolean }) =>
				useTopicHistoryLayoutState({ storageKey: keyA, isEnabled: enabled }),
			{ initialProps: { enabled: false } },
		)

		expect(result.current.isTopicHistoryPanelOpen).toBe(false)
		expect(localStorage.getItem(keyA)).toBe("true")

		act(() => {
			result.current.closeTopicHistoryPanel()
		})
		expect(localStorage.getItem(keyA)).toBe("true")

		rerender({ enabled: true })
		expect(result.current.isTopicHistoryPanelOpen).toBe(true)
	})
})
