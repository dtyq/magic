import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	RECORDING_CHAT_EXPANDED_WIDTH,
	RECORDING_CHAT_MAX_WIDTH,
	RECORDING_CHAT_MIN_WIDTH,
} from "../../components/recording-detail/recording-detail-layout"
import {
	RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY,
	useRecordingDetailConversationPanelState,
} from "../useRecordingDetailConversationPanelState"

/** Serializes the preference the hook writes, so assertions stay aligned with the payload shape. */
function storedPreference(collapsed: boolean, width: number) {
	return JSON.stringify({ collapsed, width })
}

describe("useRecordingDetailConversationPanelState", () => {
	beforeEach(() => {
		localStorage.clear()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		localStorage.clear()
	})

	it("defaults to collapsed at the default conversation width", () => {
		const { result } = renderHook(() => useRecordingDetailConversationPanelState())

		expect(result.current.isConversationPanelCollapsed).toBe(true)
		expect(result.current.conversationPanelWidth).toBe(RECORDING_CHAT_EXPANDED_WIDTH)
	})

	it("restores a persisted collapsed state and width", () => {
		localStorage.setItem(
			RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY,
			storedPreference(false, 420),
		)

		const { result } = renderHook(() => useRecordingDetailConversationPanelState())

		expect(result.current.isConversationPanelCollapsed).toBe(false)
		expect(result.current.conversationPanelWidth).toBe(420)
	})

	it("reads legacy boolean payloads without losing the default width", () => {
		localStorage.setItem(RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY, "false")

		const expanded = renderHook(() => useRecordingDetailConversationPanelState())
		expect(expanded.result.current.isConversationPanelCollapsed).toBe(false)
		expect(expanded.result.current.conversationPanelWidth).toBe(RECORDING_CHAT_EXPANDED_WIDTH)
		expanded.unmount()

		localStorage.setItem(RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY, "true")
		const collapsed = renderHook(() => useRecordingDetailConversationPanelState())
		expect(collapsed.result.current.isConversationPanelCollapsed).toBe(true)
		expect(collapsed.result.current.conversationPanelWidth).toBe(RECORDING_CHAT_EXPANDED_WIDTH)
	})

	it("persists toggle and expand as a JSON payload that keeps the current width", () => {
		const { result } = renderHook(() => useRecordingDetailConversationPanelState())

		act(() => {
			result.current.setConversationPanelWidth(460)
		})
		act(() => {
			result.current.toggleConversationPanel()
		})
		expect(result.current.isConversationPanelCollapsed).toBe(false)
		expect(
			localStorage.getItem(RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY),
		).toBe(storedPreference(false, 460))

		act(() => {
			result.current.toggleConversationPanel()
		})
		expect(result.current.isConversationPanelCollapsed).toBe(true)
		expect(result.current.conversationPanelWidth).toBe(460)
		expect(
			localStorage.getItem(RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY),
		).toBe(storedPreference(true, 460))

		act(() => {
			result.current.expandConversationPanel()
		})
		expect(result.current.isConversationPanelCollapsed).toBe(false)
		expect(result.current.conversationPanelWidth).toBe(460)
	})

	it("clamps an out-of-range width into the conversation band", () => {
		const { result } = renderHook(() => useRecordingDetailConversationPanelState())

		act(() => {
			result.current.setConversationPanelWidth(9999)
		})
		expect(result.current.conversationPanelWidth).toBe(RECORDING_CHAT_MAX_WIDTH)

		act(() => {
			result.current.setConversationPanelWidth(1)
		})
		expect(result.current.conversationPanelWidth).toBe(RECORDING_CHAT_MIN_WIDTH)
		expect(
			localStorage.getItem(RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY),
		).toBe(storedPreference(true, RECORDING_CHAT_MIN_WIDTH))
	})

	it("keeps the UI usable when the stored value is invalid or storage fails", () => {
		localStorage.setItem(RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY, "invalid")
		const invalidStored = renderHook(() => useRecordingDetailConversationPanelState())
		expect(invalidStored.result.current.isConversationPanelCollapsed).toBe(true)
		expect(invalidStored.result.current.conversationPanelWidth).toBe(
			RECORDING_CHAT_EXPANDED_WIDTH,
		)
		invalidStored.unmount()

		localStorage.setItem(
			RECORDING_DETAIL_CONVERSATION_PANEL_COLLAPSED_STORAGE_KEY,
			JSON.stringify({ collapsed: false, width: "wide" }),
		)
		const invalidWidth = renderHook(() => useRecordingDetailConversationPanelState())
		expect(invalidWidth.result.current.isConversationPanelCollapsed).toBe(false)
		expect(invalidWidth.result.current.conversationPanelWidth).toBe(
			RECORDING_CHAT_EXPANDED_WIDTH,
		)
		invalidWidth.unmount()

		const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("storage unavailable")
		})
		const { result } = renderHook(() => useRecordingDetailConversationPanelState())
		expect(result.current.isConversationPanelCollapsed).toBe(true)
		expect(result.current.conversationPanelWidth).toBe(RECORDING_CHAT_EXPANDED_WIDTH)
		getItemSpy.mockRestore()

		const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("storage unavailable")
		})
		act(() => {
			result.current.expandConversationPanel()
		})
		expect(result.current.isConversationPanelCollapsed).toBe(false)
		setItemSpy.mockRestore()
	})
})
