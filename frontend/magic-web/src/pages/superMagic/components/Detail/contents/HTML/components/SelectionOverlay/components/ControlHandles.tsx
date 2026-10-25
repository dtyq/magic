import { useState } from "react"
import { RotateCw, Move } from "lucide-react"
// 恢复复制、删除按钮时，同时启用以下图标：Copy、Trash2。
// import { Copy, Trash2 } from "lucide-react"
import type { ResizeHandleConfig, ElementRect } from "../types"
import type { GapAxis, GapHandleFrame } from "../utils/gapHandleLayout"
import {
	ROTATE_HANDLE_CONNECTOR_HEIGHT,
	ROTATE_HANDLE_SIZE,
	ROTATE_HANDLE_WRAPPER_TOP,
} from "../utils/rotateHandleLayout"
import { getResizeHandleStyles, getResizeHandleTickLength } from "../utils/resizeHandleLayout"
import { GapTick } from "./GapTick"
import { ResizeTick } from "./ResizeTick"
import { RotationIndicator } from "./RotationIndicator"
import "./selectionHandleMotion.css"

const ACTION_HANDLE_CLASS =
	"pointer-events-auto flex h-5 w-5 touch-none items-center justify-center rounded-full border border-background bg-primary transition-transform duration-150 ease-out hover:scale-105 active:scale-[0.96] motion-reduce:transition-none"

