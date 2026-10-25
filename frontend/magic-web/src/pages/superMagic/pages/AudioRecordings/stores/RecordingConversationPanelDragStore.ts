import { makeAutoObservable } from "mobx"
import type { RefObject } from "react"
import { getResizeCollapseIntent } from "@/utils/resizableCollapse"
import {
	RECORDING_CHAT_MAX_WIDTH,
	RECORDING_CHAT_MIN_WIDTH,
} from "../components/recording-detail/recording-detail-layout"

/** Result a finished drag hands back so the page can persist collapse vs. the new conversation width. */
export interface ConversationPanelDragCommit {
	collapsed: boolean
	width: number
}

interface StartDragOptions {
	clientX: number
	/** Conversation-surface width at drag start. History width is not included. */
	startWidth: number
	/** Extra pixels the open topic history adds to the rail. Captured once so mid-drag toggles are ignored. */
	historyOffset: number
	/** The conversation rail whose width and minWidth are previewed imperatively during the drag. */
	panelRef: RefObject<HTMLDivElement | null>
	/** Called once on a normal release with the resolved collapse vs. width outcome. */
	onCommit: (result: ConversationPanelDragCommit) => void
}

/** Clamps a raw drag width into the conversation band. Collapse intent uses the unclamped value. */
function clampConversationWidth(width: number): number {
	return Math.max(RECORDING_CHAT_MIN_WIDTH, Math.min(RECORDING_CHAT_MAX_WIDTH, width))
}

/** Writes the rail box. History stays a fixed offset so only the conversation surface changes. */
function applyPanelWidth(panel: HTMLElement, conversationWidth: number, historyOffset: number) {
	const totalWidth = conversationWidth + historyOffset
	panel.style.width = `${totalWidth}px`
	panel.style.minWidth = `${totalWidth}px`
}

/**
 * MobX store that owns the conversation-rail drag lifecycle. High-frequency drag visuals stay
 * observable so only the resize handle re-renders; the preview width is written straight to the rail DOM.
 *
 * The conversation surface sits to the right of the handle, so moving the pointer right narrows it.
 */
export class RecordingConversationPanelDragStore {
	isDragging = false
	collapseProgress = 0
	collapseArmed = false

	private startX = 0
	private startWidth = 0
	private currentWidth = 0
	private historyOffset = 0
	private panelRef: RefObject<HTMLDivElement | null> | null = null
	private onCommit: ((result: ConversationPanelDragCommit) => void) | null = null
	private cleanup: (() => void) | null = null
	private prevBodyCursor = ""
	private prevBodyUserSelect = ""
	private prevPanelTransition = ""

	constructor() {
		// Private drag bookkeeping is excluded from observation; only the three drag visuals are tracked.
		makeAutoObservable(
			this,
			{
				startX: false,
				startWidth: false,
				currentWidth: false,
				historyOffset: false,
				panelRef: false,
				onCommit: false,
				cleanup: false,
				prevBodyCursor: false,
				prevBodyUserSelect: false,
				prevPanelTransition: false,
			},
			{ autoBind: true },
		)
	}

	/** Begins a drag and installs document-level pointer listeners sharing one mouse/trackpad/touch path. */
	startDrag({ clientX, startWidth, historyOffset, panelRef, onCommit }: StartDragOptions) {
		this.cleanup?.()
		this.startX = clientX
		this.startWidth = startWidth
		this.currentWidth = startWidth
		this.historyOffset = historyOffset
		this.panelRef = panelRef
		this.onCommit = onCommit
		this.isDragging = true
		this.collapseProgress = 0
		this.collapseArmed = false

		if (typeof document !== "undefined") {
			this.prevBodyCursor = document.body.style.cursor
			this.prevBodyUserSelect = document.body.style.userSelect
			document.body.style.cursor = "col-resize"
			document.body.style.userSelect = "none"
			document.documentElement.setAttribute("data-recording-resizing", "true")
		}
		const panel = this.panelRef?.current ?? null
		if (panel) {
			panel.setAttribute("data-resizing", "true")
			// Drop the 300ms width transition so the preview tracks the pointer instead of lagging behind it.
			this.prevPanelTransition = panel.style.transition
			panel.style.transition = "none"
		}

		/** Routes pointer movement into the shared width/intent updater synchronously without frame lag. */
		const handlePointerMove = (event: PointerEvent) => {
			this.updateDrag(event.clientX)
		}
		/** Finalizes the drag on a normal pointer release. */
		const handlePointerUp = (event: PointerEvent) => {
			this.endDrag(event.clientX)
		}
		/** Cancels the drag when the browser aborts a touch gesture. */
		const handlePointerCancel = () => {
			this.cancelDrag()
		}
		/** Cancels the drag when Escape is pressed so an accidental over-drag is not persisted. */
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") this.cancelDrag()
		}

