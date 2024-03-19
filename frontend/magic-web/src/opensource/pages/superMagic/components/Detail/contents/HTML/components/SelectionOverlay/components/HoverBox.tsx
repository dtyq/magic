import { memo } from "react"
import type { ElementRect } from "../types"
import { HTML_EDITOR_Z_INDEX } from "../../../constants/z-index"

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
			className="absolute border border-dashed border-gray-500 transition-all duration-100 ease-out"
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
