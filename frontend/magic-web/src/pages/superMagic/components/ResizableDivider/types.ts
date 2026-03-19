export interface ResizableDividerProps {
	onMouseDown: (e: React.MouseEvent) => void
	position?: "left" | "right"
	isDragging?: boolean
	onHoverChange?: (isHovering: boolean) => void
	// Offset from left edge when position="right", used to position divider at dynamic width
	offsetLeft?: number
}
