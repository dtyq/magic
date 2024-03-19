import { useEffect, useRef, useCallback } from "react"

interface UseTouchGesturesProps {
	/** 当前缩放比例 */
	scale: number
	/** 设置缩放比例的函数 */
	setScale: (scale: number | ((prev: number) => number)) => void
	/** 最小缩放比例 */
	minScale: number
	/** 最大缩放比例 */
	maxScale: number
	/** 是否启用触摸手势 */
	enabled: boolean
	/** PDF查看器容器的引用 */
	viewerRef: React.RefObject<HTMLDivElement>
	/** 设置稳定期状态的函数 */
	setIsStabilizing?: (isStabilizing: boolean) => void
}

interface TouchData {
	/** 触摸点1的坐标 */
	touch1: { x: number; y: number }
	/** 触摸点2的坐标 */
	touch2: { x: number; y: number }
	/** 两点之间的距离 */
	distance: number
	/** 缩放开始时的scale值 */
	initialScale: number
	/** 缩放中心点（相对于容器） */
	centerPoint: { x: number; y: number }
	/** 缩放中心点（相对于页面内容） */
	contentCenterPoint: { x: number; y: number }
	/** 初始变换状态 */
	initialTransform: { x: number; y: number }
	/** 手势过程中的最终缩放值 */
	finalScale: number
}

interface TransformState {
	scale: number
	translateX: number
	translateY: number
}

