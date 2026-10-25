import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RecordingTranscriptPanelDragStore } from "../RecordingTranscriptPanelDragStore"
import {
	RECORDING_DETAIL_SUMMARY_MIN_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_HANDLE_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_MAX_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_MIN_WIDTH,
} from "../../components/recording-detail/recording-detail-layout"

describe("RecordingTranscriptPanelDragStore", () => {
	let store: RecordingTranscriptPanelDragStore
	let gridElement: HTMLDivElement

	beforeEach(() => {
		store = new RecordingTranscriptPanelDragStore()
		gridElement = document.createElement("div")
		document.body.appendChild(gridElement)
	})

	afterEach(() => {
		store.cancelDrag()
		gridElement.remove()
		vi.restoreAllMocks()
	})

	it("initializes with idle state", () => {
		expect(store.isDragging).toBe(false)
		expect(store.collapseProgress).toBe(0)
		expect(store.collapseArmed).toBe(false)
	})

	it("sets body styles and grid attribute when drag starts", () => {
		const gridRef = { current: gridElement }
		store.startDrag({
			clientX: 100,
			startWidth: 400,
			canCollapse: true,
			gridRef,
			onCommit: vi.fn(),
		})

		expect(store.isDragging).toBe(true)
		expect(document.body.style.cursor).toBe("col-resize")
		expect(document.body.style.userSelect).toBe("none")
		expect(gridElement.getAttribute("data-resizing")).toBe("true")
		expect(document.documentElement.getAttribute("data-recording-resizing")).toBe("true")
	})

	it("updates gridTemplateColumns synchronously when width changes within limits", () => {
		const gridRef = { current: gridElement }
		store.startDrag({
			clientX: 100,
			startWidth: 400,
			canCollapse: true,
			gridRef,
			onCommit: vi.fn(),
		})

		// Move +20px -> 420px
		store.updateDrag(120)
		expect(gridElement.style.gridTemplateColumns).toBe(
			`420px ${RECORDING_DETAIL_TRANSCRIPT_HANDLE_WIDTH}px minmax(${RECORDING_DETAIL_SUMMARY_MIN_WIDTH}px, 1fr)`,
		)
		expect(store.collapseProgress).toBe(0)
		expect(store.collapseArmed).toBe(false)

		// Move past the max: 400 + (400 - 100) = 700, clamped to the ceiling.
		store.updateDrag(400)
		expect(gridElement.style.gridTemplateColumns).toBe(
			`${RECORDING_DETAIL_TRANSCRIPT_MAX_WIDTH}px ${RECORDING_DETAIL_TRANSCRIPT_HANDLE_WIDTH}px minmax(${RECORDING_DETAIL_SUMMARY_MIN_WIDTH}px, 1fr)`,
		)
	})

	it("arms collapse intent when over-dragged past threshold", () => {
		const gridRef = { current: gridElement }
		store.startDrag({
			clientX: 100,
			startWidth: 350,
			canCollapse: true,
			gridRef,
			onCommit: vi.fn(),
		})

		// Drag left by 180px: rawWidth = 350 - 180 = 170px, below the 360px floor.
		// Overshoot = 360 - 170 = 190px >= 128px threshold -> armed.
		store.updateDrag(-80)
		expect(store.collapseArmed).toBe(true)
		expect(store.collapseProgress).toBe(1)
		// Grid column stays on the floor while the over-drag arms collapse.
		expect(gridElement.style.gridTemplateColumns).toBe(
			`${RECORDING_DETAIL_TRANSCRIPT_MIN_WIDTH}px ${RECORDING_DETAIL_TRANSCRIPT_HANDLE_WIDTH}px minmax(${RECORDING_DETAIL_SUMMARY_MIN_WIDTH}px, 1fr)`,
		)
	})

	it("commits new width on release when not armed", () => {
		const gridRef = { current: gridElement }
		const onCommit = vi.fn()
		store.startDrag({
			clientX: 100,
			startWidth: 400,
			canCollapse: true,
			gridRef,
			onCommit,
		})

		store.endDrag(80) // 400 + (80 - 100) = 380px
		expect(onCommit).toHaveBeenCalledWith({
			collapsed: false,
			width: 380,
		})
		expect(store.isDragging).toBe(false)
		expect(document.body.style.cursor).toBe("")
		expect(document.body.style.userSelect).toBe("")
		expect(gridElement.getAttribute("data-resizing")).toBeNull()
	})

	it("commits collapsed state and restores start width on release when armed", () => {
		const gridRef = { current: gridElement }
		const onCommit = vi.fn()
		store.startDrag({
			clientX: 100,
			startWidth: 350,
			canCollapse: true,
			gridRef,
			onCommit,
		})

		// Overshoot past 128px threshold
		store.updateDrag(-80)
		expect(store.collapseArmed).toBe(true)

		store.endDrag()
		expect(onCommit).toHaveBeenCalledWith({
			collapsed: true,
			width: 350,
		})
		expect(store.isDragging).toBe(false)
	})

	it("restores original width and cleans up on cancel", () => {
		const gridRef = { current: gridElement }
		const onCommit = vi.fn()
		store.startDrag({
			clientX: 100,
			startWidth: 400,
			canCollapse: true,
			gridRef,
			onCommit,
		})

		store.updateDrag(130)
		expect(gridElement.style.gridTemplateColumns).toContain("430px")

		store.cancelDrag()
		expect(onCommit).not.toHaveBeenCalled()
		expect(gridElement.style.gridTemplateColumns).toContain("400px")
		expect(store.isDragging).toBe(false)
		expect(document.body.style.cursor).toBe("")
		expect(document.body.style.userSelect).toBe("")
		expect(gridElement.getAttribute("data-resizing")).toBeNull()
	})

	it("cancels drag when Escape key is pressed", () => {
		const gridRef = { current: gridElement }
		const onCommit = vi.fn()
		store.startDrag({
			clientX: 100,
			startWidth: 400,
			canCollapse: true,
			gridRef,
			onCommit,
		})

		window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
		expect(store.isDragging).toBe(false)
		expect(onCommit).not.toHaveBeenCalled()
		expect(gridElement.style.gridTemplateColumns).toContain("400px")
	})
})
