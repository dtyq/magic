import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useDebounceFn } from "ahooks"
import type { CanonicalContentDimensions } from "../utils/slide-dimensions"

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
	scaleContentDimensions?: CanonicalContentDimensions | null
	contentMetricsOverride?: {
		contentWidth: number
		contentHeight: number
		phase?: "initial" | "settled"
	} | null
	waitForSettledContentMetrics?: boolean
	autoFitScalePaddingFactor?: number
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
const DEFAULT_CONTENT_HEIGHT = 1080
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
		scaleContentDimensions,
		contentMetricsOverride,
		waitForSettledContentMetrics = false,
		autoFitScalePaddingFactor = 1,
	} = config

	const [internalScaleRatio, setInternalScaleRatio] = useState(1)
	const [internalVerticalOffset, setInternalVerticalOffset] = useState(0)
	const [internalHorizontalOffset, setInternalHorizontalOffset] = useState(0)
	const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 })
	const [contentWidth, setContentWidth] = useState(CONTENT_BASE_WIDTH)
	const [contentHeight, setContentHeight] = useState(DEFAULT_CONTENT_HEIGHT)
	const [hasSlideContainer, setHasSlideContainer] = useState(false)
	const [isScaleReady, setIsScaleReady] = useState(false)
	const [localManualScale, setLocalManualScale] = useState<number | null>(null)
	const contentWidthRef = useRef(CONTENT_BASE_WIDTH)
	const contentHeightRef = useRef(DEFAULT_CONTENT_HEIGHT)
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
	const getActualContentWidth = useCallback((): number => {
		if (!iframeRef.current?.contentDocument?.body) return CONTENT_BASE_WIDTH

		try {
			const body = iframeRef.current.contentDocument.body
			const bodyRect = body.getBoundingClientRect()
			const childContentWidth = Array.from(body.children || []).reduce(
				(maxWidth, element) => {
					const rect = element.getBoundingClientRect()
					return Math.max(maxWidth, rect.right - bodyRect.left)
				},
				0,
			)

			const width = Math.max(
				body.scrollWidth,
				body.offsetWidth,
				body.clientWidth,
				Math.ceil(childContentWidth),
			)

			return width || CONTENT_BASE_WIDTH
		} catch (error) {
			console.error("Error getting iframe content width:", error)
			return CONTENT_BASE_WIDTH
		}
	}, [iframeRef])

	const getActualContentHeight = useCallback((): number => {
		if (!iframeRef.current?.contentDocument?.body) return DEFAULT_CONTENT_HEIGHT

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

			return height || DEFAULT_CONTENT_HEIGHT
		} catch (error) {
			console.error("Error getting iframe content height:", error)
			return DEFAULT_CONTENT_HEIGHT
		}
	}, [iframeRef])

	const updateContainerDimensions = useCallback((width: number, height: number) => {
		setContainerDimensions((prev) => {
			if (prev.width === width && prev.height === height) return prev
			return { width, height }
		})
	}, [])

	const updateContentWidth = useCallback((nextWidth: number) => {
		if (!nextWidth) return
		contentWidthRef.current = nextWidth
		setContentWidth((prev) => (prev === nextWidth ? prev : nextWidth))
	}, [])

	const updateContentHeight = useCallback((nextHeight: number) => {
		if (!nextHeight) return
		contentHeightRef.current = nextHeight
		setContentHeight((prev) => (prev === nextHeight ? prev : nextHeight))
	}, [])

	const calculateScaleAndDimensionsSync = useCallback(
		(nextContentWidth?: number, nextContentHeight?: number) => {
			// Sync compute to avoid first-frame flicker
			if (
				!containerRef.current ||
				(!isPptRender && !hasSlideContainer && !scaleContentDimensions) ||
				!isVisible
			) {
				return false
			}
			if (
				waitForSettledContentMetrics &&
				!scaleContentDimensions &&
				(!contentMetricsOverride || contentMetricsOverride.phase !== "settled")
			) {
				return false
			}

			const containerWidth = containerRef.current.offsetWidth
			const containerHeight = containerRef.current.offsetHeight

			if (!containerWidth || !containerHeight) return false

			const actualWidth = scaleContentDimensions
				? scaleContentDimensions.width
				: contentMetricsOverride?.phase === "settled"
					? contentMetricsOverride.contentWidth
					: (nextContentWidth ?? contentWidthRef.current)
			const actualHeight = enableHeightCalculation
				? scaleContentDimensions
					? scaleContentDimensions.height
					: contentMetricsOverride?.phase === "settled"
						? contentMetricsOverride.contentHeight
						: (nextContentHeight ?? contentHeightRef.current)
				: (scaleContentDimensions?.height ?? DEFAULT_CONTENT_HEIGHT)

			// Update container dimensions
			updateContainerDimensions(containerWidth, containerHeight)

			let newScaleRatio: number

			// Use manual scale if set, otherwise calculate auto scale
			if (effectiveManualScale !== null && effectiveManualScale !== undefined) {
				newScaleRatio = effectiveManualScale
			} else {
				// Calculate scale ratio based on width and height separately
				const scaleByWidth = containerWidth / actualWidth
				const scaleByHeight = containerHeight / actualHeight

				// Leave some breathing room on initial auto-fit.
				newScaleRatio = Math.min(scaleByWidth, scaleByHeight) * autoFitScalePaddingFactor
			}

			// Calculate vertical offset to center content
			const scaledHeight = actualHeight * newScaleRatio
			const newVerticalOffset = (containerHeight - scaledHeight) / 2
			// Adjust for scale transform - divide by scale ratio
			const finalVerticalOffset = Math.max(0, newVerticalOffset / newScaleRatio)

			// Calculate horizontal offset to center content
			const scaledWidth = actualWidth * newScaleRatio
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
			scaleContentDimensions,
			contentMetricsOverride,
			waitForSettledContentMetrics,
			autoFitScalePaddingFactor,
			updateContainerDimensions,
		],
	)

	// Calculate scale ratio and dimensions based on container size and content size
	// Use minimal debounce for manual zoom to improve responsiveness
	const { run: calculateScaleAndDimensions } = useDebounceFn(
		(nextContentWidth?: number, nextContentHeight?: number) => {
			calculateScaleAndDimensionsSync(nextContentWidth, nextContentHeight)
		},
		{
			wait: effectiveManualScale !== null && effectiveManualScale !== undefined ? 0 : 16,
		},
	)

	// Check for slide-container after content is injected
	useEffect(() => {
		if (!iframeLoaded || !contentInjected) return
		if (scaleContentDimensions) {
			setHasSlideContainer(false)
			return
		}
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
	}, [checkForSlideContainer, iframeLoaded, contentInjected, scaleContentDimensions])

	// Measure content height after content is injected
	useEffect(() => {
		if (!enableHeightCalculation) return
		if (!iframeLoaded || !contentInjected) return
		if (!isVisible) return
		if (scaleContentDimensions) {
			updateContentWidth(scaleContentDimensions.width)
			updateContentHeight(scaleContentDimensions.height)
			calculateScaleAndDimensionsSync(
				scaleContentDimensions.width,
				scaleContentDimensions.height,
			)
			return
		}

		if (heightMeasureTimerRef.current) {
			window.clearTimeout(heightMeasureTimerRef.current)
		}
		// Delay to ensure iframe content is fully rendered
		heightMeasureTimerRef.current = window.setTimeout(() => {
			const actualWidth = getActualContentWidth()
			const actualHeight = getActualContentHeight()
			updateContentWidth(actualWidth)
			updateContentHeight(actualHeight)
			calculateScaleAndDimensions(actualWidth, actualHeight)
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
		getActualContentWidth,
		getActualContentHeight,
		isVisible,
		scaleContentDimensions,
		updateContentWidth,
		updateContentHeight,
	])

	useEffect(() => {
		if (enableHeightCalculation) return
		const nextWidth = scaleContentDimensions?.width ?? CONTENT_BASE_WIDTH
		const nextHeight = scaleContentDimensions?.height ?? DEFAULT_CONTENT_HEIGHT
		updateContentWidth(nextWidth)
		updateContentHeight(nextHeight)
		if (!isVisible) return
		calculateScaleAndDimensionsSync(nextWidth, nextHeight)
	}, [
		calculateScaleAndDimensionsSync,
		enableHeightCalculation,
		isVisible,
		scaleContentDimensions,
		updateContentHeight,
		updateContentWidth,
	])

	useEffect(() => {
		if (scaleContentDimensions) return
		if (!contentMetricsOverride || contentMetricsOverride.phase !== "settled") return
		updateContentWidth(contentMetricsOverride.contentWidth)
		updateContentHeight(contentMetricsOverride.contentHeight)
		calculateScaleAndDimensionsSync(
			contentMetricsOverride.contentWidth,
			contentMetricsOverride.contentHeight,
		)
	}, [
		calculateScaleAndDimensionsSync,
		contentMetricsOverride,
		scaleContentDimensions,
		updateContentHeight,
		updateContentWidth,
	])

	// Reset scale when content changes (not on visibility changes)
	useEffect(() => {
		if (!enableHeightCalculation) return
		if (!contentInjected) setIsScaleReady(false)
	}, [enableHeightCalculation, contentInjected])

	// Recalculate scale when slide becomes visible (without resetting isScaleReady)
	useEffect(() => {
		if (!isVisible) return
		if (!iframeLoaded || !contentInjected) return
		if (!isPptRender && !hasSlideContainer && !scaleContentDimensions) return
		calculateScaleAndDimensions()
	}, [
		calculateScaleAndDimensions,
		contentInjected,
		hasSlideContainer,
		iframeLoaded,
		isPptRender,
		isVisible,
		scaleContentDimensions,
	])

	// Synchronous scale calculation to avoid flicker during paint
	useLayoutEffect(() => {
		if (!isVisible) return
		if (!iframeLoaded || !contentInjected) return
		if (!isPptRender && !hasSlideContainer && !scaleContentDimensions) return

		if (scaleContentDimensions) {
			updateContentWidth(scaleContentDimensions.width)
			updateContentHeight(scaleContentDimensions.height)
			calculateScaleAndDimensionsSync(
				scaleContentDimensions.width,
				scaleContentDimensions.height,
			)
			return
		}

		if (enableHeightCalculation) {
			const actualWidth = getActualContentWidth()
			const actualHeight = getActualContentHeight()
			updateContentWidth(actualWidth)
			updateContentHeight(actualHeight)
			calculateScaleAndDimensionsSync(actualWidth, actualHeight)
			return
		}
		calculateScaleAndDimensionsSync(CONTENT_BASE_WIDTH, DEFAULT_CONTENT_HEIGHT)
	}, [
		calculateScaleAndDimensionsSync,
		contentInjected,
		enableHeightCalculation,
		getActualContentWidth,
		getActualContentHeight,
		hasSlideContainer,
		iframeLoaded,
		iframeRef,
		isPptRender,
		isVisible,
		scaleContentDimensions,
		updateContentWidth,
		updateContentHeight,
	])

	// Recalculate after mode switches or fullscreen changes
	useEffect(() => {
		if (!iframeLoaded || !contentInjected) return
		if (!isPptRender && !hasSlideContainer && !scaleContentDimensions) return
		calculateScaleAndDimensions()
	}, [
		calculateScaleAndDimensions,
		isFullscreen,
		isPptRender,
		hasSlideContainer,
		scaleContentDimensions,
		iframeLoaded,
		contentInjected,
	])

	// Listen to container resize events
	useEffect(() => {
		if (!isPptRender && !hasSlideContainer && !scaleContentDimensions) return
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
	}, [calculateScaleAndDimensions, isPptRender, hasSlideContainer, scaleContentDimensions])

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
		contentWidth,
		contentHeight,
		containerDimensions,
		shouldApplyScaling: isPptRender || hasSlideContainer || Boolean(scaleContentDimensions),
		isScaleReady,
		setManualScale,
		resetScale,
		isManualZoom,
	}
}
