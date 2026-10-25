import type { ReactNode, RefObject } from "react"
import { cn } from "@/utils/cn"
import { RecordingDetailTranscriptResizeHandle } from "./RecordingDetailTranscriptResizeHandle"
import type { TranscriptPanelDragCommit } from "../../stores/RecordingTranscriptPanelDragStore"
import {
	RECORDING_DETAIL_SUMMARY_MIN_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_DEFAULT_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_HANDLE_WIDTH,
	RECORDING_DETAIL_WORKBENCH_MIN_WIDTH,
	RECORDING_DETAIL_WORKBENCH_MIN_WIDTH_COLLAPSED,
} from "./recording-detail-layout"

interface RecordingDetailWorkbenchProps {
	left: ReactNode
	right: ReactNode
	/** Uses the tighter gutter required when the workbench is embedded in a project file preview. */
	compactHorizontalPadding?: boolean
	/** Collapses the transcript column entirely so the summary column takes the whole workbench. */
	transcriptCollapsed?: boolean
	/** Current expanded transcript width in pixels. */
	transcriptWidth?: number
	/** Disables collapsing (and any collapse feedback) when the right panel has no tab strip. */
	canCollapseTranscript?: boolean
	/** Receives the grid element so the handle can write drag width imperatively. */
	gridRef?: RefObject<HTMLDivElement | null>
	/** Commits a finished transcript drag (collapse vs. new width). */
	onTranscriptDragCommit?: (result: TranscriptPanelDragCommit) => void
}

/** Stable no-op ref used when the owning page has not wired a grid element (e.g. in tests). */
const EMPTY_GRID_REF: RefObject<HTMLDivElement | null> = { current: null }

/** Renders the recording content and generated detail as the inner resizable two-column workbench. */
export function RecordingDetailWorkbench({
	left,
	right,
	compactHorizontalPadding = false,
	transcriptCollapsed = false,
	transcriptWidth = RECORDING_DETAIL_TRANSCRIPT_DEFAULT_WIDTH,
	canCollapseTranscript = true,
	gridRef,
	onTranscriptDragCommit,
}: RecordingDetailWorkbenchProps) {
	// Without a tab-strip expand entry, a collapsed transcript column would strand the user, so force expanded.
	const effectiveCollapsed = transcriptCollapsed && canCollapseTranscript

	// Expanded uses a fixed transcript width plus a handle column; collapsed keeps a single summary column.
	const gridTemplateColumns = effectiveCollapsed
		? `minmax(${RECORDING_DETAIL_SUMMARY_MIN_WIDTH}px, 1fr)`
		: `${transcriptWidth}px ${RECORDING_DETAIL_TRANSCRIPT_HANDLE_WIDTH}px minmax(${RECORDING_DETAIL_SUMMARY_MIN_WIDTH}px, 1fr)`

	return (
		<div
			className="scrollbar-x-thin min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain"
			data-testid="recording-detail-workbench-scroll"
		>
			<div
				ref={gridRef}
				className={cn(
					"grid h-full min-h-0 w-full pb-8 transition-none animate-in fade-in data-[resizing=true]:select-none [&[data-resizing=true]>div]:pointer-events-none [&[data-resizing=true]_[data-slot=resizable-handle]]:pointer-events-auto",
					compactHorizontalPadding ? "px-2.5" : "px-8",
				)}
				style={{
					minWidth: effectiveCollapsed
						? RECORDING_DETAIL_WORKBENCH_MIN_WIDTH_COLLAPSED
						: RECORDING_DETAIL_WORKBENCH_MIN_WIDTH,
					gridTemplateColumns,
					transition: "none",
				}}
				data-testid="recording-detail-workbench"
			>
				{/*
				 * Keep the left column mounted while collapsed (display:none) so the shared <audio>
				 * element never unmounts mid-playback; the hidden node takes no grid track.
				 */}
				<div className={cn("flex min-h-0 flex-col", effectiveCollapsed && "hidden")}>
					{left}
				</div>
				{!effectiveCollapsed ? (
					<RecordingDetailTranscriptResizeHandle
						gridRef={gridRef ?? EMPTY_GRID_REF}
						transcriptWidth={transcriptWidth}
						canCollapse={canCollapseTranscript}
						onCommit={onTranscriptDragCommit ?? (() => undefined)}
					/>
				) : null}
				<div className="min-h-0 min-w-0">{right}</div>
			</div>
		</div>
	)
}
