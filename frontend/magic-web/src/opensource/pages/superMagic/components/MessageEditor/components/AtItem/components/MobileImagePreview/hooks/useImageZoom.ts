import { useRef, useCallback, RefObject } from "react"
import {
	getTouchDistance,
	getTouchCenter,
	isDoubleTap,
	getScaleChange,
	clamp,
	TouchPoint,
} from "../utils/touchUtils"
import {
	TransformState,
	applyTransform,
	applyAnimatedTransform,
	resetTransform,
	calculateBoundaryConstraints,
	constrainTransform,
	getDefaultTransform,
} from "../utils/transformUtils"

interface TouchState extends TransformState {
	lastTouchDistance: number
	lastTouchCenter: TouchPoint
	isDragging: boolean
	lastTap: number
}

interface UseImageZoomOptions {
	minScale?: number
	maxScale?: number
	doubleTapScale?: number
	isInteractive: boolean
	onScaleChange?: (scale: number) => void
}

interface UseImageZoomReturn {
	handleTouchStart: (e: React.TouchEvent) => void
	handleTouchMove: (e: React.TouchEvent) => void
	handleTouchEnd: (e: React.TouchEvent) => void
	resetZoom: () => void
	getCurrentScale: () => number
	canCloseOnBackgroundClick: () => boolean
}

