export interface ResizableDividerProps {
	onResizeStart: (clientX: number) => void
	position?: "left" | "right"
	isDragging?: boolean
	onHoverChange?: (isHovering: boolean) => void
	// Distance from the panel boundary used to position the divider at a dynamic width.
	offsetLeft?: number
}
