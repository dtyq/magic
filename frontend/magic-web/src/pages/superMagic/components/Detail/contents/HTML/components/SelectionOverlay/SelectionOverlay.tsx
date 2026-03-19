/**
 * Selection Overlay Component
 * Renders element selection and hover highlights in the parent window (not inside iframe)
 */

import { memo, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import type { HTMLEditorV2Ref } from "../../iframe-bridge/types/props"
import type { ElementRect, SelectedInfo } from "./types"
import { HTML_EDITOR_Z_INDEX } from "../../constants/z-index"
import { useSelectionMessages } from "./hooks/useSelectionMessages"
import { useScrollSync } from "./hooks/useScrollSync"
import { useScaleSync } from "./hooks/useScaleSync"
import { useSelectionHandles } from "./hooks/useSelectionHandles"
import { transformRect, getSelectionBoxTransform } from "./utils/transform"
import { SelectionBox } from "./components/SelectionBox"
import { HoverBox } from "./components/HoverBox"

interface SelectionOverlayProps {
	scrollContainerRef?: React.RefObject<HTMLElement>
	containerRef?: React.RefObject<HTMLElement>
	iframeRef: React.RefObject<HTMLIFrameElement>
	editorRef?: React.RefObject<HTMLEditorV2Ref>
	scaleRatio?: number
	isPptRender?: boolean
	disabled?: boolean
	className?: string
	onSelectedElementChange?: (rect: ElementRect | null) => void
}

export const SelectionOverlay = memo(function SelectionOverlay({
	scrollContainerRef,
	containerRef,
	iframeRef,
	editorRef,
	scaleRatio = 1,
	isPptRender = false,
	disabled = false,
	className,
	onSelectedElementChange,
}: SelectionOverlayProps) {
	const [selectedInfoList, setSelectedInfoList] = useState<SelectedInfo[]>([])
	const [hoveredRect, setHoveredRect] = useState<ElementRect | null>(null)
	const [isSelectionMode, setIsSelectionMode] = useState(false)
	const overlayRef = useRef<HTMLDivElement>(null)

	// For backward compatibility - single selected element (memoized)
	const selectedInfo = useMemo(
		() => (selectedInfoList.length === 1 ? selectedInfoList[0] : null),
		[selectedInfoList],
	)
	const isMultiSelect = useMemo(() => selectedInfoList.length > 1, [selectedInfoList])

	// Notify parent component when selected element changes (with stable callback)
	const selectedRectRef = useRef<ElementRect | null>(null)
	const selectedRect = useMemo(() => selectedInfo?.rect || null, [selectedInfo])

	useEffect(() => {
		// Only notify if rect actually changed to prevent unnecessary parent updates
		if (onSelectedElementChange && selectedRectRef.current !== selectedRect) {
			selectedRectRef.current = selectedRect
			onSelectedElementChange(selectedRect)
		}
	}, [selectedRect, onSelectedElementChange])

	// Handle messages from iframe
	useSelectionMessages({
		iframeRef,
		editorRef,
		selectedInfoList,
		setSelectedInfoList,
		setHoveredRect,
		setIsSelectionMode,
	})

	// Sync highlights on scroll/resize (hides during scrolling, shows after)
	const { isScrolling } = useScrollSync({
		containerRef: scrollContainerRef,
		iframeRef,
		isSelectionMode,
		selectedInfoList,
		hoveredRect,
		setSelectedInfoList,
		setHoveredRect,
	})

	// Sync highlights on scale changes (hides during scaling, shows after)
	const { isScaling } = useScaleSync({
		scaleRatio,
		isSelectionMode,
		selectedInfoList,
		hoveredRect,
		setSelectedInfoList,
		setHoveredRect,
	})

	// Hide selection boxes during scrolling or scaling
	const shouldHide = isScrolling || isScaling

	// All selection handles (move, rotate, resize, delete, duplicate)
	const {
		onHandleMouseDown,
		resizeHandles,
		onRotateHandleMouseDown,
		rotation,
		onMoveHandleMouseDown,
		isMoving,
		handleDelete,
		handleDuplicate,
	} = useSelectionHandles({
		editorRef,
		isPptRender,
		scaleRatio,
		selectedInfo,
		iframeRef,
		setSelectedInfoList,
		setHoveredRect,
		setIsSelectionMode,
	})

	// Transform hover rect (memoized)
	const transformedHoveredRect = useMemo(
		() => (hoveredRect ? transformRect(hoveredRect, iframeRef, isPptRender, scaleRatio) : null),
		[hoveredRect, iframeRef, isPptRender, scaleRatio],
	)

	// Calculate live rotation for display (memoized)
	const displayRotation = useMemo(() => selectedInfo?.rotation ?? 0, [selectedInfo])

	// Pre-compute all transformed data to avoid calculations during render (memoized)
	const transformedSelections = useMemo(() => {
		return selectedInfoList.map((info) => {
			const transformedRect = transformRect(info.rect, iframeRef, isPptRender, scaleRatio)
			const transform = getSelectionBoxTransform(
				info.rotation ?? 0,
				isMultiSelect,
				rotation,
				displayRotation,
			)
			return {
				selector: info.selector,
				info,
				transformedRect,
				transform,
			}
		})
	}, [
		selectedInfoList,
		iframeRef,
		isPptRender,
		scaleRatio,
		isMultiSelect,
		rotation,
		displayRotation,
	])

	// Don't render when disabled (saving)
	if (disabled) {
		return null
	}

	// Get container element for rotation handle positioning
	// Note: Not memoized because refs don't trigger re-renders
	const containerElement =
		containerRef?.current ?? (overlayRef.current?.offsetParent as HTMLElement | null)

	// Always render the container, but only show highlights when there's data
	return (
		<div
			ref={overlayRef}
			className={cn("pointer-events-none", className)}
			style={{
				position: "fixed",
				inset: 0,
				overflow: "visible", // Allow highlights to extend beyond bounds if needed
				zIndex: HTML_EDITOR_Z_INDEX.BASE.SELECTION_OVERLAY_ROOT,
				display: shouldHide ? "none" : "block",
			}}
		>
			{/* Selected elements highlights */}
			<AnimatePresence mode="sync">
				{transformedSelections.map(({ selector, info, transformedRect, transform }) => (
					<SelectionBox
						key={selector}
						info={info}
						transformedRect={transformedRect}
						isMultiSelect={isMultiSelect}
						isSelectionMode={isSelectionMode}
						transform={transform}
						containerElement={containerElement}
						isMoving={isMoving}
						rotation={rotation}
						resizeHandles={resizeHandles}
						onMoveHandleMouseDown={onMoveHandleMouseDown}
						onRotateHandleMouseDown={onRotateHandleMouseDown}
						onResizeHandleMouseDown={onHandleMouseDown}
						onDelete={handleDelete}
						onDuplicate={handleDuplicate}
					/>
				))}
			</AnimatePresence>

			{/* Hovered element highlight */}
			{transformedHoveredRect && (
				<HoverBox rect={transformedHoveredRect} isSelectionMode={isSelectionMode} />
			)}
		</div>
	)
})
