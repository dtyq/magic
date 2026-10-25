import { useCallback } from "react"
import type { PointerEvent as ReactPointerEvent, RefObject } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import {
	ResizableCollapseFeedback,
	ResizeGrip,
	resizeGlowClassName,
} from "@/components/shadcn-ui/resizable"
import {
	recordingTranscriptPanelDragStore,
	type TranscriptPanelDragCommit,
} from "../../stores/RecordingTranscriptPanelDragStore"

interface RecordingDetailTranscriptResizeHandleProps {
	/** The workbench grid element whose leading track is previewed imperatively during a drag. */
	gridRef: RefObject<HTMLDivElement | null>
	/** Current expanded transcript width; serves as the drag origin. */
	transcriptWidth: number
	/** When false, the handle only resizes and never arms collapse feedback. */
	canCollapse: boolean
	/** Commits the final drag result: an armed over-drag collapses, otherwise a new width persists. */
	onCommit: (result: TranscriptPanelDragCommit) => void
}

/**
 * Drag handle between the transcript and summary columns. It reads its drag visuals from the MobX
 * store via `observer`, so a fast drag re-renders only this small component — the recording-detail
 * page and the transcript list stay untouched.
 */
export const RecordingDetailTranscriptResizeHandle = observer(
	function RecordingDetailTranscriptResizeHandle({
		gridRef,
		transcriptWidth,
		canCollapse,
		onCommit,
	}: RecordingDetailTranscriptResizeHandleProps) {
		const { t } = useTranslation("audioRecordings")
		const { isDragging, collapseProgress, collapseArmed } = recordingTranscriptPanelDragStore

		/** Begins a resize from a unified pointer event so mouse, trackpad, and touch share one path. */
		const handlePointerDown = useCallback(
			(event: ReactPointerEvent<HTMLDivElement>) => {
				if (event.button !== 0) return
				event.preventDefault()
				event.currentTarget.setPointerCapture?.(event.pointerId)
				recordingTranscriptPanelDragStore.startDrag({
					clientX: event.clientX,
					startWidth: transcriptWidth,
					canCollapse,
					gridRef,
					onCommit,
				})
			},
			[transcriptWidth, canCollapse, gridRef, onCommit],
		)

		return (
			<div
				data-slot="resizable-handle"
				data-resizing={isDragging ? "true" : undefined}
				data-dragging={isDragging ? "true" : undefined}
				onPointerDown={handlePointerDown}
				className={cn(
					// The handle stays a narrow 8px grip centered in its 24px column; the hover/drag glow
					// fills only this narrow element, while the wider hit area below keeps grabbing easy.
					"group/resize relative flex h-full w-2 cursor-col-resize touch-none items-center justify-center justify-self-center bg-transparent",
					resizeGlowClassName,
				)}
				data-testid="recording-detail-transcript-resize-handle"
			>
				{/* Widen the pointer target without widening the visual grip. */}
				<div
					className="absolute inset-y-0 left-1/2 z-20 w-4 -translate-x-1/2 cursor-col-resize touch-none"
					aria-hidden="true"
				/>
				<ResizeGrip orientation="vertical" />
				{/* Collapse direction is -1 because the transcript column sits left of the handle. */}
				{canCollapse ? (
					<ResizableCollapseFeedback
						dragging={isDragging}
						collapseProgress={collapseProgress}
						collapseArmed={collapseArmed}
						collapseDirection={-1}
						pullLabel={t("detail.pullTranscriptToCollapse")}
						releaseLabel={t("detail.releaseTranscriptToCollapse")}
						description={
							collapseArmed
								? t("detail.pullTranscriptToCancel")
								: t("detail.releaseTranscriptToKeepOpen")
						}
					/>
				) : null}
			</div>
		)
	},
)
