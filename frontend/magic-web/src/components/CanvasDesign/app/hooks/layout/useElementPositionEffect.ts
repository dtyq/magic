import { useRef, useEffect, useCallback } from "react"
import { useCanvas } from "../../providers/CanvasProvider"
import { useSize } from "ahooks"

export type ElementPosition = "top" | "bottom" | "left" | "right"
export type VerticalAlign = "top" | "center" | "bottom"

const CANVAS_APP_CONTAINER_SELECTOR = "[data-canvas-design-app-container]"

export interface StickyTopRightPositionOptions {
	/** 吸附位置与边界顶部/右侧的间距 */
	gap?: number
	/** Header 操作条的 DOM 标识；存在时 panel 会放在其下方 */
	headerSelector?: string
}

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
	/** 定位对应的元素 ID；搭配 positionEventType 时用于过滤事件，不传 positionEventType 时直接跟踪该元素 bounds */
	trackedElementId?: string | null
	/** 可选：元素右侧或顶部越过 app-container 可视边界时，吸附到右上角 */
	stickyTopRight?: StickyTopRightPositionOptions
}

/**
 * 通用的元素定位 Hook
 * 用于将 UI 组件定位到元素的指定位置（上方/下方/左侧/右侧）
 * 支持选中模式（selection:position）、模式化定位（crop/extend/eraser）和按元素 ID 定位，复用相同的定位逻辑
 */
