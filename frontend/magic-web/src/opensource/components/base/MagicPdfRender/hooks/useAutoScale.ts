import { useCallback, useRef } from "react"

interface UseAutoScaleProps {
	containerRef: React.RefObject<HTMLDivElement>
	viewerRef: React.RefObject<HTMLDivElement>
	minScale: number
	maxScale: number
	setScale: (scale: number | ((prev: number) => number)) => void
	setIsAutoScaling: (isAutoScaling: boolean) => void
	setIsStabilizing: (isStabilizing: boolean) => void
	showToolbar: boolean
}

export function useAutoScale({
	containerRef,
	viewerRef,
	minScale,
	maxScale,
	setScale,
	setIsAutoScaling,
	setIsStabilizing,
	showToolbar,
}: UseAutoScaleProps) {
	const isAutoScaleApplied = useRef(false)

	// Calculate optimal scale based on container and page dimensions
	const calculateOptimalScale = useCallback(
		(pageWidth: number, pageHeight: number) => {
			const container = containerRef.current
			const viewer = viewerRef.current

			if (!container || !viewer) return null

			// Get container dimensions
			const containerRect = container.getBoundingClientRect()
			const containerWidth = containerRect.width
			const containerHeight = containerRect.height

			// Calculate available space (subtract padding and toolbar height)
			const padding = 32 // 16px padding on each side
			const toolbarHeight = showToolbar ? 48 : 0 // Approximate toolbar height
			const scrollbarWidth = 16 // Approximate scrollbar width

			const availableWidth = containerWidth - padding - scrollbarWidth
			const availableHeight = containerHeight - toolbarHeight - padding

			// Calculate scale based on width and height constraints
			const scaleByWidth = availableWidth / pageWidth
			const scaleByHeight = availableHeight / pageHeight

			// Use the smaller scale to ensure the page fits completely
			let optimalScale = Math.min(scaleByWidth, scaleByHeight)

			// Ensure scale is within bounds
			optimalScale = Math.max(minScale, Math.min(maxScale, optimalScale))

			// Round to reasonable precision
			optimalScale = Math.round(optimalScale * 100) / 100

			return optimalScale
		},
		[containerRef, viewerRef, minScale, maxScale, showToolbar],
	)

	// Apply auto scale to the first page
	const applyAutoScale = useCallback(() => {
		// Only apply auto scale once per document load
		if (isAutoScaleApplied.current) return

		// Set auto scaling state to true to indicate scaling is in progress
		setIsAutoScaling(true)

		// Use requestAnimationFrame to ensure DOM is ready, with retry limit
		let retryCount = 0
		const maxRetries = 10 // Maximum number of retries to prevent infinite loop

		const applyScale = () => {
			const viewer = viewerRef.current
			if (!viewer) {
				setIsAutoScaling(false)
				return
			}

			// Find the first page canvas element
			const firstPageCanvas = viewer.querySelector('[data-page-number="1"] canvas')
			if (!firstPageCanvas) {
				// If canvas not ready and we haven't exceeded max retries, try again
				if (retryCount < maxRetries) {
					retryCount++
					setTimeout(() => {
						requestAnimationFrame(applyScale)
					}, 10)
				} else {
					// Give up after max retries
					console.warn("Auto-scaling: Canvas element not found after maximum retries")
					setIsAutoScaling(false)
				}
				return
			}

			const canvas = firstPageCanvas as HTMLCanvasElement
			const pageWidth = canvas.width / window.devicePixelRatio
			const pageHeight = canvas.height / window.devicePixelRatio

			if (pageWidth > 0 && pageHeight > 0) {
				const optimalScale = calculateOptimalScale(pageWidth, pageHeight)
				if (optimalScale && optimalScale !== 1.0) {
					setScale(optimalScale)
					isAutoScaleApplied.current = true

					// Set stabilizing period after scaling
					setIsStabilizing(true)
					setTimeout(() => {
						setIsStabilizing(false)
					}, 800) // 800ms stabilizing period
				}
			}

			// Complete auto scaling process
			setIsAutoScaling(false)
		}

		// Start the scaling process
		requestAnimationFrame(applyScale)
	}, [calculateOptimalScale, setScale, setIsAutoScaling, setIsStabilizing, viewerRef])

	// Reset auto scale flag when document changes
	const resetAutoScale = useCallback(() => {
		isAutoScaleApplied.current = false
		setIsAutoScaling(false)
		setIsStabilizing(false)
	}, [setIsAutoScaling, setIsStabilizing])

	return {
		applyAutoScale,
		resetAutoScale,
		calculateOptimalScale,
	}
}
