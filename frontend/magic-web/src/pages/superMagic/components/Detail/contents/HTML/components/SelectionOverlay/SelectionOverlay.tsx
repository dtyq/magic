/**
 * Selection Overlay Component
 * Renders element selection and hover highlights in the parent window (not inside iframe)
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { cn } from "@/utils/cn"
import type { HTMLEditorV2Ref } from "../../iframe-bridge/types/props"
import { useStylePanelStore } from "../../iframe-bridge/contexts/StylePanelContext"
import type { ElementRect, SelectedInfo } from "./types"
import { HTML_EDITOR_Z_INDEX } from "../../constants/z-index"
import { useSelectionMessages } from "./hooks/useSelectionMessages"
import { useScrollSync } from "./hooks/useScrollSync"
import { useScaleSync } from "./hooks/useScaleSync"
import { useSelectionHandles } from "./hooks/useSelectionHandles"
import { offsetRect, transformRect, getSelectionBoxTransform } from "./utils/transform"
import { SelectionBox } from "./components/SelectionBox"
import { HoverBox } from "./components/HoverBox"

interface SelectionOverlayProps {
	/** 宿主视口改变但比例相同时，也需要重新计算 iframe 的位置。 */
	layoutKey?: string
	scrollContainerRef?: React.RefObject<HTMLElement>
	containerRef?: React.RefObject<HTMLElement>
	iframeRef: React.RefObject<HTMLIFrameElement>
	editorRef?: React.RefObject<HTMLEditorV2Ref>
	scaleRatio?: number
	isPptRender?: boolean
	disabled?: boolean
	/** Draw selection feedback without manipulation handles or edit shortcuts. */
	readOnly?: boolean
	className?: string
	onSelectedElementChange?: (rect: ElementRect | null) => void
	onSelectedElementViewportChange?: (rect: (ElementRect & { selector?: string }) | null) => void
	onElementMoveStart?: () => void
	onElementMoveEnd?: () => void
}

