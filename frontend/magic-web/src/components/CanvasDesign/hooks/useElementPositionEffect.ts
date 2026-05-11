import { useRef, useEffect, useCallback } from "react"
import { useCanvas } from "../context/CanvasContext"
import { useSize } from "ahooks"

export type ElementPosition = "top" | "bottom" | "left" | "right"
export type VerticalAlign = "top" | "center" | "bottom"

export interface UseElementPositionEffectOptions {
	/** 位置方向：上方、下方、左侧、右侧 */
	position: ElementPosition
	/** 距离元素的间距（像素） */
	offset: number
	/** 是否显示的条件判断函数 */
	shouldShow?: (
		boundingRect: { x: number; y: number; width: number; height: number } | null,
	) => boolean
	/** 垂直对齐方式（用于 left/right 位置）：顶部、居中、底部，默认为居中 */
	verticalAlign?: VerticalAlign
	/** 模式化定位所依赖的事件名，不传则监听 selection:position */
	positionEventType?: "crop:position" | "extend:position" | "eraser:position"
	/** 模式化定位对应的元素 ID */
	trackedElementId?: string | null
}

/**
 * 通用的元素定位 Hook
 * 用于将 UI 组件定位到元素的指定位置（上方/下方/左侧/右侧）
 * 支持选中模式（selection:position）和裁剪模式（crop:position），复用相同的定位逻辑
 */
export default function useElementPositionEffect(options: UseElementPositionEffectOptions) {
	const {
		position,
		offset,
		shouldShow,
		verticalAlign = "center",
		positionEventType,
		trackedElementId,
	} = options
	const { canvas } = useCanvas()
	const containerRef = useRef<HTMLDivElement | null>(null)
	const containerSize = useSize(containerRef)
	const boundingRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(
		null,
	)

	// 直接更新 DOM 样式，避免触发 React 重新渲染
	const updatePosition = useCallback(
		(boundingRect: { x: number; y: number; width: number; height: number } | null) => {
			const container = containerRef.current

			// 检查是否应该显示
			const shouldDisplay = shouldShow ? shouldShow(boundingRect) : true

			if (!container || !canvas || !boundingRect || !containerSize || !shouldDisplay) {
				// 隐藏容器
				if (container) {
					container.style.opacity = "0"
					container.style.pointerEvents = "none"
				}
				return
			}

			const stage = canvas.getStage()

			// boundingRect 是相对于 layer 的坐标（画布坐标系）
			// 需要转换为屏幕坐标系（考虑 stage 的 scale 和 position）
			const stageScale = stage.scaleX() // stage 的缩放比例
			const stageX = stage.x() // stage 的 X 偏移
			const stageY = stage.y() // stage 的 Y 偏移

			// 画布坐标 -> 屏幕坐标的转换公式
			const screenX = boundingRect.x * stageScale + stageX
			const screenY = boundingRect.y * stageScale + stageY
			const screenWidth = boundingRect.width * stageScale
			const screenHeight = boundingRect.height * stageScale

			// 根据位置方向计算坐标
			let left = 0
			let top = 0

			switch (position) {
				case "top":
					// 水平居中，垂直在元素上方
					left = screenX + screenWidth / 2 - containerSize.width / 2
					top = screenY - containerSize.height - offset
					break
				case "bottom":
					// 水平居中，垂直在元素下方
					left = screenX + screenWidth / 2 - containerSize.width / 2
					top = screenY + screenHeight + offset
					break
				case "left":
					// 水平在元素左侧，根据 verticalAlign 设置垂直位置
					left = screenX - containerSize.width - offset
					switch (verticalAlign) {
						case "top":
							top = screenY
							break
						case "bottom":
							top = screenY + screenHeight - containerSize.height
							break
						case "center":
						default:
							top = screenY + screenHeight / 2 - containerSize.height / 2
							break
					}
					break
				case "right":
					// 水平在元素右侧，根据 verticalAlign 设置垂直位置
					left = screenX + screenWidth + offset
					switch (verticalAlign) {
						case "top":
							top = screenY
							break
						case "bottom":
							top = screenY + screenHeight - containerSize.height
							break
						case "center":
						default:
							top = screenY + screenHeight / 2 - containerSize.height / 2
							break
					}
					break
			}

			// 直接更新 DOM 样式
			container.style.transform = `translate(${left}px, ${top}px)`
			container.style.opacity = "1"
			container.style.pointerEvents = "auto"
		},
		[canvas, containerSize, position, offset, shouldShow, verticalAlign],
	)

	// 监听元素位置变化事件，复用 updatePosition 逻辑
	// 模式定位：监听 crop/eraser 的 position 事件；普通定位：监听 selection:position
	useEffect(() => {
		if (!canvas) {
			updatePosition(null)
			return
		}

		const applyBoundingRect = (
			rect: { x: number; y: number; width: number; height: number } | null,
		) => {
			boundingRectRef.current = rect
			updatePosition(rect)
		}

		if (positionEventType && trackedElementId) {
			const unsubscribe = canvas.eventEmitter.on(positionEventType, ({ data }) => {
				if (data.elementId === trackedElementId) {
					applyBoundingRect(data.boundingRect)
				}
			})
			return unsubscribe
		}

		// 选中模式：监听 selection:position
		const unsubscribe = canvas.eventEmitter.on("selection:position", ({ data }) => {
			applyBoundingRect(data.boundingRect)
		})
		return unsubscribe
	}, [canvas, updatePosition, positionEventType, trackedElementId])

	// viewport 变化时复用缓存的 layer 坐标重算屏幕位置，避免 producer 侧重复全量求 rect
	useEffect(() => {
		if (!canvas) return

		const updateFromCachedRect = () => {
			updatePosition(boundingRectRef.current)
		}

		const unsubscribeScale = canvas.eventEmitter.on("viewport:scale", updateFromCachedRect)
		const unsubscribePan = canvas.eventEmitter.on("viewport:pan", updateFromCachedRect)

		return () => {
			unsubscribeScale()
			unsubscribePan()
		}
	}, [canvas, updatePosition])

	// 监听容器尺寸变化，重新计算位置
	useEffect(() => {
		if (boundingRectRef.current) {
			updatePosition(boundingRectRef.current)
		}
	}, [containerSize, updatePosition])

	return {
		containerRef,
	}
}