export function useImageZoom(
	imageRef: RefObject<HTMLImageElement>,
	wrapperRef: RefObject<HTMLDivElement>,
	options: UseImageZoomOptions,
): UseImageZoomReturn {
	const {
		minScale = 0.5,
		maxScale = 5,
		doubleTapScale = 2.5,
		isInteractive,
		onScaleChange,
	} = options

	const touchStateRef = useRef<TouchState>({
		...getDefaultTransform(),
		lastTouchDistance: 0,
		lastTouchCenter: { x: 0, y: 0 },
		isDragging: false,
		lastTap: 0,
	})

	// Apply transform to image element
	const applyCurrentTransform = useCallback(() => {
		const { scale, translateX, translateY } = touchStateRef.current
		applyTransform(imageRef.current, { scale, translateX, translateY })
	}, [imageRef])

	// Animate to specific transform
	const animateToTransform = useCallback(
		(targetTransform: TransformState) => {
			if (!imageRef.current) return

			applyAnimatedTransform(imageRef.current, targetTransform)

			touchStateRef.current.scale = targetTransform.scale
			touchStateRef.current.translateX = targetTransform.translateX
			touchStateRef.current.translateY = targetTransform.translateY
		},
		[imageRef],
	)

	// Check and constrain boundaries
	const constrainBoundaries = useCallback(() => {
		if (!imageRef.current || !wrapperRef.current) return

		const currentTransform = {
			scale: touchStateRef.current.scale,
			translateX: touchStateRef.current.translateX,
			translateY: touchStateRef.current.translateY,
		}

		const bounds = calculateBoundaryConstraints(
			imageRef.current,
			wrapperRef.current,
			currentTransform,
		)

		const constrainedTransform = constrainTransform(currentTransform, bounds)

		// Apply constraints if needed
		if (
			constrainedTransform.translateX !== currentTransform.translateX ||
			constrainedTransform.translateY !== currentTransform.translateY
		) {
			animateToTransform(constrainedTransform)
		}
	}, [imageRef, wrapperRef, animateToTransform])

	// Reset zoom to default state
	const resetZoom = useCallback(() => {
		const defaultTransform = getDefaultTransform()
		touchStateRef.current = {
			...defaultTransform,
			lastTouchDistance: 0,
			lastTouchCenter: { x: 0, y: 0 },
			isDragging: false,
			lastTap: 0,
		}
		resetTransform(imageRef.current)
	}, [imageRef])

	// Get current scale
	const getCurrentScale = useCallback(() => {
		return touchStateRef.current.scale
	}, [])

	// Check if can close on background click
	const canCloseOnBackgroundClick = useCallback(() => {
		return touchStateRef.current.scale <= 1
	}, [])

	// Handle touch start
	const handleTouchStart = useCallback(
		(e: React.TouchEvent) => {
			if (!isInteractive || e.touches.length === 0) return

			const touchState = touchStateRef.current

			if (e.touches.length === 1) {
				// Single touch - check for double tap
				const now = Date.now()

				if (isDoubleTap(touchState.lastTap)) {
					// Double tap detected
					const currentScale = touchState.scale
					const targetScale = currentScale > 1 ? 1 : doubleTapScale
					const targetTransform = {
						scale: targetScale,
						translateX: currentScale > 1 ? 0 : 0,
						translateY: currentScale > 1 ? 0 : 0,
					}

					animateToTransform(targetTransform)
					onScaleChange?.(targetScale)
				} else {
					// Single tap - prepare for dragging
					const touch = e.touches[0]
					touchState.lastTouchCenter = { x: touch.clientX, y: touch.clientY }
					touchState.isDragging = true
				}

				touchState.lastTap = now
			} else if (e.touches.length === 2) {
				// Two finger touch - prepare for pinch
				const touchList = e.touches as unknown as TouchList
				touchState.lastTouchDistance = getTouchDistance(touchList)
				touchState.lastTouchCenter = getTouchCenter(touchList)
				touchState.isDragging = false
			}
		},
		[isInteractive, doubleTapScale, animateToTransform, onScaleChange],
	)

	// Handle touch move
	const handleTouchMove = useCallback(
		(e: React.TouchEvent) => {
			if (!isInteractive) return
			e.preventDefault()

			const touchState = touchStateRef.current

			if (e.touches.length === 2) {
				// Two finger pinch zoom
				const touchList = e.touches as unknown as TouchList
				const currentDistance = getTouchDistance(touchList)
				const currentCenter = getTouchCenter(touchList)

				if (touchState.lastTouchDistance > 0) {
					const scaleChange = getScaleChange(
						currentDistance,
						touchState.lastTouchDistance,
					)
					const newScale = clamp(touchState.scale * scaleChange, minScale, maxScale)

					// Calculate translation adjustment for zoom center
					const centerDiffX = currentCenter.x - touchState.lastTouchCenter.x
					const centerDiffY = currentCenter.y - touchState.lastTouchCenter.y

					touchState.scale = newScale
					touchState.translateX += centerDiffX / newScale
					touchState.translateY += centerDiffY / newScale

					applyCurrentTransform()
					onScaleChange?.(newScale)
				}

				touchState.lastTouchDistance = currentDistance
				touchState.lastTouchCenter = currentCenter
			} else if (e.touches.length === 1 && touchState.isDragging && touchState.scale > 1) {
				// Single finger drag (only when zoomed in)
				const touch = e.touches[0]
				const deltaX = (touch.clientX - touchState.lastTouchCenter.x) / touchState.scale
				const deltaY = (touch.clientY - touchState.lastTouchCenter.y) / touchState.scale

				touchState.translateX += deltaX
				touchState.translateY += deltaY
				touchState.lastTouchCenter = { x: touch.clientX, y: touch.clientY }

				applyCurrentTransform()
			}
		},
		[isInteractive, minScale, maxScale, applyCurrentTransform, onScaleChange],
	)

	// Handle touch end
	const handleTouchEnd = useCallback(
		(e: React.TouchEvent) => {
			if (!isInteractive) return

			const touchState = touchStateRef.current

			if (e.touches.length === 0) {
				touchState.isDragging = false
				touchState.lastTouchDistance = 0

				// Constrain boundaries after touch ends
				setTimeout(() => {
					constrainBoundaries()
				}, 50)
			}
		},
		[isInteractive, constrainBoundaries],
	)

	return {
		handleTouchStart,
		handleTouchMove,
		handleTouchEnd,
		resetZoom,
		getCurrentScale,
		canCloseOnBackgroundClick,
	}
}
