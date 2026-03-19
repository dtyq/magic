import { useCallback, useRef } from "react"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import type { SelectedInfo } from "../types"
import { useResizeHandles } from "./useResizeHandles"
import { useRotateHandle } from "./useRotateHandle"
import { useMoveHandle } from "./useMoveHandle"

interface UseSelectionHandlesProps {
	editorRef?: React.RefObject<HTMLEditorV2Ref>
	isPptRender: boolean
	scaleRatio: number
	selectedInfo: SelectedInfo | null
	iframeRef: React.RefObject<HTMLIFrameElement>
	setSelectedInfoList: React.Dispatch<React.SetStateAction<SelectedInfo[]>>
	setHoveredRect: React.Dispatch<React.SetStateAction<any>>
	setIsSelectionMode: React.Dispatch<React.SetStateAction<boolean>>
}

/**
 * Unified hook for all selection handles (move, rotate, resize)
 * Adapts multi-select state to single-select hooks
 */
export function useSelectionHandles({
	editorRef,
	isPptRender,
	scaleRatio,
	selectedInfo,
	iframeRef,
	setSelectedInfoList,
	setHoveredRect,
	setIsSelectionMode,
}: UseSelectionHandlesProps) {
	// Adapter function to convert between single and multi-select state
	const createStateAdapter = useCallback(
		(
			infoOrUpdater:
				| SelectedInfo
				| null
				| ((prev: SelectedInfo | null) => SelectedInfo | null),
		) => {
			if (typeof infoOrUpdater === "function") {
				setSelectedInfoList((prev) => {
					const currentInfo = prev.length === 1 ? prev[0] : null
					const newInfo = infoOrUpdater(currentInfo)
					return newInfo ? [newInfo] : []
				})
			} else {
				setSelectedInfoList(infoOrUpdater ? [infoOrUpdater] : [])
			}
		},
		[setSelectedInfoList],
	)

	// Hooks only work in single-select mode
	const { onHandleMouseDown, resizeHandles } = useResizeHandles({
		editorRef,
		isPptRender,
		scaleRatio,
		selectedInfo,
		setSelectedInfo: createStateAdapter,
		setHoveredRect,
		setIsSelectionMode,
	})

	const { onRotateHandleMouseDown, rotation } = useRotateHandle({
		editorRef,
		isPptRender,
		scaleRatio,
		selectedInfo,
		setSelectedInfo: createStateAdapter,
		setHoveredRect,
		setIsSelectionMode,
	})

	const { onMoveHandleMouseDown, isMoving } = useMoveHandle({
		editorRef,
		isPptRender,
		scaleRatio,
		selectedInfo,
		setSelectedInfo: createStateAdapter,
		setHoveredRect,
		setIsSelectionMode,
		iframeRef,
	})

	// Refs to prevent duplicate operations
	const isDeleteInProgressRef = useRef(false)
	const isDuplicateInProgressRef = useRef(false)

	// Handle delete button click
	const handleDelete = useCallback(
		async (event: React.PointerEvent) => {
			event.stopPropagation()
			event.preventDefault()

			// Prevent duplicate delete operations
			if (isDeleteInProgressRef.current) {
				console.log("[SelectionOverlay] Delete already in progress, ignoring")
				return
			}

			console.log("[SelectionOverlay] Delete button clicked", {
				hasSelectedInfo: !!selectedInfo,
				selector: selectedInfo?.selector,
				hasEditorRef: !!editorRef?.current,
			})

			if (!selectedInfo?.selector) {
				console.warn("[SelectionOverlay] No selected element")
				return
			}

			if (!editorRef?.current) {
				console.warn("[SelectionOverlay] No editor ref")
				return
			}

			try {
				isDeleteInProgressRef.current = true
				console.log(
					"[SelectionOverlay] Calling deleteElement with selector:",
					selectedInfo.selector,
				)
				await editorRef.current.deleteElement(selectedInfo.selector)
				console.log("[SelectionOverlay] Element deleted successfully")
				// Selection will be cleared automatically by the runtime
			} catch (error) {
				console.error("[SelectionOverlay] Failed to delete element:", error)
			} finally {
				// Reset flag after operation completes
				setTimeout(() => {
					isDeleteInProgressRef.current = false
				}, 300)
			}
		},
		[selectedInfo, editorRef],
	)

	// Handle duplicate button click
	const handleDuplicate = useCallback(
		async (event: React.PointerEvent) => {
			event.stopPropagation()
			event.preventDefault()

			// Prevent duplicate duplicate operations
			if (isDuplicateInProgressRef.current) {
				console.log("[SelectionOverlay] Duplicate already in progress, ignoring")
				return
			}

			console.log("[SelectionOverlay] Duplicate button clicked", {
				hasSelectedInfo: !!selectedInfo,
				selector: selectedInfo?.selector,
				hasEditorRef: !!editorRef?.current,
			})

			if (!selectedInfo?.selector) {
				console.warn("[SelectionOverlay] No selected element")
				return
			}

			if (!editorRef?.current) {
				console.warn("[SelectionOverlay] No editor ref")
				return
			}

			try {
				isDuplicateInProgressRef.current = true
				console.log(
					"[SelectionOverlay] Calling duplicateElement with selector:",
					selectedInfo.selector,
				)
				await editorRef.current.duplicateElement(selectedInfo.selector)
				console.log("[SelectionOverlay] Element duplicated successfully")
				// New element will be automatically selected by the runtime
			} catch (error) {
				console.error("[SelectionOverlay] Failed to duplicate element:", error)
			} finally {
				// Reset flag after operation completes
				setTimeout(() => {
					isDuplicateInProgressRef.current = false
				}, 300)
			}
		},
		[selectedInfo, editorRef],
	)

	return {
		// Resize
		onHandleMouseDown,
		resizeHandles,
		// Rotate
		onRotateHandleMouseDown,
		rotation,
		// Move
		onMoveHandleMouseDown,
		isMoving,
		// Operations
		handleDelete,
		handleDuplicate,
	}
}