const GAP_HIT_CLASS =
	"group/gap pointer-events-auto absolute flex items-center justify-center opacity-30 transition-opacity duration-150 hover:opacity-100 data-[dragging=true]:opacity-100"

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
	// Gap
	gapHandles?: GapHandleFrame[]
	onGapHandlePointerDown?: (event: React.PointerEvent, axis: GapAxis) => void
	isGapDragging?: boolean
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
	resizeHandles,
	onResizeHandleMouseDown,
	gapHandles = [],
	onGapHandlePointerDown,
	isGapDragging = false,
	rotation,
	onRotateHandleMouseDown,
	transformedRect,
	containerElement,
}: ControlHandlesProps) {
	const resizeStyles = getResizeHandleStyles()
	const tickLength = getResizeHandleTickLength(transformedRect)
	const [activeGapId, setActiveGapId] = useState<string | null>(null)

	return (
		<>
			{/* Move handle - top left corner */}
			<div
				role="button"
				aria-label="Move element"
				className={`${ACTION_HANDLE_CLASS} absolute`}
				style={{
					top: -11,
					left: -11,
					cursor: isMoving ? "grabbing" : "grab",
				}}
				onPointerDown={onMoveHandleMouseDown}
				data-testid="on-move-handle-mouse-down"
			>
				<Move
					size={11}
					strokeWidth={2}
					className={`text-primary-foreground ${isMoving ? "" : "html-editor-knob-breathe"}`}
				/>
			</div>

			{/* 暂时隐藏复制和删除按钮，保留对应回调与快捷键逻辑。 */}
			{/*
			{showActionHandles && (
				<div
					role="button"
					aria-label="Duplicate element"
					className="pointer-events-auto absolute flex h-6 w-6 touch-none items-center justify-center rounded-full border-2 border-background bg-blue-500 shadow-md transition-transform duration-150 ease-out hover:scale-105 active:scale-[0.96] motion-reduce:transition-none"
					style={{
						top: -14,
						right: 20,
						cursor: "pointer",
					}}
					onPointerDown={onDuplicate}
					data-testid="on-duplicate"
				>
					<Copy size={12} className="text-white" />
				</div>
			)}

			{showActionHandles && (
				<div
					role="button"
					aria-label="Delete element"
					className="pointer-events-auto absolute flex h-6 w-6 touch-none items-center justify-center rounded-full border-2 border-background bg-destructive shadow-md transition-transform duration-150 ease-out hover:scale-105 active:scale-[0.96] motion-reduce:transition-none"
					style={{
						top: -14,
						right: -14,
						cursor: "pointer",
					}}
					onPointerDown={onDelete}
					data-testid="on-delete"
				>
					<Trash2 size={12} className="text-destructive-foreground" />
				</div>
			)}
			*/}

			{gapHandles.map((frame) => (
				<div
					key={frame.id}
					role="button"
					aria-label={`Adjust ${frame.axis} gap`}
					className={GAP_HIT_CLASS}
					style={{
						left: frame.left,
						top: frame.top,
						width: frame.width,
						height: frame.height,
						cursor: frame.cursor,
					}}
					data-testid="on-gap-handle-pointer-down"
					data-axis={frame.axis}
					data-gap-id={frame.id}
					data-dragging={isGapDragging && activeGapId === frame.id ? "true" : undefined}
					onPointerDown={(event) => {
						setActiveGapId(frame.id)
						onGapHandlePointerDown?.(event, frame.axis)
					}}
				>
					<GapTick axis={frame.axis} />
					{frame.valueLabel ? (
						<span
							data-testid="gap-value-readout"
							className={
								frame.axis === "column"
									? "pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-full rounded-sm bg-primary px-1 py-0.5 text-[10px] tabular-nums leading-none text-primary-foreground opacity-0 shadow-sm transition-opacity duration-150 group-hover/gap:opacity-100 group-data-[dragging=true]/gap:opacity-100"
									: "pointer-events-none absolute left-0 top-1/2 z-10 -translate-x-full -translate-y-1/2 rounded-sm bg-primary px-1 py-0.5 text-[10px] tabular-nums leading-none text-primary-foreground opacity-0 shadow-sm transition-opacity duration-150 group-hover/gap:opacity-100 group-data-[dragging=true]/gap:opacity-100"
							}
						>
							{frame.valueLabel}
						</span>
					) : null}
				</div>
			))}

			{/* Edge ticks; corner hit uses the existing L-mark. */}
			{resizeHandles.map((handle) => (
				<div
					key={handle.id}
					role="button"
					aria-label={`Resize ${handle.id}`}
					className="group/resize pointer-events-auto absolute flex h-5 w-5 touch-none items-center justify-center"
					style={{
						...handle.style,
						...resizeStyles[handle.id],
						cursor: handle.cursor,
					}}
					onPointerDown={(event) => onResizeHandleMouseDown(event, handle)}
					data-testid="on-resize-handle-mouse-down"
					data-handle-id={handle.id}
				>
					<ResizeTick id={handle.id} length={tickLength} />
				</div>
			))}

			{/* Rotate knob with a dimension-line stem */}
			<div
				className="pointer-events-none absolute left-1/2 -translate-x-1/2"
				style={{
					top: ROTATE_HANDLE_WRAPPER_TOP,
				}}
			>
				<div
					className="absolute left-1/2 w-px -translate-x-1/2 bg-primary/55"
					style={{
						top: ROTATE_HANDLE_SIZE,
						height: ROTATE_HANDLE_CONNECTOR_HEIGHT,
					}}
				/>
				<div
					className="absolute left-1/2 h-px w-1.5 -translate-x-1/2 bg-primary/55"
					style={{
						top: ROTATE_HANDLE_SIZE + ROTATE_HANDLE_CONNECTOR_HEIGHT / 2,
					}}
				/>
				<div
					role="button"
					aria-label="Rotate element"
					className={ACTION_HANDLE_CLASS}
					style={{
						cursor: "grab",
					}}
					onPointerDown={(event) =>
						onRotateHandleMouseDown(event, transformedRect, containerElement)
					}
					data-testid="on-rotate-handle-mouse-down"
				>
					<RotateCw
						size={11}
						strokeWidth={2}
						className="html-editor-knob-spin text-primary-foreground"
					/>
				</div>
				<RotationIndicator rotation={rotation} />
			</div>
		</>
	)
}
