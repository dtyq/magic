import { useCallback, useEffect, useMemo, useRef } from "react"
import type { Dispatch, RefObject, SetStateAction } from "react"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import type { ElementRect, ResizeHandleConfig, SelectedInfo } from "../types"

interface UseResizeHandlesOptions {
	editorRef?: RefObject<HTMLEditorV2Ref>
	isPptRender: boolean
	scaleRatio: number
	selectedInfo: SelectedInfo | null
	setSelectedInfo: Dispatch<SetStateAction<SelectedInfo | null>>
	setHoveredRect: Dispatch<SetStateAction<ElementRect | null>>
	setIsSelectionMode: Dispatch<SetStateAction<boolean>>
}

interface PointerCaptureState {
	pointerId: number
	target: HTMLElement
}

export function useResizeHandles({
	editorRef,
	isPptRender,
	scaleRatio,
	selectedInfo,
	setSelectedInfo,
	setHoveredRect,
	setIsSelectionMode,
}: UseResizeHandlesOptions) {
	const selectedInfoRef = useRef<SelectedInfo | null>(null)
	const isResizingRef = useRef(false)
	const resizeHandleRef = useRef<ResizeHandleConfig | null>(null)
	const resizeStartMouseRef = useRef<{ x: number; y: number } | null>(null)
	const resizeStartRectRef = useRef<ElementRect | null>(null)
	const resizeRafRef = useRef<number | null>(null)
	const pendingResizeRef = useRef<{ selector: string; styles: Record<string, string> } | null>(
		null,
	)
	const pointerCaptureRef = useRef<PointerCaptureState | null>(null)

	const getScaleFactor = useCallback(() => {
		return isPptRender ? scaleRatio : 1
	}, [isPptRender, scaleRatio])

	const scheduleResizeUpdate = useCallback(
		(selector: string, styles: Record<string, string>) => {
			// Always store the latest pending update (don't clear it in RAF)
			pendingResizeRef.current = { selector, styles }

			if (resizeRafRef.current) return

			resizeRafRef.current = window.requestAnimationFrame(() => {
				const pending = pendingResizeRef.current
				resizeRafRef.current = null

				if (!pending) return
				if (!editorRef?.current) return

				// Use temporary style application (no history recording during drag)
				// Note: Don't clear pendingResizeRef here - we need it in stopResize
				editorRef.current
					.applyStylesTemporary(pending.selector, pending.styles)
					.catch((error) => {
						console.error("[SelectionOverlay] Temporary resize failed:", error)
					})
			})
		},
		[editorRef],
	)

	const stopResize = useCallback(async () => {
		if (!isResizingRef.current) return

		const currentSelector = selectedInfoRef.current?.selector

		isResizingRef.current = false
		resizeHandleRef.current = null
		resizeStartMouseRef.current = null
		resizeStartRectRef.current = null

		// Release pointer capture
		if (pointerCaptureRef.current) {
			try {
				pointerCaptureRef.current.target.releasePointerCapture(
					pointerCaptureRef.current.pointerId,
				)
			} catch (error) {
				// Ignore errors if pointer capture was already released
			}
			pointerCaptureRef.current = null
		}

		// Wait for any pending RAF updates to complete
		if (resizeRafRef.current) {
			window.cancelAnimationFrame(resizeRafRef.current)
			resizeRafRef.current = null
		}

		// End batch operation with final state
		if (pendingResizeRef.current && editorRef?.current) {
			const { selector, styles } = pendingResizeRef.current
			try {
				// Apply final styles temporarily first
				await editorRef.current.applyStylesTemporary(selector, styles)
				// Then end batch operation to record history
				await editorRef.current.endBatchOperation(selector, styles)
				console.log("[useResizeHandles] Resize completed with size:", styles)
			} catch (error) {
				console.error("[useResizeHandles] Final resize update failed:", error)
			}
			pendingResizeRef.current = null
		} else if (editorRef?.current) {
			// If no pending update, no resize occurred - cancel batch operation
			try {
				await editorRef.current.cancelBatchOperation()
				console.log("[useResizeHandles] Resize cancelled - no size change detected")
			} catch (error) {
				console.error("[useResizeHandles] Failed to cancel batch operation:", error)
			}
		}

		// Restore document styles
		document.body.style.userSelect = ""
		document.body.style.cursor = ""

		// Refresh element rect and styles from iframe after resize completes
		if (currentSelector && editorRef?.current) {
			try {
				// Trigger iframe to re-select element and send updated ELEMENT_SELECTED event
				await editorRef.current.refreshSelectedElement(currentSelector)
			} catch (error) {
				console.error("[useResizeHandles] Failed to refresh element after resize:", error)
			}
		}
	}, [editorRef])

	useEffect(() => {
		// If selected element changed during resize, stop resizing
		if (
			isResizingRef.current &&
			selectedInfo &&
			selectedInfoRef.current &&
			selectedInfo.selector !== selectedInfoRef.current.selector
		) {
			stopResize()
		}

		selectedInfoRef.current = selectedInfo

		// If selected element is cleared, stop resizing
		if (isResizingRef.current && !selectedInfo) {
			stopResize()
		}
	}, [selectedInfo, stopResize])

	const updateResize = useCallback(
		(event: globalThis.PointerEvent | globalThis.MouseEvent) => {
			if (!isResizingRef.current) return

			// Safety check: if no pointer/mouse buttons are pressed, stop resizing
			// This handles edge cases where pointerup/mouseup wasn't captured
			if (event.buttons === 0) {
				stopResize()
				return
			}

			if (
				!selectedInfoRef.current ||
				!resizeHandleRef.current ||
				!resizeStartMouseRef.current ||
				!resizeStartRectRef.current
			) {
				stopResize()
				return
			}

			const scaleFactor = getScaleFactor()
			const deltaX = (event.clientX - resizeStartMouseRef.current.x) / scaleFactor
			const deltaY = (event.clientY - resizeStartMouseRef.current.y) / scaleFactor
			const minSize = 8
			const startRect = resizeStartRectRef.current

			const nextWidth =
				resizeHandleRef.current.directionX > 0
					? Math.max(startRect.width + deltaX, minSize)
					: startRect.width
			const nextHeight =
				resizeHandleRef.current.directionY > 0
					? Math.max(startRect.height + deltaY, minSize)
					: startRect.height

			// Immediately update UI for smooth feedback
			setSelectedInfo((prev) => {
				if (!prev) return prev
				return {
					...prev,
					rect: {
						...prev.rect,
						width: nextWidth,
						height: nextHeight,
					},
				}
			})

			// Schedule batch style update to iframe
			scheduleResizeUpdate(selectedInfoRef.current.selector, {
				width: `${Math.round(nextWidth)}px`,
				height: `${Math.round(nextHeight)}px`,
			})
		},
		[getScaleFactor, scheduleResizeUpdate, setSelectedInfo, stopResize],
	)

	const startResize = useCallback(
		async (event: React.PointerEvent, handle: ResizeHandleConfig) => {
			if (!selectedInfoRef.current) return

			event.preventDefault()
			event.stopPropagation()

			// Safety: If already resizing, stop first to clean up state
			if (isResizingRef.current) {
				stopResize()
			}

			// Capture pointer to receive events even if mouse leaves element
			const target = event.currentTarget as HTMLElement
			try {
				target.setPointerCapture(event.pointerId)
				pointerCaptureRef.current = { pointerId: event.pointerId, target }
			} catch (error) {
				console.warn("[useResizeHandles] Failed to capture pointer:", error)
			}

			// Start new resize operation
			isResizingRef.current = true
			resizeHandleRef.current = handle
			resizeStartMouseRef.current = { x: event.clientX, y: event.clientY }
			resizeStartRectRef.current = { ...selectedInfoRef.current.rect }

			// Begin batch operation - save initial state
			if (editorRef?.current) {
				try {
					await editorRef.current.beginBatchOperation(selectedInfoRef.current.selector, {
						width: `${Math.round(selectedInfoRef.current.rect.width)}px`,
						height: `${Math.round(selectedInfoRef.current.rect.height)}px`,
					})
				} catch (error) {
					console.error("[useResizeHandles] Failed to begin batch operation:", error)
				}
			}

			// Clear hover state and ensure selection mode is active
			setHoveredRect(null)
			setIsSelectionMode(true)

			// Set document styles for resize operation
			document.body.style.userSelect = "none"
			document.body.style.cursor = handle.cursor
		},
		[editorRef, setHoveredRect, setIsSelectionMode, stopResize],
	)

	useEffect(() => {
		const handlePointerMove = (event: globalThis.PointerEvent) => {
			if (isResizingRef.current) {
				// Prevent default to avoid text selection during drag
				event.preventDefault()
			}
			updateResize(event)
		}

		const handlePointerUp = (event: globalThis.PointerEvent) => {
			if (!isResizingRef.current) return
			event.preventDefault()
			stopResize()
		}

		// Listen on document with capture phase to ensure we get events first
		// This prevents child elements from blocking our drag operation
		document.addEventListener("pointermove", handlePointerMove, {
			capture: true,
			passive: false,
		})
		document.addEventListener("pointerup", handlePointerUp, { capture: true, passive: false })
		document.addEventListener("pointercancel", handlePointerUp, {
			capture: true,
			passive: false,
		})
		// Handle window blur to stop resizing when window loses focus
		window.addEventListener("blur", stopResize)

		return () => {
			document.removeEventListener("pointermove", handlePointerMove, true)
			document.removeEventListener("pointerup", handlePointerUp, true)
			document.removeEventListener("pointercancel", handlePointerUp, true)
			window.removeEventListener("blur", stopResize)
			if (resizeRafRef.current) {
				window.cancelAnimationFrame(resizeRafRef.current)
			}
		}
	}, [stopResize, updateResize])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (isResizingRef.current) {
				isResizingRef.current = false
				resizeHandleRef.current = null
				resizeStartMouseRef.current = null
				resizeStartRectRef.current = null

				// Release pointer capture
				if (pointerCaptureRef.current) {
					try {
						pointerCaptureRef.current.target.releasePointerCapture(
							pointerCaptureRef.current.pointerId,
						)
					} catch (error) {
						// Ignore errors
					}
					pointerCaptureRef.current = null
				}

				// Cancel any pending RAF
				if (resizeRafRef.current) {
					window.cancelAnimationFrame(resizeRafRef.current)
					resizeRafRef.current = null
				}

				// Clear pending resize update
				pendingResizeRef.current = null

				// Restore document styles
				document.body.style.userSelect = ""
				document.body.style.cursor = ""
			}
		}
	}, [])

	const resizeHandles = useMemo<ResizeHandleConfig[]>(
		() => [
			{
				id: "right",
				cursor: "e-resize",
				directionX: 1,
				directionY: 0,
				style: {
					top: "50%",
					right: -2,
					transform: "translate(50%, -50%)",
				},
			},
			{
				id: "bottom",
				cursor: "s-resize",
				directionX: 0,
				directionY: 1,
				style: {
					left: "50%",
					bottom: -2,
					transform: "translate(-50%, 50%)",
				},
			},
			{
				id: "bottom-right",
				cursor: "se-resize",
				directionX: 1,
				directionY: 1,
				style: {
					right: -2,
					bottom: -2,
					transform: "translate(50%, 50%)",
				},
			},
		],
		[],
	)

	return {
		onHandleMouseDown: startResize,
		resizeHandles,
	}
}