// observer already memos; wrapping memo() throws in mobx-react-lite 4
export const SelectionOverlay = observer(function SelectionOverlay({
	layoutKey,
	scrollContainerRef,
	containerRef,
	iframeRef,
	editorRef,
	scaleRatio = 1,
	isPptRender = false,
	disabled = false,
	readOnly = false,
	className,
	onSelectedElementChange,
	onSelectedElementViewportChange,
	onElementMoveStart,
	onElementMoveEnd,
}: SelectionOverlayProps) {
	const [selectedInfoList, setSelectedInfoList] = useState<SelectedInfo[]>([])
	const [hoveredRect, setHoveredRect] = useState<ElementRect | null>(null)
	const [isSelectionMode, setIsSelectionMode] = useState(false)
	const stylePanelStore = useStylePanelStore()
	const handlePreviewSize = useCallback(
		(size: { width: string; height: string }) => {
			stylePanelStore.updateComputedStyles(size)
		},
		[stylePanelStore],
	)
	const handlePreviewStyles = useCallback(
		(styles: Partial<{ rowGap: string; columnGap: string }>) => {
			stylePanelStore.updateComputedStyles(styles)
		},
		[stylePanelStore],
	)
	const [overlayViewportOrigin, setOverlayViewportOrigin] = useState({ top: 0, left: 0 })
	const overlayRef = useRef<HTMLDivElement>(null)

	// For backward compatibility - single selected element (memoized)
	const selectedInfo = useMemo(
		() => (selectedInfoList.length === 1 ? selectedInfoList[0] : null),
		[selectedInfoList],
	)
	const isMultiSelect = useMemo(() => selectedInfoList.length > 1, [selectedInfoList])

	// Notify parent component when selected element changes (with stable callback)
	const selectedRectRef = useRef<ElementRect | null>(null)
	const viewportRectRef = useRef<string>("")
	const selectedRect = useMemo(() => selectedInfo?.rect || null, [selectedInfo])

	useEffect(() => {
		// Only notify if rect actually changed to prevent unnecessary parent updates
		if (onSelectedElementChange || onSelectedElementViewportChange) {
			const viewportRect = selectedRect
				? transformRect(
						selectedRect,
						iframeRef,
						isPptRender,
						scaleRatio,
						selectedInfo?.selector,
					)
				: null
			if (onSelectedElementChange && selectedRectRef.current !== selectedRect) {
				selectedRectRef.current = selectedRect
				onSelectedElementChange(selectedRect)
			}
			const anchorKey = viewportRect
				? `${selectedInfo?.selector ?? ""}:${viewportRect.top}:${viewportRect.left}:${viewportRect.width}:${viewportRect.height}`
				: ""
			if (onSelectedElementViewportChange && viewportRectRef.current !== anchorKey) {
				viewportRectRef.current = anchorKey
				onSelectedElementViewportChange(
					viewportRect ? { ...viewportRect, selector: selectedInfo?.selector } : null,
				)
			}
		}
	}, [
		iframeRef,
		isPptRender,
		scaleRatio,
		selectedInfo?.selector,
		selectedRect,
		onSelectedElementChange,
		onSelectedElementViewportChange,
	])

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
		layoutKey,
		scaleRatio,
		isSelectionMode,
		selectedInfoList,
		hoveredRect,
		setSelectedInfoList,
		setHoveredRect,
	})

	// Hide selection boxes during scrolling or scaling
	const shouldHide = isScrolling || isScaling

	useLayoutEffect(() => {
		const updateOverlayViewportOrigin = () => {
			const overlayElement = overlayRef.current
			if (!overlayElement) return
			const overlayRect = overlayElement.getBoundingClientRect()
			setOverlayViewportOrigin((prev) => {
				if (prev.top === overlayRect.top && prev.left === overlayRect.left) return prev
				return { top: overlayRect.top, left: overlayRect.left }
			})
		}

		updateOverlayViewportOrigin()
		window.addEventListener("resize", updateOverlayViewportOrigin)
		window.addEventListener("scroll", updateOverlayViewportOrigin, true)

		let resizeObserver: ResizeObserver | null = null
		if (typeof ResizeObserver !== "undefined") {
			resizeObserver = new ResizeObserver(updateOverlayViewportOrigin)
			if (overlayRef.current) {
				resizeObserver.observe(overlayRef.current)
			}
			const offsetParent = overlayRef.current?.offsetParent
			if (offsetParent instanceof Element) {
				resizeObserver.observe(offsetParent)
			}
		}

		return () => {
			window.removeEventListener("resize", updateOverlayViewportOrigin)
			window.removeEventListener("scroll", updateOverlayViewportOrigin, true)
			resizeObserver?.disconnect()
		}
	}, [])

	// All selection handles (move, rotate, resize, delete, duplicate)
	const {
		onHandleMouseDown,
		resizeHandles,
		onRotateHandleMouseDown,
		rotation,
		onMoveHandleMouseDown,
		isMoving,
		gapHandles,
		isGapDragging,
		onGapHandlePointerDown,
		handleDelete,
		handleDuplicate,
		executeDelete,
		executeDuplicate,
	} = useSelectionHandles({
		editorRef,
		isPptRender,
		scaleRatio,
		selectedInfo,
		iframeRef,
		setSelectedInfoList,
		setHoveredRect,
		setIsSelectionMode,
		onMoveStart: onElementMoveStart,
		onMoveEnd: onElementMoveEnd,
		onPreviewSize: handlePreviewSize,
		gapAxesLinked: stylePanelStore.gapAxesLinked,
		onPreviewStyles: handlePreviewStyles,
	})
	const previewHoverRect = stylePanelStore.previewRect ?? hoveredRect

	// Transform hover rect (memoized)
	const transformedHoveredRect = useMemo(
		() =>
			previewHoverRect
				? transformRect(previewHoverRect, iframeRef, isPptRender, scaleRatio)
				: null,
		[previewHoverRect, iframeRef, isPptRender, scaleRatio],
	)
	const overlayHoveredRect = useMemo(
		() =>
			transformedHoveredRect
				? offsetRect(transformedHoveredRect, overlayViewportOrigin)
				: null,
		[overlayViewportOrigin, transformedHoveredRect],
	)

	// Calculate live rotation for display (memoized)
	const displayRotation = useMemo(() => selectedInfo?.rotation ?? 0, [selectedInfo])

	// Pre-compute all transformed data to avoid calculations during render (memoized)
	const transformedSelections = useMemo(() => {
		return selectedInfoList.map((info) => {
			const transformedRect = transformRect(
				info.rect,
				iframeRef,
				isPptRender,
				scaleRatio,
				info.selector,
			)
			const transform = getSelectionBoxTransform(
				info.rotation ?? 0,
				isMultiSelect,
				rotation,
				displayRotation,
			)
			return {
				selector: info.selector,
				viewportRect: transformedRect,
				transformedRect: offsetRect(transformedRect, overlayViewportOrigin),
				transform,
			}
		})
	}, [
		selectedInfoList,
		iframeRef,
		isPptRender,
		scaleRatio,
		isMultiSelect,
		overlayViewportOrigin,
		rotation,
		displayRotation,
	])

	useEffect(() => {
		if (!isSelectionMode || !selectedInfo || disabled || readOnly) {
			return
		}

		const isEditableTarget = (target: EventTarget | null): boolean => {
			// Parent fallback shortcuts should never steal keystrokes from form or text editing fields.
			if (!(target instanceof HTMLElement)) {
				return false
			}

			const tagName = target.tagName.toLowerCase()
			const isFormField =
				tagName === "input" || tagName === "textarea" || tagName === "select"
			const isRuntimeTextEditing =
				target.getAttribute("data-text-editing") === "true" ||
				target.closest('[data-text-editing="true"]') !== null
			const isNativeEditable =
				target.isContentEditable || target.closest('[contenteditable="true"]') !== null

			return isFormField || isRuntimeTextEditing || isNativeEditable
		}

		const handleShortcut = (event: KeyboardEvent) => {
			// Scope fallback shortcuts to the editor container so global page shortcuts stay intact.
			if (
				event.target instanceof HTMLElement &&
				containerRef?.current &&
				!containerRef.current.contains(event.target)
			) {
				return
			}

			if (isEditableTarget(event.target)) {
				return
			}

			const isDeleteKey = event.key === "Delete" || event.key === "Backspace"
			const isDuplicateKey =
				(event.metaKey || event.ctrlKey) &&
				event.key.toLowerCase() === "d" &&
				!event.altKey &&
				!event.shiftKey

			if (!isDeleteKey && !isDuplicateKey) {
				return
			}

			event.preventDefault()
			event.stopPropagation()

			if (isDeleteKey) {
				void executeDelete()
				return
			}

			void executeDuplicate()
		}

		window.addEventListener("keydown", handleShortcut, true)

		return () => {
			window.removeEventListener("keydown", handleShortcut, true)
		}
	}, [
		containerRef,
		disabled,
		readOnly,
		executeDelete,
		executeDuplicate,
		isSelectionMode,
		selectedInfo,
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
			data-html-selection-overlay="true"
			data-testid="html-editor-selection-overlay"
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
			{transformedSelections.map(({ selector, viewportRect, transformedRect, transform }) => (
				<SelectionBox
					key={selector}
					transformedRect={transformedRect}
					viewportRect={viewportRect}
					isMultiSelect={isMultiSelect}
					isSelectionMode={isSelectionMode && !readOnly}
					transform={transform}
					containerElement={containerElement}
					isMoving={isMoving}
					rotation={rotation}
					resizeHandles={resizeHandles}
					onMoveHandleMouseDown={onMoveHandleMouseDown}
					onRotateHandleMouseDown={onRotateHandleMouseDown}
					onResizeHandleMouseDown={onHandleMouseDown}
					gapHandles={gapHandles}
					onGapHandlePointerDown={onGapHandlePointerDown}
					isGapDragging={isGapDragging}
					onDelete={handleDelete}
					onDuplicate={handleDuplicate}
				/>
			))}

			{/* Hovered element highlight */}
			{overlayHoveredRect && (
				<HoverBox rect={overlayHoveredRect} isSelectionMode={isSelectionMode} />
			)}
		</div>
	)
})