export function useTouchGestures({
	scale,
	setScale,
	minScale,
	maxScale,
	enabled,
	viewerRef,
	setIsStabilizing,
}: UseTouchGesturesProps) {
	const touchDataRef = useRef<TouchData | null>(null)
	const isGesturingRef = useRef(false)
	const transformStateRef = useRef<TransformState>({ scale: 1, translateX: 0, translateY: 0 })
	const pagesContainerRef = useRef<HTMLElement | null>(null)

	// Get pages container element with better error handling
	const getPagesContainer = useCallback((): HTMLElement | null => {
		if (!viewerRef.current) {
			return null
		}

		// Try multiple selectors to find the pages container
		const selectors = [
			'[class*="pagesContainer"]',
			".react-pdf__Document > div",
			'[data-testid="pages-container"]',
		]

		for (const selector of selectors) {
			const container = viewerRef.current.querySelector(selector) as HTMLElement
			if (container) {
				pagesContainerRef.current = container
				return container
			}
		}

		return null
	}, [viewerRef])

	// Calculate distance between two touch points
	const calculateDistance = useCallback((touch1: Touch, touch2: Touch): number => {
		const dx = touch1.clientX - touch2.clientX
		const dy = touch1.clientY - touch2.clientY
		return Math.sqrt(dx * dx + dy * dy)
	}, [])

	// Calculate center point between two touches
	const calculateCenterPoint = useCallback((touch1: Touch, touch2: Touch) => {
		return {
			x: (touch1.clientX + touch2.clientX) / 2,
			y: (touch1.clientY + touch2.clientY) / 2,
		}
	}, [])

	// Get relative position within container
	const getRelativePosition = useCallback(
		(clientX: number, clientY: number, container: HTMLElement) => {
			const rect = container.getBoundingClientRect()
			return {
				x: clientX - rect.left,
				y: clientY - rect.top,
			}
		},
		[],
	)

	// Apply transform to pages container
	const applyTransform = useCallback(
		(transform: TransformState) => {
			const pagesContainer = getPagesContainer()
			if (!pagesContainer) {
				console.warn("TouchGestures: Pages container not found for transform")
				return
			}

			const { scale: transformScale, translateX, translateY } = transform

			// Apply CSS transform
			const transformValue = `translate(${translateX}px, ${translateY}px) scale(${transformScale})`
			pagesContainer.style.transform = transformValue
			pagesContainer.style.transformOrigin = "0 0"
			pagesContainer.style.transition = "none" // Disable transition during gesture

			// Update transform state
			transformStateRef.current = transform
		},
		[getPagesContainer],
	)

	// Reset transform when gesture ends
	const resetTransform = useCallback(() => {
		const pagesContainer = getPagesContainer()
		if (!pagesContainer) return

		// Re-enable transition
		pagesContainer.style.transition = "transform 0.3s ease"

		// Remove custom transform to let react-pdf handle scaling
		pagesContainer.style.transform = ""
		pagesContainer.style.transformOrigin = ""

		// Re-enable scrolling with appropriate touch action based on scale
		const viewer = viewerRef.current
		if (viewer) {
			// If scaled beyond minimum, allow both horizontal and vertical panning
			// If at minimum scale, only allow vertical panning
			viewer.style.touchAction = scale > minScale ? "auto" : "pan-y"
		}

		// Reset transform state
		transformStateRef.current = { scale, translateX: 0, translateY: 0 }
	}, [getPagesContainer, scale, minScale, viewerRef])

	// Update touch action when scale changes externally
	const updateTouchAction = useCallback(() => {
		const viewer = viewerRef.current
		if (viewer && !isGesturingRef.current) {
			// Set touch action based on current scale
			viewer.style.touchAction = scale > minScale ? "auto" : "pan-y"
		}
	}, [scale, minScale, viewerRef])

	// Handle touch start
	const handleTouchStart = useCallback(
		(event: TouchEvent) => {
			if (!enabled) return

			// Handle different touch counts
			if (event.touches.length === 1) {
				// Single touch - allow scrolling
				touchDataRef.current = null
				isGesturingRef.current = false
				return
			}

			if (event.touches.length !== 2) {
				// More than 2 touches - ignore
				touchDataRef.current = null
				isGesturingRef.current = false
				return
			}

			// Two finger gesture - prevent default browser zoom behavior
			event.preventDefault()

			const touch1 = event.touches[0]
			const touch2 = event.touches[1]
			const distance = calculateDistance(touch1, touch2)
			const centerPoint = calculateCenterPoint(touch1, touch2)

			const viewer = viewerRef.current
			if (!viewer) return

			// Temporarily disable scrolling during gesture
			viewer.style.touchAction = "none"

			// Get center point relative to viewer container
			const relativeCenterPoint = getRelativePosition(centerPoint.x, centerPoint.y, viewer)

			// Get center point relative to content (accounting for current scroll)
			const contentCenterPoint = {
				x: relativeCenterPoint.x + viewer.scrollLeft,
				y: relativeCenterPoint.y + viewer.scrollTop,
			}

			touchDataRef.current = {
				touch1: { x: touch1.clientX, y: touch1.clientY },
				touch2: { x: touch2.clientX, y: touch2.clientY },
				distance,
				initialScale: scale,
				centerPoint: relativeCenterPoint,
				contentCenterPoint,
				initialTransform: {
					x: transformStateRef.current.translateX,
					y: transformStateRef.current.translateY,
				},
				finalScale: scale,
			}

			isGesturingRef.current = true
		},
		[enabled, scale, calculateDistance, calculateCenterPoint, getRelativePosition, viewerRef],
	)

	// Handle touch move
	const handleTouchMove = useCallback(
		(event: TouchEvent) => {
			if (
				!enabled ||
				!touchDataRef.current ||
				!isGesturingRef.current ||
				event.touches.length !== 2
			) {
				return
			}

			// Prevent default browser zoom behavior
			event.preventDefault()

			const touch1 = event.touches[0]
			const touch2 = event.touches[1]
			const currentDistance = calculateDistance(touch1, touch2)
			const currentCenterPoint = calculateCenterPoint(touch1, touch2)

			const {
				distance: initialDistance,
				initialScale,
				centerPoint: initialCenterPoint,
				contentCenterPoint,
				initialTransform,
			} = touchDataRef.current

			// Calculate scale factor based on distance change
			const scaleFactor = currentDistance / initialDistance
			const newScale = initialScale * scaleFactor

			// Clamp the scale within bounds
			const clampedScale = Math.max(minScale, Math.min(maxScale, newScale))

			const viewer = viewerRef.current
			if (!viewer) return

			// Get current center point relative to viewer
			const currentRelativeCenterPoint = getRelativePosition(
				currentCenterPoint.x,
				currentCenterPoint.y,
				viewer,
			)

			// Calculate translation to keep the zoom centered on the gesture
			const scaleChange = clampedScale / initialScale

			// Calculate how much the content should move to keep the zoom point fixed
			const deltaX =
				contentCenterPoint.x * (scaleChange - 1) +
				(currentRelativeCenterPoint.x - initialCenterPoint.x)
			const deltaY =
				contentCenterPoint.y * (scaleChange - 1) +
				(currentRelativeCenterPoint.y - initialCenterPoint.y)

			// Apply transform with translation to maintain zoom center
			const newTransform: TransformState = {
				scale: clampedScale,
				translateX: initialTransform.x - deltaX,
				translateY: initialTransform.y - deltaY,
			}

			applyTransform(newTransform)

			// Store the final scale but don't update react-pdf scale during gesture
			// This prevents conflicts with virtual scrolling and re-rendering
			touchDataRef.current.finalScale = clampedScale
		},
		[
			enabled,
			calculateDistance,
			calculateCenterPoint,
			getRelativePosition,
			minScale,
			maxScale,
			applyTransform,
			viewerRef,
		],
	)

	// Handle touch end
	const handleTouchEnd = useCallback(
		(event: TouchEvent) => {
			if (!enabled) return

			// Reset gesture state when touches end
			if (event.touches.length < 2) {
				const finalScale = touchDataRef.current?.finalScale || scale

				touchDataRef.current = null
				isGesturingRef.current = false

				// Reset transform first, then update scale after a short delay
				resetTransform()

				// Update the react-pdf scale after transform is reset
				setTimeout(() => {
					if (finalScale !== scale) {
						setScale(finalScale)

						// Set stabilizing period after touch scaling
						if (setIsStabilizing) {
							setIsStabilizing(true)
							setTimeout(() => {
								setIsStabilizing(false)
							}, 600) // 600ms stabilizing period for touch gestures
						}
					}
				}, 150)
			}
		},
		[enabled, resetTransform, scale, setScale, setIsStabilizing],
	)

	// Handle touch cancel
	const handleTouchCancel = useCallback(
		(event: TouchEvent) => {
			if (!enabled) return

			touchDataRef.current = null
			isGesturingRef.current = false

			// Reset transform immediately on cancel
			resetTransform()
		},
		[enabled, resetTransform],
	)

	// Update transform state when scale changes externally
	useEffect(() => {
		if (!isGesturingRef.current) {
			transformStateRef.current.scale = scale
			// Update touch action when scale changes
			updateTouchAction()
		}
	}, [scale, updateTouchAction])

	// Set up event listeners
	useEffect(() => {
		if (!enabled || !viewerRef?.current) return

		const viewer = viewerRef.current

		// Set initial touch action based on current scale
		viewer.style.touchAction = scale > minScale ? "auto" : "pan-y"

		// Add event listeners with passive: false to allow preventDefault
		viewer.addEventListener("touchstart", handleTouchStart, { passive: false })
		viewer.addEventListener("touchmove", handleTouchMove, { passive: false })
		viewer.addEventListener("touchend", handleTouchEnd, { passive: false })
		viewer.addEventListener("touchcancel", handleTouchCancel, { passive: false })

		return () => {
			viewer.removeEventListener("touchstart", handleTouchStart)
			viewer.removeEventListener("touchmove", handleTouchMove)
			viewer.removeEventListener("touchend", handleTouchEnd)
			viewer.removeEventListener("touchcancel", handleTouchCancel)
		}
	}, [
		enabled,
		handleTouchStart,
		handleTouchMove,
		handleTouchEnd,
		handleTouchCancel,
		viewerRef,
		scale,
		minScale,
	])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			// Reset any applied transforms
			if (viewerRef?.current) {
				const pagesContainer = getPagesContainer()
				if (pagesContainer) {
					pagesContainer.style.transform = ""
					pagesContainer.style.transformOrigin = ""
					pagesContainer.style.transition = ""
				}
			}
		}
	}, [getPagesContainer, viewerRef])

	// Return current gesture state for debugging or external use
	return {
		isGesturing: isGesturingRef.current,
		isScaling: isGesturingRef.current, // Alias for clarity
	}
}
