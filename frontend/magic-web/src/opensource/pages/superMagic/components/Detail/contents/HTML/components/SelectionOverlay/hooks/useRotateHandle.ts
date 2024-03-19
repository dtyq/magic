import { useCallback, useEffect, useRef, useState } from "react"
import type { Dispatch, RefObject, SetStateAction } from "react"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import type { ElementRect, SelectedInfo } from "../types"

interface UseRotateHandleOptions {
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

export function useRotateHandle({
	editorRef,
	isPptRender,
	scaleRatio,
	selectedInfo,
	setSelectedInfo,
	setHoveredRect,
	setIsSelectionMode,
}: UseRotateHandleOptions) {
	const [rotation, setRotation] = useState(0)
	const rotationRef = useRef<number>(0)
	const selectedInfoRef = useRef<SelectedInfo | null>(null)
	const isRotatingRef = useRef(false)
	const rotateStartAngleRef = useRef<number>(0)
	const initialRotationRef = useRef<number>(0)
	const elementCenterRef = useRef<{ x: number; y: number } | null>(null)
	const rotateRafRef = useRef<number | null>(null)
	const pendingRotateRef = useRef<{ selector: string; styles: Record<string, string> } | null>(
		null,
	)
	const pointerCaptureRef = useRef<PointerCaptureState | null>(null)
	// Store rotation state for multiple elements (key: selector, value: rotation)
	const elementRotationsRef = useRef<Map<string, number>>(new Map())

	// Keep rotation ref in sync with rotation state
	useEffect(() => {
		rotationRef.current = rotation
	}, [rotation])

	const getScaleFactor = useCallback(() => {
		return isPptRender ? scaleRatio : 1
	}, [isPptRender, scaleRatio])

	const extractRotationFromTransform = useCallback((transformValue: string): number => {
		if (!transformValue || transformValue === "none") return 0

		// First try to match rotate() in transform
		const rotateMatch = transformValue.match(/rotate\(([^)]+)\)/)
		if (rotateMatch) {
			const rotateValue = rotateMatch[1]
			// Parse rotation value (supports deg, rad, turn)
			let extracted = 0
			if (rotateValue.includes("deg")) {
				extracted = parseFloat(rotateValue)
			} else if (rotateValue.includes("rad")) {
				extracted = (parseFloat(rotateValue) * 180) / Math.PI
			} else if (rotateValue.includes("turn")) {
				extracted = parseFloat(rotateValue) * 360
			} else {
				extracted = parseFloat(rotateValue) // Assume degrees if no unit
			}
			return extracted
		}

		// If no rotate() found, try to extract from matrix
		// 2D rotation matrix: matrix(cos(θ), sin(θ), -sin(θ), cos(θ), tx, ty)
		const matrixMatch = transformValue.match(/matrix\(([^)]+)\)/)
		if (matrixMatch) {
			const values = matrixMatch[1].split(",").map((v) => parseFloat(v.trim()))
			if (values.length >= 4) {
				const [a, b] = values
				// Extract angle from matrix: θ = atan2(b, a)
				const angleRad = Math.atan2(b, a)
				const angleDeg = (angleRad * 180) / Math.PI
				return angleDeg
			}
		}

		return 0
	}, [])

	// Extract current rotation from selected element
	useEffect(() => {
		// Skip rotation sync during active rotation to prevent interference
		if (isRotatingRef.current) {
			return
		}

		if (selectedInfo) {
			// Priority order for rotation value:
			// 1. If we have a saved continuous rotation for this element, use it
			// 2. Otherwise use selectedInfo.rotation if provided
			// 3. Finally extract from transform
			let currentRotation: number
			const extractedRotation = extractRotationFromTransform(
				selectedInfo.computedStyles?.transform || "none",
			)

			const savedRotation = elementRotationsRef.current.get(selectedInfo.selector)
			if (savedRotation !== undefined) {
				// Use saved continuous rotation to prevent jumps after refresh
				currentRotation = savedRotation

				// Update selectedInfo with the continuous rotation value
				// This ensures startRotate reads the correct initial rotation
				if (selectedInfo.rotation !== currentRotation) {
					setSelectedInfo((prev) => {
						if (!prev || prev.selector !== selectedInfo.selector) return prev
						return {
							...prev,
							rotation: currentRotation,
						}
					})
				}
			} else {
				// No saved rotation for this element
				const providedRotation = selectedInfo.rotation

				// Auto-detect continuous rotation:
				// If selectedInfo.rotation is provided and significantly different from extracted rotation,
				// it likely means this is a continuous rotation value that we should preserve
				if (
					providedRotation !== undefined &&
					providedRotation !== null &&
					Math.abs(providedRotation - extractedRotation) > 180
				) {
					// This looks like a continuous rotation value (e.g., 370deg vs extracted 10deg)
					// Save it to preserve continuity across refresh
					elementRotationsRef.current.set(selectedInfo.selector, providedRotation)
					currentRotation = providedRotation
				} else {
					// Use provided rotation or extract from transform
					currentRotation = providedRotation ?? extractedRotation
				}
			}

			setRotation(currentRotation)
		}
	}, [selectedInfo, extractRotationFromTransform, setSelectedInfo])

	const scheduleRotateUpdate = useCallback(
		(selector: string, styles: Record<string, string>) => {
			// Always store the latest pending update (don't clear it in RAF)
			pendingRotateRef.current = { selector, styles }

			if (rotateRafRef.current) return

			rotateRafRef.current = window.requestAnimationFrame(() => {
				const pending = pendingRotateRef.current
				rotateRafRef.current = null

				if (!pending) return
				if (!editorRef?.current) return

				// Use temporary style application (no history recording during drag)
				// Note: Don't clear pendingRotateRef here - we need it in stopRotate
				editorRef.current
					.applyStylesTemporary(pending.selector, pending.styles)
					.catch((error) => {
						console.error("[SelectionOverlay] Temporary rotate failed:", error)
					})
			})
		},
		[editorRef],
	)

	const stopRotate = useCallback(async () => {
		if (!isRotatingRef.current) return

		const currentSelector = selectedInfoRef.current?.selector
		const finalRotation = rotationRef.current

		// Save rotation value for this element to preserve continuity across element switches
		if (currentSelector) {
			elementRotationsRef.current.set(currentSelector, finalRotation)
		}

		// Update selectedInfo with final rotation to maintain continuity
		if (selectedInfoRef.current) {
			setSelectedInfo((prev) => {
				if (!prev) return prev
				return {
					...prev,
					rotation: finalRotation,
				}
			})
		}

		isRotatingRef.current = false
		rotateStartAngleRef.current = 0
		initialRotationRef.current = 0
		elementCenterRef.current = null

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
		if (rotateRafRef.current) {
			window.cancelAnimationFrame(rotateRafRef.current)
			rotateRafRef.current = null
		}

		// End batch operation with final state
		if (pendingRotateRef.current && editorRef?.current) {
			const { selector, styles } = pendingRotateRef.current
			try {
				// Apply final styles temporarily first
				await editorRef.current.applyStylesTemporary(selector, styles)
				// Then end batch operation to record history
				await editorRef.current.endBatchOperation(selector, styles)
				console.log("[useRotateHandle] Rotate completed with transform:", styles)
			} catch (error) {
				console.error("[useRotateHandle] Final rotate update failed:", error)
			}
			pendingRotateRef.current = null
		} else if (editorRef?.current) {
			// If no pending update, no rotation occurred - cancel batch operation
			try {
				await editorRef.current.cancelBatchOperation()
				console.log("[useRotateHandle] Rotate cancelled - no rotation detected")
			} catch (error) {
				console.error("[useRotateHandle] Failed to cancel batch operation:", error)
			}
		}

		// Restore document styles and pointer events
		document.body.style.userSelect = ""
		document.body.style.cursor = ""
		document.body.style.pointerEvents = ""

		// Refresh element rect and styles from iframe after rotation completes
		if (currentSelector && editorRef?.current) {
			try {
				// Trigger iframe to re-select element and send updated ELEMENT_SELECTED event
				await editorRef.current.refreshSelectedElement(currentSelector)
			} catch (error) {
				console.error("[useRotateHandle] Failed to refresh element after rotate:", error)
			}
		}
	}, [setSelectedInfo, editorRef])

	useEffect(() => {
		// If selected element changed during rotation, stop rotating
		if (
			isRotatingRef.current &&
			selectedInfo &&
			selectedInfoRef.current &&
			selectedInfo.selector !== selectedInfoRef.current.selector
		) {
			stopRotate()
		}

		selectedInfoRef.current = selectedInfo

		// If selected element is cleared, stop rotating
		if (isRotatingRef.current && !selectedInfo) {
			stopRotate()
		}
	}, [selectedInfo, stopRotate])

	const calculateAngle = useCallback((clientX: number, clientY: number): number => {
		if (!elementCenterRef.current) return 0

		const deltaX = clientX - elementCenterRef.current.x
		const deltaY = clientY - elementCenterRef.current.y

		// Calculate angle in degrees (0deg is at 12 o'clock position)
		const angleRad = Math.atan2(deltaX, -deltaY)
		const angleDeg = (angleRad * 180) / Math.PI
		return angleDeg
	}, [])

	const updateRotate = useCallback(
		(event: globalThis.PointerEvent | globalThis.MouseEvent) => {
			if (!isRotatingRef.current) return

			// Prevent event from reaching other elements
			event.preventDefault()
			event.stopPropagation()

			// Safety check: if no pointer/mouse buttons are pressed, stop rotating
			if (event.buttons === 0) {
				stopRotate()
				return
			}

			if (!selectedInfoRef.current || !elementCenterRef.current) {
				stopRotate()
				return
			}

			const currentAngle = calculateAngle(event.clientX, event.clientY)
			const angleDelta = currentAngle - rotateStartAngleRef.current
			let newRotation = initialRotationRef.current + angleDelta

			// Snap to 15-degree increments if Shift key is pressed
			if (event.shiftKey) {
				newRotation = Math.round(newRotation / 15) * 15
			}

			// Keep rotation continuous (don't normalize to 0-360)
			// This prevents CSS transitions from "spinning a full circle"
			// when crossing the 360° boundary

			// Update rotation state for UI feedback
			setRotation(newRotation)

			// Optimistic update: immediately update selectedInfo with new rotation
			// This allows the selection overlay to update in real-time without waiting for iframe response
			setSelectedInfo((prev) => {
				if (!prev) return prev
				return {
					...prev,
					rotation: newRotation,
				}
			})

			// Get existing transform and replace/add rotation
			const currentTransform = selectedInfoRef.current.computedStyles?.transform || "none"
			let newTransform: string

			if (currentTransform === "none" || !currentTransform) {
				newTransform = `rotate(${newRotation}deg)`
			} else if (currentTransform.includes("matrix(")) {
				// If transform is a matrix, replace the matrix with a new rotated matrix
				// Convert angle to radians
				const angleRad = (newRotation * Math.PI) / 180
				const cos = Math.cos(angleRad)
				const sin = Math.sin(angleRad)
				// Replace matrix with new rotation matrix
				newTransform = currentTransform.replace(
					/matrix\([^)]+\)/,
					`matrix(${cos}, ${sin}, ${-sin}, ${cos}, 0, 0)`,
				)
			} else {
				// Replace existing rotate() or append if not exists
				if (currentTransform.includes("rotate(")) {
					newTransform = currentTransform.replace(
						/rotate\([^)]+\)/,
						`rotate(${newRotation}deg)`,
					)
				} else {
					newTransform = `${currentTransform} rotate(${newRotation}deg)`
				}
			}

			// Schedule batch style update to iframe
			scheduleRotateUpdate(selectedInfoRef.current.selector, {
				transform: newTransform,
			})
		},
		[calculateAngle, scheduleRotateUpdate, stopRotate],
	)

	const startRotate = useCallback(
		async (
			event: React.PointerEvent,
			rect: ElementRect,
			containerElement: HTMLElement | null,
		) => {
			if (!selectedInfoRef.current) return

			event.preventDefault()
			event.stopPropagation()

			// Safety: If already rotating, stop first to clean up state
			if (isRotatingRef.current) {
				stopRotate()
			}

			// Capture pointer to receive events even if mouse leaves element
			const target = event.currentTarget as HTMLElement
			try {
				target.setPointerCapture(event.pointerId)
				pointerCaptureRef.current = { pointerId: event.pointerId, target }
			} catch (error) {
				console.warn("[useRotateHandle] Failed to capture pointer:", error)
			}

			// Calculate element center in viewport coordinates
			// Note: rect is already in viewport coordinates (transformed by transformRect)
			// so we don't need to add container offset
			const centerX = rect.left + rect.width / 2
			const centerY = rect.top + rect.height / 2

			elementCenterRef.current = { x: centerX, y: centerY }

			// Calculate starting angle
			const startAngle = calculateAngle(event.clientX, event.clientY)

			// Use current rotation state as initial value to maintain continuity
			// This prevents jumps when crossing 360° boundary
			const currentRotation =
				selectedInfoRef.current.rotation ??
				extractRotationFromTransform(
					selectedInfoRef.current.computedStyles?.transform || "none",
				)

			// Start new rotate operation
			isRotatingRef.current = true
			rotateStartAngleRef.current = startAngle
			initialRotationRef.current = currentRotation

			// Begin batch operation - save initial state
			if (editorRef?.current) {
				try {
					// Extract current transform and preserve other transform values
					const currentTransform =
						selectedInfoRef.current.computedStyles?.transform || "none"
					await editorRef.current.beginBatchOperation(selectedInfoRef.current.selector, {
						transform: currentTransform,
					})
				} catch (error) {
					console.error("[useRotateHandle] Failed to begin batch operation:", error)
				}
			}

			// Clear hover state and ensure selection mode is active
			setHoveredRect(null)
			setIsSelectionMode(true)

			// Set document styles for rotate operation
			// Use 'auto' for pointer-events to allow the rotate handle to work,
			// while pointer capture ensures events go to the captured element
			document.body.style.userSelect = "none"
			document.body.style.cursor = "grabbing"
			document.body.style.pointerEvents = "auto"
		},
		[
			calculateAngle,
			editorRef,
			extractRotationFromTransform,
			setHoveredRect,
			setIsSelectionMode,
			stopRotate,
		],
	)

	useEffect(() => {
		const handlePointerMove = (event: globalThis.PointerEvent) => {
			if (isRotatingRef.current) {
				// Prevent default and stop propagation to avoid interference from other elements
				event.preventDefault()
				event.stopPropagation()
			}
			updateRotate(event)
		}

		const handlePointerUp = (event: globalThis.PointerEvent) => {
			if (!isRotatingRef.current) return
			event.preventDefault()
			event.stopPropagation()
			stopRotate()
		}

		const handleMouseMove = (event: MouseEvent) => {
			// Block mouse events during rotation to prevent interference
			if (isRotatingRef.current) {
				event.preventDefault()
				event.stopPropagation()
			}
		}

		const handleMouseUp = (event: MouseEvent) => {
			// Block mouse events during rotation
			if (isRotatingRef.current) {
				event.preventDefault()
				event.stopPropagation()
			}
		}

		const handleContextMenu = (event: MouseEvent) => {
			// Prevent context menu during rotation
			if (isRotatingRef.current) {
				event.preventDefault()
				event.stopPropagation()
			}
		}

		const handleClick = (event: MouseEvent) => {
			// Prevent click events during or right after rotation
			if (isRotatingRef.current) {
				event.preventDefault()
				event.stopPropagation()
			}
		}

		// Listen on document with capture phase to ensure we get events first
		// and can prevent them from reaching other elements
		document.addEventListener("pointermove", handlePointerMove, {
			capture: true,
			passive: false,
		})
		document.addEventListener("pointerup", handlePointerUp, { capture: true, passive: false })
		document.addEventListener("pointercancel", handlePointerUp, {
			capture: true,
			passive: false,
		})
		// Also block traditional mouse events as a fallback
		document.addEventListener("mousemove", handleMouseMove, { capture: true, passive: false })
		document.addEventListener("mouseup", handleMouseUp, { capture: true, passive: false })
		document.addEventListener("click", handleClick, { capture: true, passive: false })
		document.addEventListener("contextmenu", handleContextMenu, {
			capture: true,
			passive: false,
		})
		// Handle window blur to stop rotating when window loses focus
		window.addEventListener("blur", stopRotate)

		return () => {
			document.removeEventListener("pointermove", handlePointerMove, true)
			document.removeEventListener("pointerup", handlePointerUp, true)
			document.removeEventListener("pointercancel", handlePointerUp, true)
			document.removeEventListener("mousemove", handleMouseMove, true)
			document.removeEventListener("mouseup", handleMouseUp, true)
			document.removeEventListener("click", handleClick, true)
			document.removeEventListener("contextmenu", handleContextMenu, true)
			window.removeEventListener("blur", stopRotate)
			if (rotateRafRef.current) {
				window.cancelAnimationFrame(rotateRafRef.current)
			}
		}
	}, [stopRotate, updateRotate])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (isRotatingRef.current) {
				isRotatingRef.current = false
				rotateStartAngleRef.current = 0
				initialRotationRef.current = 0
				elementCenterRef.current = null

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
				if (rotateRafRef.current) {
					window.cancelAnimationFrame(rotateRafRef.current)
					rotateRafRef.current = null
				}

				// Clear pending rotate update
				pendingRotateRef.current = null

				// Clear saved rotations
				elementRotationsRef.current.clear()

				// Restore document styles
				document.body.style.userSelect = ""
				document.body.style.cursor = ""
				document.body.style.pointerEvents = ""
			}
		}
	}, [])

	return {
		onRotateHandleMouseDown: startRotate,
		rotation,
	}
}
