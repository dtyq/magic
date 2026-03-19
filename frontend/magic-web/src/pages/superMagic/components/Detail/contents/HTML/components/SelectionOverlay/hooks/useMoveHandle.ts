import { useCallback, useEffect, useRef } from "react"
import type { Dispatch, RefObject, SetStateAction } from "react"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import type { ElementRect, SelectedInfo } from "../types"

interface UseMoveHandleOptions {
	editorRef?: RefObject<HTMLEditorV2Ref>
	isPptRender: boolean
	scaleRatio: number
	selectedInfo: SelectedInfo | null
	setSelectedInfo: Dispatch<SetStateAction<SelectedInfo | null>>
	setHoveredRect: Dispatch<SetStateAction<ElementRect | null>>
	setIsSelectionMode: Dispatch<SetStateAction<boolean>>
	iframeRef: RefObject<HTMLIFrameElement>
}

interface PointerCaptureState {
	pointerId: number
	target: HTMLElement
}

export function useMoveHandle({
	editorRef,
	isPptRender,
	scaleRatio,
	selectedInfo,
	setSelectedInfo,
	setHoveredRect,
	setIsSelectionMode,
	iframeRef,
}: UseMoveHandleOptions) {
	const selectedInfoRef = useRef<SelectedInfo | null>(null)
	const isMovingRef = useRef(false)
	const moveStartMouseRef = useRef<{ x: number; y: number } | null>(null)
	const moveStartRectRef = useRef<ElementRect | null>(null)
	const pendingMoveRef = useRef<{ selector: string; styles: Record<string, string> } | null>(null)
	const pointerCaptureRef = useRef<PointerCaptureState | null>(null)
	// Store initial position values (relative offsets)
	const initialPositionRef = useRef<{ top: number; left: number }>({ top: 0, left: 0 })
	// Store element's original bounding rect (before any top/left offsets applied)
	const elementOriginalRectRef = useRef<ElementRect | null>(null)

	const getScaleFactor = useCallback(() => {
		return isPptRender ? scaleRatio : 1
	}, [isPptRender, scaleRatio])

	/**
	 * Constrain element position to keep it within iframe bounds
	 * Ensures at least 20% of element or 50px (whichever is larger) remains visible
	 *
	 * For position:relative elements:
	 * - newLeft/newTop are relative offsets from original position
	 * - We need to calculate actual position and then constrain it
	 */
	const constrainToBounds = useCallback(
		(
			newLeft: number,
			newTop: number,
			elementWidth: number,
			elementHeight: number,
		): { left: number; top: number } => {
			if (!iframeRef.current || !elementOriginalRectRef.current) {
				return { left: newLeft, top: newTop }
			}

			const iframe = iframeRef.current
			const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
			if (!iframeDoc) return { left: newLeft, top: newTop }

			// Get iframe viewport dimensions
			// Note: clientWidth/Height gives the visible area (excluding scrollbars)
			const iframeWidth = iframeDoc.documentElement.clientWidth
			const iframeHeight = iframeDoc.documentElement.clientHeight

			// Calculate element's actual position after applying offsets
			// For position:relative, actual = original + offset
			// Note: All rect coordinates are relative to iframe viewport (from getBoundingClientRect)
			const originalRect = elementOriginalRectRef.current
			const actualLeft = originalRect.left + newLeft
			const actualTop = originalRect.top + newTop

			// Calculate minimum visible area (20% of element or 50px, whichever is larger)
			const minVisibleWidth = Math.max(elementWidth * 0.2, 50)
			const minVisibleHeight = Math.max(elementHeight * 0.2, 50)

			// Calculate bounds for actual position
			// Element can move from -80% width to 100% - 20% width
			const minActualLeft = -(elementWidth - minVisibleWidth)
			const maxActualLeft = iframeWidth - minVisibleWidth
			const minActualTop = -(elementHeight - minVisibleHeight)
			const maxActualTop = iframeHeight - minVisibleHeight

			// Constrain actual position
			const constrainedActualLeft = Math.max(
				minActualLeft,
				Math.min(maxActualLeft, actualLeft),
			)
			const constrainedActualTop = Math.max(minActualTop, Math.min(maxActualTop, actualTop))

			// Convert back to relative offset
			const constrainedOffsetLeft = constrainedActualLeft - originalRect.left
			const constrainedOffsetTop = constrainedActualTop - originalRect.top

			// Log constraint details when bounds are hit
			const wasConstrained =
				constrainedOffsetLeft !== newLeft || constrainedOffsetTop !== newTop
			if (wasConstrained) {
				console.log("[useMoveHandle] Boundary constraint applied:", {
					iframeSize: { width: iframeWidth, height: iframeHeight },
					elementSize: { width: elementWidth, height: elementHeight },
					originalRect,
					requestedOffset: { left: newLeft, top: newTop },
					actualPosition: { left: actualLeft, top: actualTop },
					bounds: {
						left: [minActualLeft, maxActualLeft],
						top: [minActualTop, maxActualTop],
					},
					constrainedPosition: {
						left: constrainedActualLeft,
						top: constrainedActualTop,
					},
					constrainedOffset: {
						left: constrainedOffsetLeft,
						top: constrainedOffsetTop,
					},
				})
			}

			return {
				left: constrainedOffsetLeft,
				top: constrainedOffsetTop,
			}
		},
		[iframeRef],
	)

	const scheduleMoveUpdate = useCallback(
		(selector: string, styles: Record<string, string>) => {
			// Always store the latest pending update
			pendingMoveRef.current = { selector, styles }

			if (!editorRef?.current) return

			// Apply styles immediately without RAF throttling to sync with border update
			// The border updates synchronously via setState, so iframe must update immediately too
			editorRef.current.applyStylesTemporary(selector, styles).catch((error) => {
				console.error("[useMoveHandle] Temporary move failed:", error)
			})
		},
		[editorRef],
	)

	const stopMove = useCallback(async () => {
		if (!isMovingRef.current) return

		const currentSelector = selectedInfoRef.current?.selector

		isMovingRef.current = false
		moveStartMouseRef.current = null
		moveStartRectRef.current = null
		elementOriginalRectRef.current = null

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

		// End batch operation with final state
		if (pendingMoveRef.current && editorRef?.current) {
			const { selector, styles } = pendingMoveRef.current

			// CRITICAL: Parse and update cache IMMEDIATELY (synchronously)
			// BEFORE any async operations, to prevent race conditions
			const parsePosition = (value: string | undefined): number => {
				if (!value) return 0
				const parsed = parseFloat(value)
				return isNaN(parsed) ? 0 : parsed
			}
			const newCachedTop = parsePosition(styles.top)
			const newCachedLeft = parsePosition(styles.left)

			// Update cache synchronously BEFORE async operations
			initialPositionRef.current = {
				top: newCachedTop,
				left: newCachedLeft,
			}

			console.log(
				"[useMoveHandle] Updated initial position for next move:",
				initialPositionRef.current,
			)

			// Now perform async operations (may fail, but cache is already updated)
			try {
				// Apply final styles temporarily first
				await editorRef.current.applyStylesTemporary(selector, styles)
				// Then end batch operation to record history
				await editorRef.current.endBatchOperation(selector, styles)
				console.log("[useMoveHandle] Move completed with position:", styles)
			} catch (error) {
				console.error("[useMoveHandle] Final move update failed:", error)
			}
			pendingMoveRef.current = null
		} else if (editorRef?.current) {
			// If no pending update, no movement occurred - cancel batch operation
			try {
				await editorRef.current.cancelBatchOperation()
				console.log("[useMoveHandle] Move cancelled - no movement detected")
			} catch (error) {
				console.error("[useMoveHandle] Failed to cancel batch operation:", error)
			}
		}

		// Restore document styles
		document.body.style.userSelect = ""
		document.body.style.cursor = ""

		// Refresh element rect and styles from iframe after move completes
		if (currentSelector && editorRef?.current) {
			try {
				// Trigger iframe to re-select element and send updated ELEMENT_SELECTED event
				await editorRef.current.refreshSelectedElement(currentSelector)
			} catch (error) {
				console.error("[useMoveHandle] Failed to refresh element after move:", error)
			}
		}
	}, [editorRef])

	// Monitor selectedInfo changes - stop moving if element changes
	useEffect(() => {
		// If selected element changed during move, stop moving
		if (
			isMovingRef.current &&
			selectedInfo &&
			selectedInfoRef.current &&
			selectedInfo.selector !== selectedInfoRef.current.selector
		) {
			stopMove()
		}

		// CRITICAL: Reset initialPositionRef when element changes to prevent position inheritance
		if (
			selectedInfo &&
			selectedInfoRef.current &&
			selectedInfo.selector !== selectedInfoRef.current.selector
		) {
			// Reset to ensure each element starts from its own position
			initialPositionRef.current = { top: 0, left: 0 }
			elementOriginalRectRef.current = null
			console.log("[useMoveHandle] Element changed - reset initial position cache")
		}

		selectedInfoRef.current = selectedInfo

		// If selected element is cleared, stop moving
		if (isMovingRef.current && !selectedInfo) {
			stopMove()
		}
	}, [selectedInfo, stopMove])

	const updateMove = useCallback(
		(event: globalThis.PointerEvent | globalThis.MouseEvent) => {
			if (!isMovingRef.current) return

			// Safety check: if no pointer/mouse buttons are pressed, stop moving
			if (event.buttons === 0) {
				stopMove()
				return
			}

			if (
				!selectedInfoRef.current ||
				!moveStartMouseRef.current ||
				!moveStartRectRef.current
			) {
				stopMove()
				return
			}

			const scaleFactor = getScaleFactor()
			const deltaX = (event.clientX - moveStartMouseRef.current.x) / scaleFactor
			const deltaY = (event.clientY - moveStartMouseRef.current.y) / scaleFactor

			// Calculate new position based on initial position + delta
			const rawNewLeft = initialPositionRef.current.left + deltaX
			const rawNewTop = initialPositionRef.current.top + deltaY

			// Apply boundary constraints to prevent element from moving completely out of view
			const { left: newLeft, top: newTop } = constrainToBounds(
				rawNewLeft,
				rawNewTop,
				moveStartRectRef.current.width,
				moveStartRectRef.current.height,
			)

			// Calculate constrained delta for UI update
			const constrainedDeltaX = newLeft - initialPositionRef.current.left
			const constrainedDeltaY = newTop - initialPositionRef.current.top

			// Immediately update UI for smooth feedback
			setSelectedInfo((prev) => {
				if (!prev) return prev
				return {
					...prev,
					rect: {
						...prev.rect,
						left: moveStartRectRef.current!.left + constrainedDeltaX,
						top: moveStartRectRef.current!.top + constrainedDeltaY,
					},
				}
			})

			// Apply style update to iframe immediately (no RAF throttling)
			scheduleMoveUpdate(selectedInfoRef.current.selector, {
				position: "relative",
				top: `${Math.round(newTop)}px`,
				left: `${Math.round(newLeft)}px`,
			})
		},
		[getScaleFactor, scheduleMoveUpdate, setSelectedInfo, stopMove, constrainToBounds],
	)

	const startMove = useCallback(
		async (event: React.PointerEvent) => {
			if (!selectedInfoRef.current) return

			event.preventDefault()
			event.stopPropagation()

			// Safety: If already moving, stop first to clean up state
			if (isMovingRef.current) {
				stopMove()
			}

			// Capture pointer to receive events even if mouse leaves element
			const target = event.currentTarget as HTMLElement
			try {
				target.setPointerCapture(event.pointerId)
				pointerCaptureRef.current = { pointerId: event.pointerId, target }
			} catch (error) {
				console.warn("[useMoveHandle] Failed to capture pointer:", error)
			}

			// Parse current position from computed styles
			const computedStyles = selectedInfoRef.current.computedStyles

			// Helper to determine if a position value is explicitly set (not auto/empty)
			const hasExplicitValue = (value: string | undefined): boolean => {
				return !!value && value !== "auto" && value !== ""
			}

			// Helper to parse position value
			const parsePosition = (value: string | undefined): number => {
				if (!value || value === "auto") return 0
				const parsed = parseFloat(value)
				return isNaN(parsed) ? 0 : parsed
			}

			// For top and left, prefer computed styles if they have explicit values
			// Otherwise fall back to cached position from previous move
			let currentTop: number
			let currentLeft: number

			if (hasExplicitValue(computedStyles.top)) {
				currentTop = parsePosition(computedStyles.top)
			} else {
				// Use cached value from previous move (if any)
				currentTop = initialPositionRef.current.top
			}

			if (hasExplicitValue(computedStyles.left)) {
				currentLeft = parsePosition(computedStyles.left)
			} else {
				// Use cached value from previous move (if any)
				currentLeft = initialPositionRef.current.left
			}

			console.log("[useMoveHandle] Start move - position resolution:", {
				computedTop: computedStyles.top,
				computedLeft: computedStyles.left,
				hasExplicitTop: hasExplicitValue(computedStyles.top),
				hasExplicitLeft: hasExplicitValue(computedStyles.left),
				cachedTop: initialPositionRef.current.top,
				cachedLeft: initialPositionRef.current.left,
				finalTop: currentTop,
				finalLeft: currentLeft,
			})

			// Store initial position for this drag operation
			initialPositionRef.current = { top: currentTop, left: currentLeft }

			// Calculate and store element's original rect (before any top/left offsets applied)
			// Original position = current position - current offset
			const currentRect = selectedInfoRef.current.rect
			elementOriginalRectRef.current = {
				top: currentRect.top - currentTop,
				left: currentRect.left - currentLeft,
				width: currentRect.width,
				height: currentRect.height,
			}

			console.log("[useMoveHandle] Element positions:", {
				currentRect,
				currentOffset: { top: currentTop, left: currentLeft },
				originalRect: elementOriginalRectRef.current,
			})

			// Start new move operation
			isMovingRef.current = true
			moveStartMouseRef.current = { x: event.clientX, y: event.clientY }
			moveStartRectRef.current = { ...selectedInfoRef.current.rect }

			// Begin batch operation - save initial state
			if (editorRef?.current) {
				try {
					await editorRef.current.beginBatchOperation(selectedInfoRef.current.selector, {
						position: "relative",
						top: `${Math.round(currentTop)}px`,
						left: `${Math.round(currentLeft)}px`,
					})
				} catch (error) {
					console.error("[useMoveHandle] Failed to begin batch operation:", error)
				}
			}

			// Clear hover state and ensure selection mode is active
			setHoveredRect(null)
			setIsSelectionMode(true)

			// Set document styles for move operation
			document.body.style.userSelect = "none"
			document.body.style.cursor = "grabbing"
		},
		[editorRef, setHoveredRect, setIsSelectionMode, stopMove],
	)

	useEffect(() => {
		const handlePointerMove = (event: globalThis.PointerEvent) => {
			if (isMovingRef.current) {
				// Prevent default to avoid text selection during drag
				event.preventDefault()
			}
			updateMove(event)
		}

		const handlePointerUp = (event: globalThis.PointerEvent) => {
			if (!isMovingRef.current) return
			event.preventDefault()
			stopMove()
		}

		// Listen on document with capture phase to ensure we get events first
		document.addEventListener("pointermove", handlePointerMove, {
			capture: true,
			passive: false,
		})
		document.addEventListener("pointerup", handlePointerUp, { capture: true, passive: false })
		document.addEventListener("pointercancel", handlePointerUp, {
			capture: true,
			passive: false,
		})
		// Handle window blur to stop moving when window loses focus
		window.addEventListener("blur", stopMove)

		return () => {
			document.removeEventListener("pointermove", handlePointerMove, true)
			document.removeEventListener("pointerup", handlePointerUp, true)
			document.removeEventListener("pointercancel", handlePointerUp, true)
			window.removeEventListener("blur", stopMove)
		}
	}, [stopMove, updateMove])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			stopMove()
		}
	}, [stopMove])

	return {
		onMoveHandleMouseDown: startMove,
		isMoving: isMovingRef.current,
	}
}
