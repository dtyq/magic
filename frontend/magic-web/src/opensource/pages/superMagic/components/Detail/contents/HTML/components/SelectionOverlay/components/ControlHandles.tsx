import { RotateCw, Move, Trash2, Copy } from "lucide-react"
import type { ResizeHandleConfig, ElementRect } from "../types"
import { RotationIndicator } from "./RotationIndicator"

interface ControlHandlesProps {
	// Move
	isMoving: boolean
	onMoveHandleMouseDown: (event: React.PointerEvent) => void
	// Duplicate
	onDuplicate: (event: React.PointerEvent) => void
	// Delete
	onDelete: (event: React.PointerEvent) => void
	// Resize
	resizeHandles: ResizeHandleConfig[]
	onResizeHandleMouseDown: (event: React.PointerEvent, handle: ResizeHandleConfig) => void
	// Rotate
	rotation: number
	onRotateHandleMouseDown: (
		event: React.PointerEvent,
		rect: ElementRect,
		containerElement: HTMLElement | null,
	) => void
	transformedRect: ElementRect
	containerElement: HTMLElement | null
	// Size-based display control
	showActionHandles?: boolean
}

/**
 * Control handles for selected element (move, rotate, resize, delete, duplicate)
 */
export function ControlHandles({
	isMoving,
	onMoveHandleMouseDown,
	onDuplicate,
	onDelete,
	resizeHandles,
	onResizeHandleMouseDown,
	rotation,
	onRotateHandleMouseDown,
	transformedRect,
	containerElement,
	showActionHandles = true,
}: ControlHandlesProps) {
	return (
		<>
			{/* Move handle - top left corner */}
			<div
				role="button"
				aria-label="Move element"
				className="pointer-events-auto absolute flex h-6 w-6 touch-none items-center justify-center rounded-full border-2 border-background bg-primary shadow-md transition-transform hover:scale-110"
				style={{
					top: -14,
					left: -14,
					cursor: isMoving ? "grabbing" : "grab",
				}}
				onPointerDown={onMoveHandleMouseDown}
			>
				<Move size={12} className="text-primary-foreground" />
			</div>

			{/* Duplicate handle - top right corner (left of delete) */}
			{/* Hidden when selection box is too small to avoid crowding */}
			{showActionHandles && (
				<div
					role="button"
					aria-label="Duplicate element"
					className="pointer-events-auto absolute flex h-6 w-6 touch-none items-center justify-center rounded-full border-2 border-background bg-blue-500 shadow-md transition-transform hover:scale-110"
					style={{
						top: -14,
						right: 20,
						cursor: "pointer",
					}}
					onPointerDown={onDuplicate}
				>
					<Copy size={12} className="text-white" />
				</div>
			)}

			{/* Delete handle - top right corner */}
			{/* Hidden when selection box is too small to avoid crowding */}
			{showActionHandles && (
				<div
					role="button"
					aria-label="Delete element"
					className="pointer-events-auto absolute flex h-6 w-6 touch-none items-center justify-center rounded-full border-2 border-background bg-destructive shadow-md transition-transform hover:scale-110"
					style={{
						top: -14,
						right: -14,
						cursor: "pointer",
					}}
					onPointerDown={onDelete}
				>
					<Trash2 size={12} className="text-destructive-foreground" />
				</div>
			)}

			{/* Resize handles */}
			{resizeHandles.map((handle) => (
				<div
					key={handle.id}
					role="button"
					aria-label={`Resize ${handle.id}`}
					className="pointer-events-auto absolute h-3 w-3 touch-none rounded-full border-2 border-primary bg-background shadow-sm"
					style={{
						...handle.style,
						cursor: handle.cursor,
					}}
					onPointerDown={(event) => onResizeHandleMouseDown(event, handle)}
				/>
			))}

			{/* Rotate handle */}
			<div
				className="pointer-events-none absolute left-1/2 -translate-x-1/2"
				style={{
					top: -32,
				}}
			>
				{/* Connection line */}
				<div
					className="absolute left-1/2 top-6 h-6 w-0.5 -translate-x-1/2 bg-primary"
					style={{
						opacity: 0.5,
					}}
				/>
				{/* Rotate handle button */}
				<div
					role="button"
					aria-label="Rotate element"
					className="pointer-events-auto flex h-6 w-6 touch-none items-center justify-center rounded-full border-2 border-background bg-primary shadow-md transition-transform hover:scale-110"
					style={{
						cursor: "grab",
					}}
					onPointerDown={(event) =>
						onRotateHandleMouseDown(event, transformedRect, containerElement)
					}
				>
					<RotateCw size={12} className="text-primary-foreground" />
				</div>
				{/* Rotation angle indicator */}
				<RotationIndicator rotation={rotation} />
			</div>
		</>
	)
}
