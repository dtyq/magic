import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useDebounceFn } from "ahooks"

export interface IframeScalingConfig {
	containerRef: React.RefObject<HTMLDivElement>
	iframeRef: React.RefObject<HTMLIFrameElement>
	isPptRender?: boolean
	isFullscreen?: boolean
	iframeLoaded?: boolean
	contentInjected?: boolean
	enableHeightCalculation?: boolean
	isVisible?: boolean
	manualScale?: number // Manual scale factor (1.0 = 100%, null = auto)
}

export interface IframeScalingResult {
	scaleRatio: number
	verticalOffset: number
	horizontalOffset: number
	contentWidth: number
	contentHeight: number
	containerDimensions: { width: number; height: number }
	shouldApplyScaling: boolean // Whether scaling should be applied (PPT mode or slide-container detected)
	isScaleReady: boolean
	setManualScale: (scale: number | null) => void // Function to set manual scale
	resetScale: () => void // Function to reset to auto scale
	isManualZoom: boolean // Whether currently in manual zoom mode
}

const CONTENT_BASE_WIDTH = 1920 // Base width for content scaling

/**
 * Hook to manage iframe scaling and positioning for PPT render mode
 * Calculates scale ratio, offsets, and content dimensions based on container size and actual content height
 */
export function useIframeScaling(config: IframeScalingConfig): IframeScalingResult {
	const {
		containerRef,
		iframeRef,
		isPptRender,
		isFullscreen,
		iframeLoaded,
		contentInjected,
		enableHeightCalculation = true,
		isVisible = true,
		manualScale,
	} = config

	const [internalScaleRatio, setInternalScaleRatio] = useState(1)
	const [internalVerticalOffset, setInternalVerticalOffset] = useState(0)
	const [internalHorizontalOffset, setInternalHorizontalOffset] = useState(0)
	const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 })
	const [contentHeight, setContentHeight] = useState(1080) // Default fallback height
	const [hasSlideContainer, setHasSlideContainer] = useState(false)
	const [isScaleReady, setIsScaleReady] = useState(false)
	const [localManualScale, setLocalManualScale] = useState<number | null>(null)
	const contentHeightRef = useRef(1080)
	const slideCheckTimerRef = useRef<number | null>(null)
	const heightMeasureTimerRef = useRef<number | null>(null)

	// Use manual scale if provided (from prop or local state)
	const effectiveManualScale = manualScale ?? localManualScale

	const scaleRatio = internalScaleRatio
	const verticalOffset = internalVerticalOffset
	const horizontalOffset = internalHorizontalOffset

	// Check if iframe contains .slide-container element
	const checkForSlideContainer = useCallback((): boolean => {
		if (!iframeRef.current?.contentDocument) {
			return false
		}

		try {
			const slideContainer =
				iframeRef.current.contentDocument.querySelector(".slide-container")
			return !!slideContainer
		} catch (error) {
			console.error("Error checking for slide container:", error)
			return false
		}
	}, [iframeRef])

	// Get actual content height from iframe document
	const getActualContentHeight = useCallback((): number => {
		if (!iframeRef.current?.contentDocument?.body) {
			return 1080 // Fallback to default height
		}

		try {
			const body = iframeRef.current.contentDocument.body
			const html = iframeRef.current.contentDocument.documentElement

			// Get the maximum of scroll height, offset height, and client height
			const height = Math.max(
				body.scrollHeight,
				body.offsetHeight,
				html.clientHeight,
				html.scrollHeight,
				html.offsetHeight,
			)

			return height || 1080 // Fallback if height is 0
		} catch (error) {
			console.error("Error getting iframe content height:", error)
			return 1080
		}
	}, [iframeRef])

	const updateContainerDimensions = useCallback((width: number, height: number) => {
		setContainerDimensions((prev) => {
			if (prev.width === width && prev.height === height) return prev
			return { width, height }
		})
	}, [])

	const updateContentHeight = useCallback((nextHeight: number) => {
		if (!nextHeight) return
		contentHeightRef.current = nextHeight
		setContentHeight((prev) => (prev === nextHeight ? prev : nextHeight))
	}, [])

	const calculateScaleAndDimensionsSync = useCallback(
		(nextContentHeight?: number) => {
			// Sync compute to avoid first-frame flicker
			if (!containerRef.current || (!isPptRender && !hasSlideContainer) || !isVisible)
				return false

			const containerWidth = containerRef.current.offsetWidth
			const containerHeight = containerRef.current.offsetHeight

			if (!containerWidth || !containerHeight) return false

			const actualHeight = enableHeightCalculation
				? (nextContentHeight ?? contentHeightRef.current)
				: 1080

			// Update container dimensions
			updateContainerDimensions(containerWidth, containerHeight)

			let newScaleRatio: number

			// Use manual scale if set, otherwise calculate auto scale
			if (effectiveManualScale !== null && effectiveManualScale !== undefined) {
				newScaleRatio = effectiveManualScale
			} else {
				// Calculate scale ratio based on width and height separately
				const scaleByWidth = containerWidth / CONTENT_BASE_WIDTH
				const scaleByHeight = containerHeight / actualHeight

				// Use smaller scale to ensure content fits completely within container
				newScaleRatio = Math.min(scaleByWidth, scaleByHeight)
			}

			// Calculate vertical offset to center content
			const scaledHeight = actualHeight * newScaleRatio
			const newVerticalOffset = (containerHeight - scaledHeight) / 2
			// Adjust for scale transform - divide by scale ratio
			const finalVerticalOffset = Math.max(0, newVerticalOffset / newScaleRatio)

			// Calculate horizontal offset to center content
			const scaledWidth = CONTENT_BASE_WIDTH * newScaleRatio
			const newHorizontalOffset = (containerWidth - scaledWidth) / 2
			// Adjust for scale transform - divide by scale ratio
			const finalHorizontalOffset = Math.max(0, newHorizontalOffset / newScaleRatio)

			// Update internal scale state
			setInternalScaleRatio((prev) => (prev === newScaleRatio ? prev : newScaleRatio))
			setInternalVerticalOffset((prev) =>
				prev === finalVerticalOffset ? prev : finalVerticalOffset,
			)
			setInternalHorizontalOffset((prev) =>
				prev === finalHorizontalOffset ? prev : finalHorizontalOffset,
			)
			setIsScaleReady(true)
			return true
		},
		[
			containerRef,
			effectiveManualScale,
			enableHeightCalculation,
			hasSlideContainer,
			isPptRender,
			isVisible,
			updateContainerDimensions,
		],
	)

	// Calculate scale ratio and dimensions based on container size and content size
	// Use minimal debounce for manual zoom to improve responsiveness
	const { run: calculateScaleAndDimensions } = useDebounceFn(
		(nextContentHeight?: number) => {
			calculateScaleAndDimensionsSync(nextContentHeight)
		},
		{
			wait: effectiveManualScale !== null && effectiveManualScale !== undefined ? 0 : 16,
		},
	)

	// Check for slide-container after content is injected
	useEffect(() => {
		if (!iframeLoaded || !contentInjected) return
		if (slideCheckTimerRef.current) {
			window.clearTimeout(slideCheckTimerRef.current)
		}
		// Delay to ensure iframe content is fully rendered
		slideCheckTimerRef.current = window.setTimeout(() => {
			const hasSlide = checkForSlideContainer()
			setHasSlideContainer(hasSlide)
		}, 100)

		return () => {
			if (slideCheckTimerRef.current) {
				window.clearTimeout(slideCheckTimerRef.current)
			}
		}
	}, [checkForSlideContainer, iframeLoaded, contentInjected])

	// Measure content height after content is injected
	useEffect(() => {
		if (!enableHeightCalculation) return
		if (!iframeLoaded || !contentInjected) return
		if (!isVisible) return

		if (heightMeasureTimerRef.current) {
			window.clearTimeout(heightMeasureTimerRef.current)
		}
		// Delay to ensure iframe content is fully rendered
		heightMeasureTimerRef.current = window.setTimeout(() => {
			const actualHeight = getActualContentHeight()
			updateContentHeight(actualHeight)
			calculateScaleAndDimensions(actualHeight)
		}, 100)

		return () => {
			if (heightMeasureTimerRef.current) {
				window.clearTimeout(heightMeasureTimerRef.current)
			}
		}
	}, [
		calculateScaleAndDimensions,
		enableHeightCalculation,
		iframeLoaded,
		contentInjected,
		getActualContentHeight,
		isVisible,
		updateContentHeight,
	])

	useEffect(() => {
		if (enableHeightCalculation) return
		updateContentHeight(1080)
		if (!isVisible) return
		calculateScaleAndDimensionsSync(1080)
	}, [calculateScaleAndDimensionsSync, enableHeightCalculation, isVisible, updateContentHeight])

	// Reset scale when content changes (not on visibility changes)
	useEffect(() => {
		if (!enableHeightCalculation) return
		if (!contentInjected) setIsScaleReady(false)
	}, [enableHeightCalculation, contentInjected])

	// Recalculate scale when slide becomes visible (without resetting isScaleReady)
	useEffect(() => {
		if (!isVisible) return
		if (!iframeLoaded || !contentInjected) return
		if (!isPptRender && !hasSlideContainer) return
		calculateScaleAndDimensions()
	}, [
		calculateScaleAndDimensions,
		contentInjected,
		hasSlideContainer,
		iframeLoaded,
		isPptRender,
		isVisible,
	])

	// Synchronous scale calculation to avoid flicker during paint
	useLayoutEffect(() => {
		if (!isVisible) return
		if (!iframeLoaded || !contentInjected) return
		if (!isPptRender && !hasSlideContainer) return

		if (enableHeightCalculation) {
			const actualHeight = getActualContentHeight()
			updateContentHeight(actualHeight)
			calculateScaleAndDimensionsSync(actualHeight)
			return
		}
		calculateScaleAndDimensionsSync(1080)
	}, [
		calculateScaleAndDimensionsSync,
		contentInjected,
		enableHeightCalculation,
		getActualContentHeight,
		hasSlideContainer,
		iframeLoaded,
		isPptRender,
		isVisible,
		updateContentHeight,
	])

	// Recalculate after mode switches or fullscreen changes
	useEffect(() => {
		if (!iframeLoaded || !contentInjected) return
		if (!isPptRender && !hasSlideContainer) return
		calculateScaleAndDimensions()
	}, [
		calculateScaleAndDimensions,
		isFullscreen,
		isPptRender,
		hasSlideContainer,
		iframeLoaded,
		contentInjected,
	])

	// Listen to container resize events
	useEffect(() => {
		if (!isPptRender && !hasSlideContainer) return
		// Use ResizeObserver to monitor container size changes
		const container = containerRef.current
		if (!container) return
		const resizeObserver = new ResizeObserver(() => {
			calculateScaleAndDimensions()
		})
		resizeObserver.observe(container)

		return () => {
			resizeObserver.disconnect()
		}
		// containerRef is intentionally omitted from deps as ref objects don't trigger re-renders
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [calculateScaleAndDimensions, isPptRender, hasSlideContainer])

	// Set manual scale function
	const setManualScale = useCallback((scale: number | null) => {
		setLocalManualScale(scale)
	}, [])

	// Reset to auto scale
	const resetScale = useCallback(() => {
		// If container has scroll, reset scroll position to 0 first
		const container = containerRef.current
		if (container && (container.scrollTop !== 0 || container.scrollLeft !== 0)) {
			container.scrollTo({ top: 0, left: 0, behavior: "instant" })
		}
		setLocalManualScale(null)
	}, [containerRef])

	// Check if currently in manual zoom mode
	const isManualZoom = effectiveManualScale !== null && effectiveManualScale !== undefined

	return {
		scaleRatio,
		verticalOffset,
		horizontalOffset,
		contentWidth: CONTENT_BASE_WIDTH,
		contentHeight,
		containerDimensions,
		shouldApplyScaling: isPptRender || hasSlideContainer,
		isScaleReady,
		setManualScale,
		resetScale,
		isManualZoom,
	}
}
