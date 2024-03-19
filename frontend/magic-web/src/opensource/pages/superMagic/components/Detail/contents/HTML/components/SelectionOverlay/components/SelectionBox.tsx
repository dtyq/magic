import { memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { ElementRect, SelectedInfo, ResizeHandleConfig } from "../types"
import { HTML_EDITOR_Z_INDEX } from "../../../constants/z-index"
import { ControlHandles } from "./ControlHandles"
import { SmallSelectionHint } from "./SmallSelectionHint"
import { shouldShowActionHandles } from "../utils/size-detection"

interface SelectionBoxProps {
	info: SelectedInfo
	transformedRect: ElementRect
	isMultiSelect: boolean
	isSelectionMode: boolean
	transform: string | undefined
	// Control handles props
	containerElement: HTMLElement | null
	isMoving: boolean
	rotation: number
	resizeHandles: ResizeHandleConfig[]
	onMoveHandleMouseDown: (event: React.PointerEvent) => void
	onRotateHandleMouseDown: (
		event: React.PointerEvent,
		rect: ElementRect,
		containerElement: HTMLElement | null,
	) => void
	onResizeHandleMouseDown: (event: React.PointerEvent, handle: ResizeHandleConfig) => void
	onDelete: (event: React.PointerEvent) => void
	onDuplicate: (event: React.PointerEvent) => void
}

/**
 * Single selection box with optional control handles
 */
export const SelectionBox = memo(function SelectionBox({
	info,
	transformedRect,
	isMultiSelect,
	isSelectionMode,
	transform,
	containerElement,
	isMoving,
	rotation,
	resizeHandles,
	onMoveHandleMouseDown,
	onRotateHandleMouseDown,
	onResizeHandleMouseDown,
	onDelete,
	onDuplicate,
}: SelectionBoxProps) {
	const isOnlySelected = !isMultiSelect
	const showActions = shouldShowActionHandles(transformedRect)

	return (
		<>
			<motion.div
				key={info.selector}
				className="pointer-events-none absolute border-2 border-primary"
				initial={{ opacity: 0, scale: 0.97 }}
				animate={{
					opacity: isMultiSelect ? 0.7 : 1,
					scale: 1,
					rotate: transform
						? parseFloat(transform.match(/rotate\(([^)]+)deg\)/)?.[1] || "0")
						: 0,
				}}
				exit={{ opacity: 0, scale: 0.97 }}
				transition={{
					duration: 0.12,
					ease: [0.4, 0, 0.2, 1], // Custom cubic-bezier for snappy animation
				}}
				layout="position"
				style={{
					top: `${transformedRect.top}px`,
					left: `${transformedRect.left}px`,
					width: `${transformedRect.width}px`,
					height: `${transformedRect.height}px`,
					boxShadow: isMultiSelect
						? "0 0 0 2px rgb(var(--primary-rgb) / 0.1)"
						: "0 0 0 4px rgb(var(--primary-rgb) / 0.1)",
					zIndex: HTML_EDITOR_Z_INDEX.OVERLAY.SELECTION_HIGHLIGHT,
					transformOrigin: "center center",
				}}
			>
				{/* Only show handles in single-select mode */}
				{isOnlySelected && isSelectionMode && (
					<ControlHandles
						isMoving={isMoving}
						onMoveHandleMouseDown={onMoveHandleMouseDown}
						onDuplicate={onDuplicate}
						onDelete={onDelete}
						resizeHandles={resizeHandles}
						onResizeHandleMouseDown={onResizeHandleMouseDown}
						rotation={rotation}
						onRotateHandleMouseDown={onRotateHandleMouseDown}
						transformedRect={transformedRect}
						containerElement={containerElement}
						showActionHandles={showActions}
					/>
				)}
			</motion.div>

			{/* Show hint when selection is too small (outside the transformed box) */}
			<AnimatePresence mode="wait">
				{isOnlySelected && isSelectionMode && !showActions && (
					<SmallSelectionHint
						key={`hint-${info.selector}`}
						show={true}
						rect={transformedRect}
					/>
				)}
			</AnimatePresence>
		</>
	)
})
