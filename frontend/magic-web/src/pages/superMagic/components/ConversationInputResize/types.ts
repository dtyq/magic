import type { ReactNode } from "react"

export type { ChatInputHeightMode, ChatInputHeightPreference } from "@/stores/interface"

export interface ConversationInputLayoutContextValue {
	fillHeight: boolean
	inputResizeHandle?: ReactNode
	/** 同次布局测量计算的队列列表高度上限，不包含标题和其它附件区。 */
	queueListMaxHeight?: number
}

export interface ConversationInputHeightController {
	enabled: boolean
	effectiveHeight: number
	/** Expose the live minimum so every resize entry point shares the same floor. */
	minHeight: number
	maxHeight: number
	queueListMaxHeight: number
	fillHeight: boolean
	/** Start a pointer-driven manual resize. */
	startPointerResize: () => void
	/** Apply a pointer movement delta to the manual height. */
	resizeByPointerDelta: (deltaY: number) => void
	/** Finish a pointer-driven manual resize and persist the preference. */
	finishPointerResize: () => void
	/** Handle the Ant Design Splitter resize lifecycle. */
	onSplitterResizeStart: (sizes: number[]) => void
	onSplitterResize: (sizes: number[]) => void
	onSplitterResizeEnd: (sizes: number[]) => void
	/** Return the current scope to content-driven automatic sizing. */
	restoreAutoHeight: () => void
}
