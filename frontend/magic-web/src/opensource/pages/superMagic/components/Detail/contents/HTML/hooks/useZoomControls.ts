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

export interface ZoomControlsConfig extends Omit<IframeScalingConfig, "enableHeightCalculation"> {
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
		enableHeightCalculation: false,
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

		if (selectedElementRect) {
			// Use selected element center as zoom center
			const elementCenterX = selectedElementRect.left + selectedElementRect.width / 2
			const elementCenterY = selectedElementRect.top + selectedElementRect.height / 2

			zoomCenterX = elementCenterX
			zoomCenterY = elementCenterY
		} else {
			// Use viewport center as zoom center
			const viewportCenterX = container.scrollLeft + container.clientWidth / 2
			const viewportCenterY = container.scrollTop + container.clientHeight / 2

			// Convert from scaled coordinates to content coordinates
			zoomCenterX = viewportCenterX / scaleRatio
			zoomCenterY = viewportCenterY / scaleRatio
		}

		// Calculate new scroll position to keep the zoom center point visually stable
		const newScrollLeft = zoomCenterX * clampedScale - container.clientWidth / 2
		const newScrollTop = zoomCenterY * clampedScale - container.clientHeight / 2

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

			return {
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				minWidth: `${Math.ceil(visualWidth + paddingSize)}px`,
				minHeight: `${Math.ceil(visualHeight + paddingSize) + 160}px`,
				width: "100%",
				height: "auto",
				padding: "20px",
			}
		}

		// 自动缩放：固定尺寸以适应容器
		return {
			width: containerDimensions.width > 0 ? `${containerDimensions.width}px` : "unset",
			height: containerDimensions.height > 0 ? `${containerDimensions.height}px` : "unset",
			flex: 1,
			display: "flex",
			justifyContent: "center",
			alignItems: "center",
		}
	})

	// 计算 iframe 样式
	const getIframeStyle = useMemoizedFn((hasRenderedOnce: boolean): CSSProperties => {
		if (!shouldApplyScaling) {
			return {}
		}

		// For manual zoom, add a subtle transform transition for smoother scaling
		// For auto zoom or first render, keep existing behavior
		const transition = hasRenderedOnce
			? isManualZoom
				? "transform 50ms ease-out"
				: "none"
			: "opacity 120ms ease"

		return {
			transform: `scale(${scaleRatio})`,
			transformOrigin: "center center",
			width: contentWidth,
			height: contentHeight,
			// 仅在首次加载时隐藏，后续可见性变化不影响
			// opacity: !isFullscreen ? 0 : 1,
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
