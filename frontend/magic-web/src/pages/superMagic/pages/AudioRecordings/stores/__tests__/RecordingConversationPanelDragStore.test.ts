import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RECORDING_CHAT_HISTORY_WIDTH } from "../../components/recording-detail/recording-detail-layout"
import { RecordingConversationPanelDragStore } from "../RecordingConversationPanelDragStore"

describe("RecordingConversationPanelDragStore", () => {
	let store: RecordingConversationPanelDragStore
	let panelElement: HTMLDivElement

	beforeEach(() => {
		store = new RecordingConversationPanelDragStore()
		panelElement = document.createElement("div")
		document.body.appendChild(panelElement)
	})

	afterEach(() => {
		store.cancelDrag()
		panelElement.remove()
		vi.restoreAllMocks()
	})

	/** Starts a drag against the shared panel element with the given conversation width. */
	function startDrag(startWidth: number, onCommit = vi.fn(), historyOffset = 0) {
		store.startDrag({
			clientX: 100,
			startWidth,
			historyOffset,
			panelRef: { current: panelElement },
			onCommit,
		})
		return onCommit
	}

	it("initializes with idle state", () => {
		expect(store.isDragging).toBe(false)
		expect(store.collapseProgress).toBe(0)
		expect(store.collapseArmed).toBe(false)
	})

	it("sets body styles and drops the rail transition when drag starts", () => {
		panelElement.style.transition = "width 300ms"
		startDrag(380)

		expect(store.isDragging).toBe(true)
		expect(document.body.style.cursor).toBe("col-resize")
		expect(document.body.style.userSelect).toBe("none")
		expect(panelElement.getAttribute("data-resizing")).toBe("true")
		expect(panelElement.style.transition).toBe("none")
		expect(document.documentElement.getAttribute("data-recording-resizing")).toBe("true")
	})

	it("widens when dragged left and narrows when dragged right, clamping to 320–560", () => {
		startDrag(400)

		// Pointer moves left by 20px, so the surface grows.
		store.updateDrag(80)
		expect(panelElement.style.width).toBe("420px")
		expect(panelElement.style.minWidth).toBe("420px")
		expect(store.collapseProgress).toBe(0)
		expect(store.collapseArmed).toBe(false)

		// Pointer moves right past the minimum without leaving the quiet zone.
		store.updateDrag(200)
		expect(panelElement.style.width).toBe("320px")
		expect(store.collapseArmed).toBe(false)

		// Pointer moves left past the maximum.
		store.updateDrag(-200)
		expect(panelElement.style.width).toBe("560px")
		expect(store.collapseArmed).toBe(false)
	})

	it("adds the captured history offset without resizing the history column", () => {
		startDrag(400, vi.fn(), RECORDING_CHAT_HISTORY_WIDTH)

		store.updateDrag(80)
		expect(panelElement.style.width).toBe(`${420 + RECORDING_CHAT_HISTORY_WIDTH}px`)
		expect(panelElement.style.minWidth).toBe(`${420 + RECORDING_CHAT_HISTORY_WIDTH}px`)
	})

	it("arms collapse intent only after the pointer passes the quiet zone and threshold", () => {
		startDrag(400)

		// rawWidth = 400 - 100 = 300. Overshoot is 20px, still inside the 32px quiet zone.
		store.updateDrag(200)
		expect(store.collapseProgress).toBe(0)
		expect(store.collapseArmed).toBe(false)

		// rawWidth = 400 - 120 = 280. Overshoot is 40px, so feedback starts but collapse is not armed.
		store.updateDrag(220)
		expect(store.collapseProgress).toBeGreaterThan(0)
		expect(store.collapseProgress).toBeLessThan(1)
		expect(store.collapseArmed).toBe(false)
		expect(panelElement.style.width).toBe("320px")

		// rawWidth = 400 - 208 = 192. Overshoot is 128px, which arms collapse.
		store.updateDrag(308)
		expect(store.collapseArmed).toBe(true)
		expect(store.collapseProgress).toBe(1)
	})

	it("commits the clamped width on release when collapse is not armed", () => {
		const onCommit = startDrag(400)

		store.endDrag(150)
		expect(onCommit).toHaveBeenCalledWith({
			collapsed: false,
			width: 350,
		})
		expect(store.isDragging).toBe(false)
		expect(document.body.style.cursor).toBe("")
		expect(document.body.style.userSelect).toBe("")
		expect(panelElement.getAttribute("data-resizing")).toBeNull()
		expect(panelElement.style.transition).toBe("")
	})

	it("snaps back to the minimum width when the overshoot never arms collapse", () => {
		const onCommit = startDrag(400)

		store.endDrag(220)
		expect(onCommit).toHaveBeenCalledWith({
			collapsed: false,
			width: 320,
		})
	})

	it("commits collapsed state and restores the start width on release when armed", () => {
		const onCommit = startDrag(400)

		store.updateDrag(308)
		expect(store.collapseArmed).toBe(true)

		store.endDrag()
		expect(onCommit).toHaveBeenCalledWith({
			collapsed: true,
			width: 400,
		})
		expect(store.isDragging).toBe(false)
	})

	it("restores the original rail width and skips persistence on cancel", () => {
		const onCommit = startDrag(400, vi.fn(), RECORDING_CHAT_HISTORY_WIDTH)

		store.updateDrag(80)
		expect(panelElement.style.width).toBe(`${420 + RECORDING_CHAT_HISTORY_WIDTH}px`)

		store.cancelDrag()
		expect(onCommit).not.toHaveBeenCalled()
		expect(panelElement.style.width).toBe(`${400 + RECORDING_CHAT_HISTORY_WIDTH}px`)
		expect(panelElement.style.minWidth).toBe(`${400 + RECORDING_CHAT_HISTORY_WIDTH}px`)
		expect(store.isDragging).toBe(false)
		expect(document.body.style.cursor).toBe("")
		expect(panelElement.getAttribute("data-resizing")).toBeNull()
	})

	it("cancels the drag when Escape is pressed or the pointer gesture is cancelled", () => {
		const onCommit = startDrag(400)

		store.updateDrag(80)
		window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
		expect(store.isDragging).toBe(false)
		expect(onCommit).not.toHaveBeenCalled()
		expect(panelElement.style.width).toBe("400px")

		startDrag(380, onCommit)
		store.updateDrag(60)
		document.dispatchEvent(new Event("pointercancel"))
		expect(store.isDragging).toBe(false)
		expect(onCommit).not.toHaveBeenCalled()
		expect(panelElement.style.width).toBe("380px")
	})
})
