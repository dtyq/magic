import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	RECORDING_DETAIL_TRANSCRIPT_DEFAULT_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_MAX_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_MIN_WIDTH,
} from "../../components/recording-detail/recording-detail-layout"
import {
	RECORDING_DETAIL_TRANSCRIPT_PANEL_COLLAPSED_STORAGE_KEY,
	useRecordingDetailTranscriptPanelState,
} from "../useRecordingDetailTranscriptPanelState"

describe("useRecordingDetailTranscriptPanelState", () => {
	beforeEach(() => {
		localStorage.clear()
	})

	afterEach(() => {
		vi.restoreAllMocks()
		localStorage.clear()
	})

	it("defaults to expanded at the default transcript width", () => {
		const { result } = renderHook(() => useRecordingDetailTranscriptPanelState())

		expect(result.current.isTranscriptPanelCollapsed).toBe(false)
		expect(result.current.transcriptPanelWidth).toBe(RECORDING_DETAIL_TRANSCRIPT_DEFAULT_WIDTH)
	})

	it("restores a persisted collapsed state and width", () => {
		localStorage.setItem(
			RECORDING_DETAIL_TRANSCRIPT_PANEL_COLLAPSED_STORAGE_KEY,
			JSON.stringify({ collapsed: true, width: 380 }),
		)

		const { result } = renderHook(() => useRecordingDetailTranscriptPanelState())

		expect(result.current.isTranscriptPanelCollapsed).toBe(true)
		expect(result.current.transcriptPanelWidth).toBe(380)
	})

	it("reads legacy boolean payloads without losing the default width", () => {
		localStorage.setItem(RECORDING_DETAIL_TRANSCRIPT_PANEL_COLLAPSED_STORAGE_KEY, "true")

		const { result } = renderHook(() => useRecordingDetailTranscriptPanelState())

		expect(result.current.isTranscriptPanelCollapsed).toBe(true)
		expect(result.current.transcriptPanelWidth).toBe(RECORDING_DETAIL_TRANSCRIPT_DEFAULT_WIDTH)
	})

	it("persists collapse and expand as a JSON payload", () => {
		const { result } = renderHook(() => useRecordingDetailTranscriptPanelState())

		act(() => {
			result.current.collapseTranscriptPanel()
		})
		expect(result.current.isTranscriptPanelCollapsed).toBe(true)
		expect(localStorage.getItem(RECORDING_DETAIL_TRANSCRIPT_PANEL_COLLAPSED_STORAGE_KEY)).toBe(
			JSON.stringify({ collapsed: true, width: RECORDING_DETAIL_TRANSCRIPT_DEFAULT_WIDTH }),
		)

		act(() => {
			result.current.expandTranscriptPanel()
		})
		expect(result.current.isTranscriptPanelCollapsed).toBe(false)
		expect(localStorage.getItem(RECORDING_DETAIL_TRANSCRIPT_PANEL_COLLAPSED_STORAGE_KEY)).toBe(
			JSON.stringify({ collapsed: false, width: RECORDING_DETAIL_TRANSCRIPT_DEFAULT_WIDTH }),
		)
	})

	it("persists a newly dragged width", () => {
		const { result } = renderHook(() => useRecordingDetailTranscriptPanelState())

		act(() => {
			result.current.setTranscriptPanelWidth(360)
		})
		expect(result.current.transcriptPanelWidth).toBe(360)
		expect(localStorage.getItem(RECORDING_DETAIL_TRANSCRIPT_PANEL_COLLAPSED_STORAGE_KEY)).toBe(
			JSON.stringify({ collapsed: false, width: 360 }),
		)
	})

	it("clamps an out-of-range width into the readable band", () => {
		const { result } = renderHook(() => useRecordingDetailTranscriptPanelState())

		act(() => {
			result.current.setTranscriptPanelWidth(9999)
		})
		expect(result.current.transcriptPanelWidth).toBe(RECORDING_DETAIL_TRANSCRIPT_MAX_WIDTH)

		act(() => {
			result.current.setTranscriptPanelWidth(1)
		})
		expect(result.current.transcriptPanelWidth).toBe(RECORDING_DETAIL_TRANSCRIPT_MIN_WIDTH)
	})

	it("keeps the UI usable when the stored value is invalid or storage fails", () => {
		localStorage.setItem(RECORDING_DETAIL_TRANSCRIPT_PANEL_COLLAPSED_STORAGE_KEY, "invalid")
		const invalidStored = renderHook(() => useRecordingDetailTranscriptPanelState())
		expect(invalidStored.result.current.isTranscriptPanelCollapsed).toBe(false)
		expect(invalidStored.result.current.transcriptPanelWidth).toBe(
			RECORDING_DETAIL_TRANSCRIPT_DEFAULT_WIDTH,
		)
		invalidStored.unmount()

		const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("storage unavailable")
		})
		const { result } = renderHook(() => useRecordingDetailTranscriptPanelState())
		expect(result.current.isTranscriptPanelCollapsed).toBe(false)
		getItemSpy.mockRestore()

		const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("storage unavailable")
		})
		act(() => {
			result.current.collapseTranscriptPanel()
		})
		expect(result.current.isTranscriptPanelCollapsed).toBe(true)
		setItemSpy.mockRestore()
	})
})
