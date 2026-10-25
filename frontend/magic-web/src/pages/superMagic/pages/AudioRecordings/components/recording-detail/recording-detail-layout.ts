/**
 * Shared horizontal inset for PC detail tab bodies (excludes mindmap).
 * Percentage-based so the side gutters scale with the workspace width.
 */
export const RECORDING_DESKTOP_CONTENT_INSET_CLASS = "w-full px-[10%]"

/** Markdown bodies add scroll-end breathing room on top of the shared inset. */
export const RECORDING_DESKTOP_MD_CONTENT_CLASS = `${RECORDING_DESKTOP_CONTENT_INSET_CLASS} pb-8`

/**
 * Narrowest desktop transcript column that still fits the collapsed player.
 * Play, time, rate, skip, and expand are fixed; 300px clipped the expand control.
 */
export const RECORDING_DETAIL_TRANSCRIPT_MIN_WIDTH = 360

/**
 * Widest desktop transcript column. 640px is about forty 14px characters per line,
 * and the 360–640 band leaves enough travel that dragging is still useful.
 */
export const RECORDING_DETAIL_TRANSCRIPT_MAX_WIDTH = 640

/** Default expanded width. Sits inside the band so a first open can still grow or shrink. */
export const RECORDING_DETAIL_TRANSCRIPT_DEFAULT_WIDTH = 440

/** Width of the drag handle column that separates transcript from summary in the expanded layout. */
export const RECORDING_DETAIL_TRANSCRIPT_HANDLE_WIDTH = 24

/** Minimum readable width of the desktop summary and notes column. */
export const RECORDING_DETAIL_SUMMARY_MIN_WIDTH = 480

/** Minimum width of both detail columns including the 24px handle and 32px side insets. */
export const RECORDING_DETAIL_WORKBENCH_MIN_WIDTH =
	RECORDING_DETAIL_TRANSCRIPT_MIN_WIDTH +
	RECORDING_DETAIL_TRANSCRIPT_HANDLE_WIDTH +
	RECORDING_DETAIL_SUMMARY_MIN_WIDTH +
	64

/** Minimum workbench width when the transcript column is fully collapsed and only summary remains. */
export const RECORDING_DETAIL_WORKBENCH_MIN_WIDTH_COLLAPSED =
	RECORDING_DETAIL_SUMMARY_MIN_WIDTH + 64

/** Width of the project-detail style icon rail after the recording chat is collapsed. */
export const RECORDING_CHAT_COLLAPSED_WIDTH = 24

/** Narrowest expanded conversation surface; dragging past this can arm collapse. */
export const RECORDING_CHAT_MIN_WIDTH = 320

/** Widest expanded conversation surface. Narrow windows do not lower this cap. */
export const RECORDING_CHAT_MAX_WIDTH = 560

/** Default width of the recording conversation surface when no width has been stored. */
export const RECORDING_CHAT_EXPANDED_WIDTH = 380

/** Compact history width reserved for the constrained recording-detail workspace. */
export const RECORDING_CHAT_HISTORY_WIDTH = 240
