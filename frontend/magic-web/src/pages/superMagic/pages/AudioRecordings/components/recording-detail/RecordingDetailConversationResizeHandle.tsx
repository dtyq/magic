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
	recordingConversationPanelDragStore,
	type ConversationPanelDragCommit,
} from "../../stores/RecordingConversationPanelDragStore"

interface RecordingDetailConversationResizeHandleProps {
	/** The conversation rail whose width is previewed imperatively during a drag. */
	panelRef: RefObject<HTMLDivElement | null>
	/** Current expanded conversation width; serves as the drag origin and excludes history. */
	conversationWidth: number
	/** Pixels added by the open topic history. Fixed for the life of one drag. */
	historyOffset: number
	/** Commits the final drag result: an armed over-drag collapses, otherwise a new width persists. */
	onCommit: (result: ConversationPanelDragCommit) => void
}

/**
 * Overlay drag handle flush against the expanded conversation rail, sitting in the page gap
 * rather than over the messages. It reads drag visuals from the MobX store via `observer`,
 * so a fast drag re-renders only this handle — not the detail page. The handle does not take
 * a layout column, so 320–560px remains the conversation surface itself.
 */
export const RecordingDetailConversationResizeHandle = observer(
	function RecordingDetailConversationResizeHandle({
		panelRef,
		conversationWidth,
		historyOffset,
		onCommit,
	}: RecordingDetailConversationResizeHandleProps) {
		const { t } = useTranslation("audioRecordings")
		const { isDragging, collapseProgress, collapseArmed } = recordingConversationPanelDragStore

		/** Begins a resize from a unified pointer event so mouse, trackpad, and touch share one path. */
		const handlePointerDown = useCallback(
			(event: ReactPointerEvent<HTMLDivElement>) => {
				if (event.button !== 0) return
				event.preventDefault()
				event.currentTarget.setPointerCapture?.(event.pointerId)
				recordingConversationPanelDragStore.startDrag({
					clientX: event.clientX,
					startWidth: conversationWidth,
					historyOffset,
					panelRef,
					onCommit,
				})
			},
			[conversationWidth, historyOffset, panelRef, onCommit],
		)

		return (
			<div
				data-slot="resizable-handle"
				data-resizing={isDragging ? "true" : undefined}
				data-dragging={isDragging ? "true" : undefined}
				data-testid="recording-detail-conversation-resize-handle"
				onPointerDown={handlePointerDown}
				className={cn(
					// Sit in the 8px page gap, flush against the rail. The grip stays out of the
					// message column and does not consume the 320–560 conversation width.
					"group/resize absolute inset-y-0 left-0 z-30 flex w-2 -translate-x-full cursor-col-resize touch-none items-center justify-center bg-transparent",
					resizeGlowClassName,
				)}
			>
				{/* 16px hit target centered on the 8px grip: 4px into the rail, 12px into the gap. */}
				<div
					className="absolute inset-y-0 left-1/2 z-20 w-4 -translate-x-1/2 cursor-col-resize touch-none"
					aria-hidden="true"
				/>
				<ResizeGrip orientation="vertical" />
				{/* Direction is 1 because the conversation surface sits to the right of this handle. */}
				<ResizableCollapseFeedback
					dragging={isDragging}
					collapseProgress={collapseProgress}
					collapseArmed={collapseArmed}
					collapseDirection={1}
					pullLabel={t("detail.pullConversationToCollapse")}
					releaseLabel={t("detail.releaseConversationToCollapse")}
					description={
						collapseArmed
							? t("detail.pullConversationToCancel")
							: t("detail.releaseConversationToKeepOpen")
					}
				/>
			</div>
		)
	},
)