		this.cleanup = () => {
			document.removeEventListener("pointermove", handlePointerMove)
			document.removeEventListener("pointerup", handlePointerUp)
			document.removeEventListener("pointercancel", handlePointerCancel)
			window.removeEventListener("keydown", handleKeyDown)
			if (typeof document !== "undefined") {
				document.body.style.cursor = this.prevBodyCursor
				document.body.style.userSelect = this.prevBodyUserSelect
				document.documentElement.removeAttribute("data-recording-resizing")
			}
			const activePanel = this.panelRef?.current ?? null
			if (activePanel) {
				activePanel.removeAttribute("data-resizing")
				activePanel.style.transition = this.prevPanelTransition
			}
			this.cleanup = null
			if (typeof window !== "undefined") {
				window.dispatchEvent(new Event("resize"))
			}
		}

		document.addEventListener("pointermove", handlePointerMove)
		document.addEventListener("pointerup", handlePointerUp)
		document.addEventListener("pointercancel", handlePointerCancel)
		window.addEventListener("keydown", handleKeyDown)
	}

	/** Updates the previewed width and collapse intent. Rightward movement narrows the conversation surface. */
	updateDrag(clientX: number) {
		const rawWidth = this.startWidth - (clientX - this.startX)
		const nextWidth = clampConversationWidth(rawWidth)

		// Only touch the DOM when the clamped conversation width actually changes.
		if (nextWidth !== this.currentWidth) {
			this.currentWidth = nextWidth
			const panel = this.panelRef?.current ?? null
			if (panel) applyPanelWidth(panel, this.currentWidth, this.historyOffset)
		}

		const intent = getResizeCollapseIntent(
			rawWidth,
			RECORDING_CHAT_MIN_WIDTH,
			this.collapseArmed,
		)
		if (this.collapseProgress !== intent.progress) this.collapseProgress = intent.progress
		if (this.collapseArmed !== intent.armed) this.collapseArmed = intent.armed
	}

	/** Finalizes a drag: an armed over-drag collapses, otherwise the clamped width is committed. */
	endDrag(finalClientX?: number) {
		// Flush the last pointer position before committing so the result reflects the exact release point.
		if (finalClientX !== undefined) this.updateDrag(finalClientX)
		const collapsed = this.collapseArmed
		const commit = this.onCommit
		// Collapsing keeps the pre-drag conversation width for the next expand.
		const committedWidth = collapsed ? this.startWidth : this.currentWidth

		this.cleanup?.()

		this.isDragging = false
		this.collapseProgress = 0
		this.collapseArmed = false
		this.onCommit = null
		this.panelRef = null

		commit?.({ collapsed, width: committedWidth })
	}

	/** Cancels a drag without persisting anything, restoring the pre-drag rail width. */
	cancelDrag() {
		const panel = this.panelRef?.current ?? null
		if (panel) applyPanelWidth(panel, this.startWidth, this.historyOffset)

		this.cleanup?.()

		this.isDragging = false
		this.collapseProgress = 0
		this.collapseArmed = false
		this.onCommit = null
		this.panelRef = null
	}
}

/** Shared singleton; a single conversation drag may be active on the desktop detail page at a time. */
export const recordingConversationPanelDragStore = new RecordingConversationPanelDragStore()
