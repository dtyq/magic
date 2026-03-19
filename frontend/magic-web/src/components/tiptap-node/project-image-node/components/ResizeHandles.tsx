import * as React from "react"

/**
 * Resize direction types
 */
type ResizeDirection = "se" | "sw" | "ne" | "nw"

/**
 * Props for ResizeHandles component
 */
interface ResizeHandlesProps {
	/** Callback when resize starts */
	onResizeStart: (e: React.MouseEvent, direction: ResizeDirection) => void
	/** Whether the handles should be visible */
	visible?: boolean
}

/**
 * ResizeHandles component displays corner handles for image resizing
 * Provides four corner handles: northwest, northeast, southwest, southeast
 */
export function ResizeHandles({ onResizeStart, visible = true }: ResizeHandlesProps) {
	if (!visible) return null

	return (
		<>
			{/* Northwest corner handle */}
			<div
				className="project-image-node__resize-handle project-image-node__resize-handle--nw"
				onMouseDown={(e) => onResizeStart(e, "nw")}
			/>
			{/* Northeast corner handle */}
			<div
				className="project-image-node__resize-handle project-image-node__resize-handle--ne"
				onMouseDown={(e) => onResizeStart(e, "ne")}
			/>
			{/* Southwest corner handle */}
			<div
				className="project-image-node__resize-handle project-image-node__resize-handle--sw"
				onMouseDown={(e) => onResizeStart(e, "sw")}
			/>
			{/* Southeast corner handle */}
			<div
				className="project-image-node__resize-handle project-image-node__resize-handle--se"
				onMouseDown={(e) => onResizeStart(e, "se")}
			/>
		</>
	)
}
