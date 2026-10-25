import { useEffect, useLayoutEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { useIframeScaling, type IframeScalingConfig } from "./useIframeScaling"
import type { CSSProperties } from "react"
import { useTouchPinchZoom } from "./useTouchPinchZoom"
import type { PinchAnchor } from "../utils/pinch-zoom-controller"

export interface ElementRect {
	top: number
	left: number
	width: number
	height: number
}

export interface ZoomControlsConfig extends IframeScalingConfig {
	isEditMode?: boolean
	minScale?: number
	maxScale?: number
	selectedElementRect?: ElementRect | null
}

export interface ZoomControlsResult {
	// 缩放状态
	scaleRatio: number
	isManualZoom: boolean
	isScaleReady: boolean
	shouldApplyScaling: boolean

	// 内容尺寸
	contentWidth: number
	contentHeight: number
	containerDimensions: { width: number; height: number }
	verticalOffset: number
	horizontalOffset: number

	// 控制处理器
	handleScaleChange: (newScale: number) => void
	handleResetZoom: () => void

	// 样式计算
	getContentWrapperStyle: () => CSSProperties
	getIframeStyle: (hasRenderedOnce: boolean) => CSSProperties
}

/**
 * 管理 HTML 内容的缩放控制
 * 处理手动缩放、自动适配和重置功能
 */
export function useZoomControls(config: ZoomControlsConfig): ZoomControlsResult {
	const {
		isEditMode,
		minScale = 0.1,
		maxScale = 1.5,
		selectedElementRect,
		...scalingConfig
	} = config

	// 使用 iframe 缩放 hook
	const {
		scaleRatio,
		contentWidth,
		contentHeight,
		containerDimensions,
		verticalOffset,
		horizontalOffset,
		shouldApplyScaling,
		isScaleReady,
		setManualScale,
		resetScale,
		isManualZoom,
	} = useIframeScaling({
		...scalingConfig,
	})

	// 跟踪前一个编辑模式以检测转换
	const prevEditModeRef = useRef(isEditMode)

	// 独立预览退出编辑模式时恢复自动适配；PPT 的共享缩放由外层控制栏持有。
	useEffect(() => {
		// 检测从编辑模式到查看模式的转换
		if (
			prevEditModeRef.current &&
			!isEditMode &&
			scalingConfig.onManualScaleChange === undefined
		) {
			resetScale()
		}
		prevEditModeRef.current = isEditMode
	}, [isEditMode, resetScale, scalingConfig.onManualScaleChange])

	// 处理缩放变化并限制范围，支持以选中元素为中心缩放
	const scrollRequestRef = useRef(0)
	const pinchActiveRef = useRef(false)
	const pendingPinchScrollRef = useRef<{ scale: number; anchor: PinchAnchor } | null>(null)
	const applyPinchScroll = useMemoizedFn((anchor: PinchAnchor, scale: number) => {
		const container = scalingConfig.containerRef.current
		const iframe = scalingConfig.iframeRef.current
		if (!container || !iframe) return
		const rect = iframe.getBoundingClientRect()
		// Both positions are viewport coordinates: container/page movement cancels out.
		container.scrollTo({
			left: Math.max(
				0,
				container.scrollLeft + rect.left + anchor.contentX * scale - anchor.clientX,
			),
			top: Math.max(
				0,
				container.scrollTop + rect.top + anchor.contentY * scale - anchor.clientY,
			),
			behavior: "instant",
		})
	})
	useLayoutEffect(() => {
		const pending = pendingPinchScrollRef.current
		if (!pending || !isManualZoom || pending.scale !== scaleRatio) return
		pendingPinchScrollRef.current = null
		// Correct the origin after React commits the new transform, before the browser paints.
		// Waiting two more frames lets the next gesture invalidate the correction continuously.
		applyPinchScroll(pending.anchor, scaleRatio)
	}, [scaleRatio, isManualZoom, applyPinchScroll])
	useEffect(
		() => () => {
			scrollRequestRef.current += 1
			pendingPinchScrollRef.current = null
		},
		[],
	)

	const handleScaleChange = useMemoizedFn((newScale: number, anchor?: PinchAnchor) => {
		if (!Number.isFinite(newScale)) return
		// Touch owns the gesture synchronously, including before its first animation frame.
		// Trackpad/legacy iframe zoom reports must not apply a second delta to the same pinch.
		if (pinchActiveRef.current && !anchor) return
		const request = ++scrollRequestRef.current
		const clampedScale = Math.max(minScale, Math.min(newScale, maxScale))
		if (anchor) {
			if (clampedScale === scaleRatio && isManualZoom) {
				applyPinchScroll(anchor, clampedScale)
			} else {
				pendingPinchScrollRef.current = { scale: clampedScale, anchor }
				setManualScale(clampedScale)
			}
			return
		}

		// Get container element
		const container = scalingConfig.containerRef.current
		if (!container || !shouldApplyScaling) {
			setManualScale(clampedScale)
			return
		}

		// Calculate zoom center point
		let zoomCenterX: number
		let zoomCenterY: number
		const viewportCenterX = container.scrollLeft + container.clientWidth / 2
		const viewportCenterY = container.scrollTop + container.clientHeight / 2
		const containerRect = container.getBoundingClientRect()
		const iframeRect = scalingConfig.iframeRef.current?.getBoundingClientRect()
		const visualContentOriginX = iframeRect
			? iframeRect.left - containerRect.left + container.scrollLeft
			: 0
		const visualContentOriginY = iframeRect
			? iframeRect.top - containerRect.top + container.scrollTop
			: 0

		if (selectedElementRect) {
			// Use selected element center as zoom center
			const elementCenterX = selectedElementRect.left + selectedElementRect.width / 2
			const elementCenterY = selectedElementRect.top + selectedElementRect.height / 2

			zoomCenterX = elementCenterX
			zoomCenterY = elementCenterY
		} else {
			// Convert viewport center into content coordinates using the
			// iframe's current visual origin inside the scroll container.
			zoomCenterX = (viewportCenterX - visualContentOriginX) / scaleRatio
			zoomCenterY = (viewportCenterY - visualContentOriginY) / scaleRatio
		}

		setManualScale(clampedScale)
		// Measure after layout: switching from fit-to-page to manual zoom changes the
		// wrapper's padding. Older queued scroll corrections must not win over a new gesture.
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (request !== scrollRequestRef.current) return
				const newRect = scalingConfig.iframeRef.current?.getBoundingClientRect()
				const targetX = container.clientWidth / 2
				const targetY = container.clientHeight / 2
				container.scrollTo({
					left: Math.max(
						0,
						container.scrollLeft +
							(newRect ? newRect.left - containerRect.left : 0) +
							zoomCenterX * clampedScale -
							targetX,
					),
					top: Math.max(
						0,
						container.scrollTop +
							(newRect ? newRect.top - containerRect.top : 0) +
							zoomCenterY * clampedScale -
							targetY,
					),
					behavior: "instant",
				})
			})
		})
	})

	const isPinching = useTouchPinchZoom({
		containerRef: scalingConfig.containerRef,
		iframeRef: scalingConfig.iframeRef,
		enabled: Boolean(
			scalingConfig.isPptRender &&
			shouldApplyScaling &&
			isScaleReady &&
			scalingConfig.isVisible !== false &&
			!isEditMode &&
			!scalingConfig.isFullscreen,
		),
		iframeReady: Boolean(scalingConfig.iframeLoaded && scalingConfig.contentInjected),
		scale: scaleRatio,
		onScaleChange: handleScaleChange,
		onPinchActiveChange: (active) => {
			pinchActiveRef.current = active
			if (active) {
				scrollRequestRef.current += 1
				pendingPinchScrollRef.current = null
			}
		},
	})

	// 处理缩放重置
	const handleResetZoom = useMemoizedFn(() => {
		scrollRequestRef.current += 1
		pendingPinchScrollRef.current = null
		resetScale()
	})

	// Handle trackpad pinch-to-zoom gesture
	useEffect(() => {
		const container = scalingConfig.containerRef.current
		if (!container || !shouldApplyScaling) return

		const handleWheel = (e: WheelEvent) => {
			// Detect pinch gesture (Ctrl/Cmd + wheel on trackpad)
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault()

				// Calculate scale delta based on wheel direction
				// Negative deltaY means zoom in, positive means zoom out
				const delta = -e.deltaY
				const scaleFactor = 0.002 // Sensitivity adjustment
				const scaleChange = delta * scaleFactor

				const newScale = scaleRatio + scaleChange
				handleScaleChange(newScale)
			}
		}

		container.addEventListener("wheel", handleWheel, { passive: false })

		return () => {
			container.removeEventListener("wheel", handleWheel)
		}
	}, [scalingConfig.containerRef, shouldApplyScaling, scaleRatio, handleScaleChange])

	// Wheel events inside an iframe do not bubble to the host preview container.
	// Capture pinch gestures in the same-origin sandbox so the canvas and its surrounding area
	// provide identical zoom behavior. The iframe runtime may also listen for this event, so stop
	// propagation after handling it here to avoid applying the delta twice.
	useEffect(() => {
		if (
			!scalingConfig.isPptRender ||
			!scalingConfig.iframeLoaded ||
			!scalingConfig.contentInjected ||
			!shouldApplyScaling
		) {
			return
		}

		try {
			const iframeWindow = scalingConfig.iframeRef.current?.contentWindow
			if (!iframeWindow) return

			const handleIframeWheel = (event: WheelEvent) => {
				if (!event.ctrlKey && !event.metaKey) return

				event.preventDefault()
				event.stopImmediatePropagation()
				handleScaleChange(scaleRatio - event.deltaY * 0.002)
			}

			iframeWindow.addEventListener("wheel", handleIframeWheel, {
				capture: true,
				passive: false,
			})

			return () => {
				iframeWindow.removeEventListener("wheel", handleIframeWheel, true)
			}
		} catch {
			// Cross-origin sandboxes use the existing postMessage zoom bridge instead.
			return
		}
	}, [
		scalingConfig.contentInjected,
		scalingConfig.iframeLoaded,
		scalingConfig.iframeRef,
		scalingConfig.isPptRender,
		shouldApplyScaling,
		scaleRatio,
		handleScaleChange,
	])

	// 计算内容包装器样式
	const getContentWrapperStyle = useMemoizedFn((): CSSProperties => {
		if (!shouldApplyScaling) {
			return {
				width: "100%",
				height: "100%",
				flex: 1,
			}
		}

		if (isManualZoom) {
			// 手动缩放：使用视觉尺寸以实现精确、平滑的缩放
			// 向上取整以避免子像素舍入问题导致底部内容被裁剪
			const visualWidth = contentWidth * scaleRatio
			const visualHeight = contentHeight * scaleRatio
			const paddingSize = 40
			const wrapperWidth = Math.ceil(visualWidth + paddingSize)
			const wrapperHeight = Math.ceil(visualHeight + paddingSize)
			const verticalInset =
				containerDimensions.height > wrapperHeight
					? Math.floor((containerDimensions.height - wrapperHeight) / 2)
					: 0

			return {
				minWidth: `${wrapperWidth}px`,
				minHeight: `${wrapperHeight}px`,
				width: `${wrapperWidth}px`,
				height: `${wrapperHeight}px`,
				padding: "20px",
				margin: `${verticalInset}px auto`,
				position: "relative",
				flex: "none",
				boxSizing: "border-box",
			}
		}

		// 自动缩放：保持容器占满可视区，由 iframe 自身偏移到中心。
		return {
			width: containerDimensions.width > 0 ? `${containerDimensions.width}px` : "100%",
			height: containerDimensions.height > 0 ? `${containerDimensions.height}px` : "100%",
			flex: 1,
			overflow: "hidden",
			position: "relative",
		}
	})

	// 计算 iframe 样式
	const getIframeStyle = useMemoizedFn((hasRenderedOnce: boolean): CSSProperties => {
		if (!shouldApplyScaling) {
			return {}
		}

		const shouldHideUntilScaleReady = !hasRenderedOnce && !isScaleReady

		// For manual zoom, add a subtle transform transition for smoother scaling
		// For auto zoom or first render, keep existing behavior
		// Continuous touch movement must follow the fingers without a transform animation.
		const transition = isPinching
			? "none"
			: hasRenderedOnce
				? isManualZoom
					? "transform 50ms ease-out"
					: "none"
				: "opacity 120ms ease"

		return isManualZoom
			? {
					transform: `scale(${scaleRatio})`,
					transformOrigin: "top left",
					width: contentWidth,
					height: contentHeight,
					position: "absolute",
					top: "20px",
					left: "20px",
					opacity: shouldHideUntilScaleReady ? 0 : 1,
					transition,
				}
			: {
					transform: `scale(${scaleRatio}) translate(${horizontalOffset}px, ${verticalOffset}px)`,
					transformOrigin: "top left",
					width: contentWidth,
					height: contentHeight,
					opacity: shouldHideUntilScaleReady ? 0 : 1,
					transition,
				}
	})

	return {
		scaleRatio,
		isManualZoom,
		isScaleReady,
		shouldApplyScaling,
		contentWidth,
		contentHeight,
		containerDimensions,
		verticalOffset,
		horizontalOffset,
		handleScaleChange,
		handleResetZoom,
		getContentWrapperStyle,
		getIframeStyle,
	}
}