export default function useElementPositionEffect(options: UseElementPositionEffectOptions) {
	const {
		position,
		offset,
		shouldShow,
		verticalAlign = "center",
		positionEventType,
		trackedElementId,
		stickyTopRight,
	} = options
	const { canvas } = useCanvas()
	const containerRef = useRef<HTMLDivElement | null>(null)
	const containerSize = useSize(containerRef)
	const boundingRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(
		null,
	)
	const stickyTopRightEnabled = Boolean(stickyTopRight)
	const stickyTopRightGap = stickyTopRight?.gap ?? 8
	const stickyTopRightHeaderSelector =
		stickyTopRight?.headerSelector ?? "[data-canvas-design-header-actions]"

	const resolveStickyBoundary = useCallback(
		(container: HTMLElement): HTMLElement | null => {
			if (!stickyTopRightEnabled) return null

			const appContainer = container.closest<HTMLElement>(CANVAS_APP_CONTAINER_SELECTOR)
			if (appContainer) return appContainer

			// Backward-compatible fallback for isolated consumers/tests that do not render
			// the CanvasDesign root marker.
			return container.offsetParent instanceof HTMLElement ? container.offsetParent : null
		},
		[stickyTopRightEnabled],
	)

	const resolveStickyHeader = useCallback(
		(boundary: HTMLElement): HTMLElement | null => {
			if (!stickyTopRightEnabled) return null

			let scope: HTMLElement | null = boundary
			while (scope) {
				const header = scope.querySelector<HTMLElement>(stickyTopRightHeaderSelector)
				if (header) return header
				scope = scope.parentElement
			}

			return null
		},
		[stickyTopRightEnabled, stickyTopRightHeaderSelector],
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

			if (stickyTopRightEnabled) {
				const boundary = resolveStickyBoundary(container)
				if (boundary) {
					const boundaryRect = boundary.getBoundingClientRect()
					const positioningContext =
						container.offsetParent instanceof HTMLElement
							? container.offsetParent
							: boundary
					const contextRect = positioningContext.getBoundingClientRect()
					const headerRect = resolveStickyHeader(boundary)?.getBoundingClientRect()
					const safeTop = Math.max(
						boundaryRect.top + stickyTopRightGap,
						headerRect ? headerRect.bottom + stickyTopRightGap : -Infinity,
					)
					const preferredLeft = contextRect.left + left
					const preferredTop = contextRect.top + top
					const preferredRight = preferredLeft + containerSize.width
					const safeLeft = boundaryRect.left + stickyTopRightGap
					const safeRight = boundaryRect.right - stickyTopRightGap

					if (
						preferredLeft < safeLeft ||
						preferredRight > safeRight ||
						preferredTop < safeTop
					) {
						const stickyLeft = Math.max(safeLeft, safeRight - containerSize.width)
						left = stickyLeft - contextRect.left
						top = safeTop - contextRect.top
					}
				}
			}

			// 直接更新 DOM 样式
			container.style.transform = `translate(${left}px, ${top}px)`
			container.style.opacity = "1"
			container.style.pointerEvents = "auto"
		},
		[
			canvas,
			containerSize,
			offset,
			position,
			resolveStickyBoundary,
			resolveStickyHeader,
			shouldShow,
			stickyTopRightEnabled,
			stickyTopRightGap,
			verticalAlign,
		],
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

		if (trackedElementId) {
			const updateFromTrackedElement = () => {
				applyBoundingRect(
					canvas.geometryCacheManager.getElementBounds(trackedElementId) ?? null,
				)
			}

			updateFromTrackedElement()

			const unsubscribeList = [
				canvas.eventEmitter.on("canvas:resize", updateFromTrackedElement),
				canvas.eventEmitter.on("document:loaded", updateFromTrackedElement),
				canvas.eventEmitter.on("document:restored", updateFromTrackedElement),
				canvas.eventEmitter.on("element:change", updateFromTrackedElement),
				canvas.eventEmitter.on("element:updated", updateFromTrackedElement),
				canvas.eventEmitter.on("element:deleted", updateFromTrackedElement),
				canvas.eventEmitter.on("element:batchupdated", updateFromTrackedElement),
				canvas.eventEmitter.on("element:batchdeleted", updateFromTrackedElement),
			]

			return () => {
				unsubscribeList.forEach((unsubscribe) => unsubscribe())
			}
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

	// sticky fallback 需要在 app-container/Header 尺寸或页面滚动变化后重新计算。
	useEffect(() => {
		if (!stickyTopRightEnabled) return

		let frameId = 0
		const updateFromLayoutChange = () => {
			if (frameId !== 0) return
			frameId = window.requestAnimationFrame(() => {
				frameId = 0
				updatePosition(boundingRectRef.current)
			})
		}

		const boundary = containerRef.current ? resolveStickyBoundary(containerRef.current) : null
		const header = boundary instanceof HTMLElement ? resolveStickyHeader(boundary) : null
		const resizeObserver =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(updateFromLayoutChange)
		const mutationObserver =
			typeof MutationObserver === "undefined"
				? null
				: new MutationObserver(updateFromLayoutChange)
		const headerMutationObserver =
			typeof MutationObserver === "undefined"
				? null
				: new MutationObserver(updateFromLayoutChange)
		// Header 与 app-container 通常是同一设计视图下的兄弟节点；只监听其直接父节点
		// 的结构变化，避免把整个 Canvas DOM subtree 纳入观察范围。
		const observationScope = header?.parentElement ?? boundary?.parentElement
		if (boundary instanceof HTMLElement) resizeObserver?.observe(boundary)
		if (header) {
			resizeObserver?.observe(header)
			headerMutationObserver?.observe(header, {
				attributes: true,
				attributeFilter: ["class", "style"],
			})
		}
		if (observationScope) {
			mutationObserver?.observe(observationScope, {
				childList: true,
			})
		}

		window.addEventListener("resize", updateFromLayoutChange)
		window.addEventListener("scroll", updateFromLayoutChange, true)

		return () => {
			window.removeEventListener("resize", updateFromLayoutChange)
			window.removeEventListener("scroll", updateFromLayoutChange, true)
			resizeObserver?.disconnect()
			mutationObserver?.disconnect()
			headerMutationObserver?.disconnect()
			if (frameId !== 0) window.cancelAnimationFrame(frameId)
		}
	}, [resolveStickyBoundary, resolveStickyHeader, stickyTopRightEnabled, updatePosition])

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
