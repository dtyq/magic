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
}

/**
 * 通用的元素定位 Hook
 * 用于将 UI 组件定位到选中元素的指定位置（上方/下方/左侧/右侧）
 */
export default function useElementPositionEffect(options: UseElementPositionEffectOptions) {
	const { position, offset, shouldShow, verticalAlign = "center" } = options
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

	// 监听选中元素位置变化事件（Canvas 内部已处理选中、变换、视口变化等所有情况）
	useEffect(() => {
		if (!canvas) {
			updatePosition(null)
			return
		}

		// 监听 Canvas 发出的选中元素位置事件
		const unsubscribe = canvas.eventEmitter.on("selection:position", ({ data }) => {
			boundingRectRef.current = data.boundingRect
			updatePosition(data.boundingRect)
		})

		return () => {
			unsubscribe()
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
