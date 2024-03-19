import { useEffect, useRef, useState } from "react"

interface UseTouchGesturesProps {
	scale: number
	setScale: (scale: number) => void
	minScale: number
	maxScale: number
	enabled: boolean
	viewerRef: React.RefObject<HTMLDivElement>
	setIsStabilizing: (isStabilizing: boolean) => void
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
	const [isGesturing, setIsGesturing] = useState(false)
	const [isScaling, setIsScaling] = useState(false)
	const initialDistanceRef = useRef<number>(0)
	const initialScaleRef = useRef<number>(1)

	// Calculate distance between two touch points
	const getTouchDistance = (touches: TouchList): number => {
		if (touches.length < 2) return 0

		const touch1 = touches[0]
		const touch2 = touches[1]

		const deltaX = touch2.clientX - touch1.clientX
		const deltaY = touch2.clientY - touch1.clientY

		return Math.sqrt(deltaX * deltaX + deltaY * deltaY)
	}

	useEffect(() => {
		if (!enabled || !viewerRef.current) return

		const viewer = viewerRef.current

		const handleTouchStart = (event: TouchEvent) => {
			if (event.touches.length === 2) {
				// Prevent default zoom behavior
				event.preventDefault()

				setIsGesturing(true)
				initialDistanceRef.current = getTouchDistance(event.touches)
				initialScaleRef.current = scale

				console.log("Touch gesture started:", {
					initialDistance: initialDistanceRef.current,
					initialScale: initialScaleRef.current,
				})
			}
		}

		const handleTouchMove = (event: TouchEvent) => {
			if (!isGesturing || event.touches.length !== 2) return

			// Prevent default zoom behavior
			event.preventDefault()

			const currentDistance = getTouchDistance(event.touches)

			if (initialDistanceRef.current === 0) return

			const scaleRatio = currentDistance / initialDistanceRef.current
			const newScale = initialScaleRef.current * scaleRatio

			// Clamp scale to min/max bounds
			const clampedScale = Math.max(minScale, Math.min(maxScale, newScale))

			if (clampedScale !== scale) {
				setIsScaling(true)
				setScale(clampedScale)
			}
		}

		const handleTouchEnd = (event: TouchEvent) => {
			if (isGesturing) {
				setIsGesturing(false)

				// Set stabilizing period after gesture ends
				setIsStabilizing(true)
				setTimeout(() => {
					setIsStabilizing(false)
					setIsScaling(false)
					console.log("Touch gesture stabilizing period ended")
				}, 300)

				console.log("Touch gesture ended:", { finalScale: scale })
			}
		}

		// Add touch event listeners
		viewer.addEventListener("touchstart", handleTouchStart, { passive: false })
		viewer.addEventListener("touchmove", handleTouchMove, { passive: false })
		viewer.addEventListener("touchend", handleTouchEnd, { passive: false })

		return () => {
			viewer.removeEventListener("touchstart", handleTouchStart)
			viewer.removeEventListener("touchmove", handleTouchMove)
			viewer.removeEventListener("touchend", handleTouchEnd)
		}
	}, [enabled, viewerRef, scale, setScale, minScale, maxScale, isGesturing, setIsStabilizing])

	return {
		isGesturing,
		isScaling,
	}
}
