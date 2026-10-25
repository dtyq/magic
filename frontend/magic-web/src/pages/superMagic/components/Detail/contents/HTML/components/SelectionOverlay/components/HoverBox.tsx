import { memo } from "react"
import { cn } from "@/utils/cn"
import type { ElementRect } from "../types"
import { HTML_EDITOR_Z_INDEX } from "../../../constants/z-index"
import { HOVER_CHROME_BORDER_CLASS } from "./selectionChrome"

interface HoverBoxProps {
	rect: ElementRect
	isSelectionMode: boolean
}

/**
 * Hover highlight box
 */
export const HoverBox = memo(function HoverBox({ rect, isSelectionMode }: HoverBoxProps) {
	if (!isSelectionMode) return null

	return (
		<div
			data-testid="html-editor-hover-box"
			className={cn(
				"absolute border transition-[height,width,transform,opacity] duration-150 ease-out motion-reduce:transition-none",
				HOVER_CHROME_BORDER_CLASS,
			)}
			style={{
				top: `${rect.top}px`,
				left: `${rect.left}px`,
				width: `${rect.width}px`,
				height: `${rect.height}px`,
				zIndex: HTML_EDITOR_Z_INDEX.OVERLAY.HOVER_HIGHLIGHT,
			}}
		/>
	)
})
