import { useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { useIframeScaling, type IframeScalingConfig } from "./useIframeScaling"
import type { CSSProperties } from "react"

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

	// 退出编辑模式时重置缩放
	useEffect(() => {
		// 检测从编辑模式到查看模式的转换
		if (prevEditModeRef.current && !isEditMode) {
			resetScale()
		}
		prevEditModeRef.current = isEditMode
	}, [isEditMode, resetScale])

	// 处理缩放变化并限制范围，支持以选中元素为中心缩放
	const handleScaleChange = useMemoizedFn((newScale: number) => {
		const clampedScale = Math.max(minScale, Math.min(newScale, maxScale))

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

		// Calculate new scroll position to keep the zoom center point visually stable
		const newScrollLeft =
			visualContentOriginX + zoomCenterX * clampedScale - container.clientWidth / 2
		const newScrollTop =
			visualContentOriginY + zoomCenterY * clampedScale - container.clientHeight / 2

		// Apply scale change
		setManualScale(clampedScale)

		// Adjust scroll position after a brief delay to allow scale to apply
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (container) {
					container.scrollTo({
						left: Math.max(0, newScrollLeft),
						top: Math.max(0, newScrollTop),
						behavior: "instant",
					})
				}
			})
		})
	})

	// 处理缩放重置
	const handleResetZoom = useMemoizedFn(() => {
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
		const transition = hasRenderedOnce
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
