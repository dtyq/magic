import { makeAutoObservable } from "mobx"
import type { RefObject } from "react"
import { getResizeCollapseIntent } from "@/utils/resizableCollapse"
import {
	RECORDING_DETAIL_SUMMARY_MIN_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_HANDLE_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_MAX_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_MIN_WIDTH,
} from "../components/recording-detail/recording-detail-layout"

/** Result a finished drag hands back to the owning page so it can persist the new preference. */
export interface TranscriptPanelDragCommit {
	collapsed: boolean
	width: number
}

interface StartDragOptions {
	clientX: number
	/** The column width at drag start, used as the origin and restored on cancel. */
	startWidth: number
	/** Whether an over-drag may arm the collapse intent. */
	canCollapse: boolean
	/** The workbench grid element whose leading track is previewed imperatively during the drag. */
	gridRef: RefObject<HTMLDivElement | null>
	/** Called once on a normal release with the resolved collapse vs. width outcome. */
	onCommit: (result: TranscriptPanelDragCommit) => void
}

/** Clamps a raw drag width into the readable transcript band. */
function clampTranscriptWidth(width: number): number {
	return Math.max(
		RECORDING_DETAIL_TRANSCRIPT_MIN_WIDTH,
		Math.min(RECORDING_DETAIL_TRANSCRIPT_MAX_WIDTH, width),
	)
}

/** Builds the expanded grid template so imperative previews match the React-rendered template. */
function buildGridTemplate(width: number): string {
	return `${width}px ${RECORDING_DETAIL_TRANSCRIPT_HANDLE_WIDTH}px minmax(${RECORDING_DETAIL_SUMMARY_MIN_WIDTH}px, 1fr)`
}

/**
 * MobX store that owns the transcript-column drag lifecycle. Unlike React state, the high-frequency
 * drag fields (`collapseProgress` / `collapseArmed` / `isDragging`) are observable, so only the
 * `observer`-wrapped resize handle re-renders during a drag — never the recording-detail page.
 *
 * The transient width is never a React or MobX value: `updateDrag` writes the leading grid track
 * straight to the DOM. Only the final `onCommit` lands a new width in persisted page state.
 */
export class RecordingTranscriptPanelDragStore {
	isDragging = false
	collapseProgress = 0
	collapseArmed = false

	private startX = 0
	private startWidth = 0
	private currentWidth = 0
	private canCollapse = true
	private gridRef: RefObject<HTMLDivElement | null> | null = null
	private onCommit: ((result: TranscriptPanelDragCommit) => void) | null = null
	private cleanup: (() => void) | null = null
	private prevBodyCursor = ""
	private prevBodyUserSelect = ""

	constructor() {
		// Private drag bookkeeping is excluded from observation; only the three drag visuals are tracked.
		makeAutoObservable(
			this,
			{
				startX: false,
				startWidth: false,
				currentWidth: false,
				canCollapse: false,
				gridRef: false,
				onCommit: false,
				cleanup: false,
				prevBodyCursor: false,
				prevBodyUserSelect: false,
			},
			{ autoBind: true },
		)
	}

	/** Begins a drag and installs document-level pointer listeners sharing one mouse/trackpad/touch path. */
	startDrag({ clientX, startWidth, canCollapse, gridRef, onCommit }: StartDragOptions) {
		this.cleanup?.()
		this.startX = clientX
		this.startWidth = startWidth
		this.currentWidth = startWidth
		this.canCollapse = canCollapse
		this.gridRef = gridRef
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
		const grid = this.gridRef?.current ?? null
		if (grid) {
			grid.setAttribute("data-resizing", "true")
			grid.style.transition = "none"
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
		/** Cancels the drag when Escape key is pressed. */
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				this.cancelDrag()
			}
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
			const activeGrid = this.gridRef?.current ?? null
			if (activeGrid) {
				activeGrid.removeAttribute("data-resizing")
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

	/** Updates the previewed width and collapse intent from a pointer position without React re-render. */
	updateDrag(clientX: number) {
		const rawWidth = this.startWidth + (clientX - this.startX)
		const nextWidth = clampTranscriptWidth(rawWidth)

		// Only touch the DOM when the clamped width actually changes.
		if (nextWidth !== this.currentWidth) {
			this.currentWidth = nextWidth
			const grid = this.gridRef?.current ?? null
			if (grid) grid.style.gridTemplateColumns = buildGridTemplate(this.currentWidth)
		}

		// Only express collapse intent when the host actually offers an expand entry.
		if (this.canCollapse) {
			const intent = getResizeCollapseIntent(
				rawWidth,
				RECORDING_DETAIL_TRANSCRIPT_MIN_WIDTH,
				this.collapseArmed,
			)
			if (this.collapseProgress !== intent.progress) {
				this.collapseProgress = intent.progress
			}
			if (this.collapseArmed !== intent.armed) {
				this.collapseArmed = intent.armed
			}
		} else if (this.collapseProgress !== 0 || this.collapseArmed) {
			this.collapseProgress = 0
			this.collapseArmed = false
		}
	}

	/** Finalizes a drag: an armed over-drag collapses, otherwise the clamped width is committed. */
	endDrag(finalClientX?: number) {
		// Flush the last pointer position before committing so the result reflects the exact release point.
		if (finalClientX !== undefined) this.updateDrag(finalClientX)
		const collapsed = this.collapseArmed && this.canCollapse
		const commit = this.onCommit
		const committedWidth = collapsed ? this.startWidth : this.currentWidth

		this.cleanup?.()

		this.isDragging = false
		this.collapseProgress = 0
		this.collapseArmed = false
		this.onCommit = null
		this.gridRef = null

		// Collapsing keeps the pre-drag width for the next expand; otherwise the clamped width wins.
		commit?.({ collapsed, width: committedWidth })
	}

	/** Cancels a drag without persisting anything, restoring the pre-drag grid width. */
	cancelDrag() {
		const grid = this.gridRef?.current ?? null
		if (grid) grid.style.gridTemplateColumns = buildGridTemplate(this.startWidth)

		this.cleanup?.()

		this.isDragging = false
		this.collapseProgress = 0
		this.collapseArmed = false
		this.onCommit = null
		this.gridRef = null
	}
}

/** Shared singleton; a single drag may be active across any recording-detail host at a time. */
export const recordingTranscriptPanelDragStore = new RecordingTranscriptPanelDragStore()
