import Konva from "konva"
import { hasModKey } from "./shortcuts/modifierUtils"
import type { Canvas } from "../Canvas"
import type { PaddingConfig, PaddingValue } from "../types"
import { createLeadingRafThrottle } from "../utils/leadingRafThrottle"
import { normalizePosition } from "../utils/normalizeUtils"
import type { LeadingRafThrottleConfig } from "../utils/leadingRafThrottle"

type ZoomPending = { scale: number; position: { x: number; y: number } }
type PanPending = { x: number; y: number }

const defaultPadding: PaddingConfig = {
	top: 50,
	right: 50,
	bottom: 50,
	left: 50,
}

/**
 * 触摸事件处理器集合
 */
interface TouchEventHandlers {
	handleTouchStart: (e: TouchEvent) => void
	handleTouchMove: (e: TouchEvent) => void
	handleTouchEnd: (e: TouchEvent) => void
	handleTouchCancel: () => void
}

/**
 * 视口控制器 - 负责画布的缩放和平移功能
 */
export class ViewportController {
	private canvas: Canvas

	private defaultViewportOffset?: { left: number; right: number; top: number; bottom: number }

	private scale = 1
	private minScale = 0.01
	private maxScale = 5
	private scaleStep = 0.1

	// 触摸缩放相关
	private lastTouchDistance = 0
	private isPinching = false

	// 触摸平移相关
	private isTouchPanning = false
	private touchStartPosition: { x: number; y: number } | null = null
	private stageStartPosition: { x: number; y: number } | null = null
	private touchStartTime = 0
	private readonly TOUCH_MOVE_THRESHOLD = 10 // 移动阈值，避免误触

	// 动画相关
	private currentTween: Konva.Tween | null = null

	// 触摸事件处理器引用
	private touchHandlers: TouchEventHandlers | null = null

	// 是否禁用 pan 和缩放
	private isPanZoomDisabled = false
	// 保存禁用前的 draggable 状态（用于 PanTool）
	private wasDraggableBeforeDisable = false

	// 缩放/平移节流（通用 leading + RAF）
	private zoomThrottle: ReturnType<typeof createLeadingRafThrottle<ZoomPending>>
	private panThrottle: ReturnType<typeof createLeadingRafThrottle<PanPending>>

	/**
	 * 格式化缩放值（保留 4 位小数）
	 */
	private roundScale(scale: number): number {
		return Math.round(scale * 10000) / 10000
	}

	/**
	 * 格式化位置值（保留 2 位小数）
	 */
	private roundPosition(position: { x: number; y: number }): { x: number; y: number } {
		return normalizePosition(position.x, position.y, { precision: 2 })
	}

	/**
	 * 应用缩放更新（由节流器调用）
	 */
	private applyZoomUpdate(pending: ZoomPending): void {
		this.scale = pending.scale
		this.canvas.stage.scale({ x: pending.scale, y: pending.scale })
		this.canvas.stage.position(pending.position)
		this.canvas.stage.batchDraw()

		this.canvas.eventEmitter.emit({
			type: "viewport:scale",
			data: { scale: this.roundScale(this.scale) },
		})
		this.canvas.eventEmitter.emit({
			type: "viewport:pan",
			data: this.roundPosition(pending.position),
		})
	}

	/**
	 * 应用平移更新（由节流器调用）
	 */
	private applyPanUpdate(pending: PanPending): void {
		this.canvas.stage.position(pending)
		this.canvas.stage.batchDraw()

		this.canvas.eventEmitter.emit({
			type: "viewport:pan",
			data: this.roundPosition(pending),
		})
	}

	/**
	 * 将 padding 值转换为实际像素
	 * @param value - padding 值（数值或百分比）
	 * @param reference - 参考尺寸（用于计算百分比）
	 */
	private resolvePaddingValue(value: PaddingValue, reference: number): number {
		if (typeof value === "string" && value.endsWith("%")) {
			const percentage = parseFloat(value)
			return (reference * percentage) / 100
		}
		return value as number
	}

	/**
	 * 应用视口变换（缩放和位置）到指定的边界框
	 * @param boundingBox - 目标区域的边界框
	 * @param options - 配置选项
	 * @param onComplete - 完成回调（用于选中元素等后续操作）
	 */
	private applyViewportTransform(
		boundingBox: { x: number; y: number; width: number; height: number },
		options: {
			padding: PaddingConfig
			viewportOffset?: { left?: number; right?: number; top?: number; bottom?: number }
			animated: boolean
			duration: number
			easing: (t: number, b: number, c: number, d: number) => number
			panOnly?: boolean
			ensureFullyVisible?: boolean
		},
		onComplete?: () => void,
	): void {
		const {
			padding,
			viewportOffset,
			animated,
			duration,
			easing,
			panOnly = false,
			ensureFullyVisible = true,
		} = options

		// 停止当前正在进行的动画
		if (this.currentTween) {
			this.currentTween.destroy()
			this.currentTween = null
		}

		// 清除待处理的缩放/平移，避免与程序化变换冲突
		this.zoomThrottle.cancel()
		this.panThrottle.cancel()

		// 获取 stage 尺寸
		const stageWidth = this.canvas.stage.width()
		const stageHeight = this.canvas.stage.height()

		// 解析 padding 值（百分比基于 stage 尺寸）
		const paddingTop = this.resolvePaddingValue(padding.top, stageHeight)
		const paddingRight = this.resolvePaddingValue(padding.right, stageWidth)
		const paddingBottom = this.resolvePaddingValue(padding.bottom, stageHeight)
		const paddingLeft = this.resolvePaddingValue(padding.left, stageWidth)

		// 计算有效视口尺寸（减去UI遮挡区域）
		const offsetLeft = viewportOffset?.left || 0
		const offsetRight = viewportOffset?.right || 0
		const offsetTop = viewportOffset?.top || 0
		const offsetBottom = viewportOffset?.bottom || 0

		// 确保有效尺寸为正数，避免在极端情况下（如小屏幕、UI遮挡过多）出现负数
		const effectiveWidth = Math.max(
			100,
			stageWidth - offsetLeft - offsetRight - paddingLeft - paddingRight,
		)
		const effectiveHeight = Math.max(
			100,
			stageHeight - offsetTop - offsetBottom - paddingTop - paddingBottom,
		)

		// 计算在当前缩放级别下，元素在屏幕坐标系中的边界
		const currentScale = this.scale
		const currentPosition = this.canvas.stage.position()

		const elementScreenBounds = {
			left: boundingBox.x * currentScale + currentPosition.x,
			top: boundingBox.y * currentScale + currentPosition.y,
			right: (boundingBox.x + boundingBox.width) * currentScale + currentPosition.x,
			bottom: (boundingBox.y + boundingBox.height) * currentScale + currentPosition.y,
		}

		// 计算可视区域边界（考虑 UI 遮挡和 padding）
		const viewportBounds = {
			left: offsetLeft + paddingLeft,
			top: offsetTop + paddingTop,
			right: stageWidth - offsetRight - paddingRight,
			bottom: stageHeight - offsetBottom - paddingBottom,
		}

		// 检查元素是否在当前 viewport 内完全显示
		const isFullyVisible =
			elementScreenBounds.left >= viewportBounds.left &&
			elementScreenBounds.top >= viewportBounds.top &&
			elementScreenBounds.right <= viewportBounds.right &&
			elementScreenBounds.bottom <= viewportBounds.bottom

		// 计算合适的缩放级别（用于确保元素完全显示）
		const calculateOptimalScale = () => {
			const scaleX = effectiveWidth / boundingBox.width
			const scaleY = effectiveHeight / boundingBox.height
			const newScale = Math.min(scaleX, scaleY)
			return Math.max(this.minScale, Math.min(this.maxScale, newScale))
		}

		// 确定最终的缩放级别
		let finalScale: number
		if (panOnly) {
			// 仅平移模式：如果启用了 ensureFullyVisible 且元素不完全可见，需要缩小
			if (ensureFullyVisible && !isFullyVisible) {
				// 元素不在 viewport 内完全显示（可能是因为缩放太大），计算合适的缩放级别
				finalScale = calculateOptimalScale()
			} else {
				// 保持当前缩放级别
				finalScale = currentScale
			}
		} else {
			// 普通模式：如果启用了 ensureFullyVisible，先检查当前缩放级别下元素是否完全显示
			if (ensureFullyVisible) {
				if (isFullyVisible) {
					// 元素已经能完全显示，保持当前缩放
					finalScale = currentScale
				} else {
					// 元素不在 viewport 内完全显示（可能是因为缩放太大），计算合适的缩放级别
					finalScale = calculateOptimalScale()
				}
			} else {
				// 不启用 ensureFullyVisible，直接计算合适的缩放级别
				finalScale = calculateOptimalScale()
			}
		}

		// 在有效视口区域内居中显示
		const availableWidth = stageWidth - offsetLeft - offsetRight
		const availableHeight = stageHeight - offsetTop - offsetBottom

		const newX =
			offsetLeft +
			paddingLeft +
			(availableWidth - paddingLeft - paddingRight - boundingBox.width * finalScale) / 2 -
			boundingBox.x * finalScale
		const newY =
			offsetTop +
			paddingTop +
			(availableHeight - paddingTop - paddingBottom - boundingBox.height * finalScale) / 2 -
			boundingBox.y * finalScale

		if (animated) {
			const durationInSeconds = duration / 1000 // 转换为秒
			this.currentTween = new Konva.Tween({
				node: this.canvas.stage,
				duration: durationInSeconds,
				scaleX: finalScale,
				scaleY: finalScale,
				x: newX,
				y: newY,
				easing,
				onUpdate: () => {
					// 动画过程中更新内部状态
					this.scale = this.canvas.stage.scaleX()
					// 发送事件，让UI实时更新
					this.canvas.eventEmitter.emit({
						type: "viewport:scale",
						data: { scale: this.roundScale(this.scale) },
					})
					this.canvas.eventEmitter.emit({
						type: "viewport:pan",
						data: this.roundPosition(this.canvas.stage.position()),
					})
				},
				onFinish: () => {
					// 动画结束后确保精确值
					this.scale = finalScale
					this.canvas.stage.scale({ x: finalScale, y: finalScale })
					this.canvas.stage.position({ x: newX, y: newY })
					this.canvas.stage.batchDraw()

					// 发送最终事件
					this.canvas.eventEmitter.emit({
						type: "viewport:scale",
						data: { scale: this.roundScale(this.scale) },
					})
					this.canvas.eventEmitter.emit({
						type: "viewport:pan",
						data: this.roundPosition({ x: newX, y: newY }),
					})

					// 执行完成回调
					if (onComplete) {
						onComplete()
					}

					// 清理动画引用
					this.currentTween = null
				},
			})

			this.currentTween.play()
		} else {
			// 无动画，直接设置
			this.scale = finalScale
			this.canvas.stage.scale({ x: finalScale, y: finalScale })
			this.canvas.stage.position({ x: newX, y: newY })
			this.canvas.stage.batchDraw()

			// 发送缩放变化事件（格式化精度）
			this.canvas.eventEmitter.emit({
				type: "viewport:scale",
				data: { scale: this.roundScale(this.scale) },
			})
			// 发送位置变化事件（格式化精度）
			this.canvas.eventEmitter.emit({
				type: "viewport:pan",
				data: this.roundPosition({ x: newX, y: newY }),
			})

			// 执行完成回调
			if (onComplete) {
				onComplete()
			}
		}
	}

	/**
	 * 构造函数
	 * @param config - 视口控制器配置
	 */
	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas

		const throttleConfig: { zoom: LeadingRafThrottleConfig; pan: LeadingRafThrottleConfig } = {
			zoom: {
				enabled: true,
				leading: true,
			},
			pan: {
				enabled: true,
				leading: true,
			},
		}

		const zoomConfig = throttleConfig?.zoom ?? {}
		const panConfig = throttleConfig?.pan ?? {}

		this.zoomThrottle = createLeadingRafThrottle<ZoomPending>((v) => this.applyZoomUpdate(v), {
			enabled: zoomConfig.enabled ?? true,
			leading: zoomConfig.leading ?? true,
		})
		this.panThrottle = createLeadingRafThrottle<PanPending>((v) => this.applyPanUpdate(v), {
			enabled: panConfig.enabled ?? true,
			leading: panConfig.leading ?? true,
		})

		this.setupNativeFeatures()
		this.setupEventListeners()
	}

	/**
	 * 设置 Konva 原生功能
	 */
	private setupNativeFeatures(): void {
		// 移动端不使用原生拖拽，改用自定义触摸平移
		// 桌面端由 PanTool 控制 draggable 状态
	}

	/**
	 * 设置事件监听器
	 */
	private setupEventListeners(): void {
		this.setupWheelEvents()
		this.setupTouchEvents()
	}

	/**
	 * 检查是否应该启用触摸平移
	 */
	private shouldEnableTouchPan(): boolean {
		return this.canvas.isMobileDevice
	}

	/**
	 * 设置滚轮事件
	 * - Ctrl + 滚轮：缩放
	 * - 普通滚轮：平移
	 */
	private setupWheelEvents(): void {
		this.canvas.stage.on("wheel", (e) => {
			// 如果禁用了 pan 和缩放，直接返回
			if (this.isPanZoomDisabled) {
				return
			}

			e.evt.preventDefault()

			const deltaX = e.evt.deltaX
			const deltaY = e.evt.deltaY

			// Ctrl/Command + 滚轮：缩放
			if (hasModKey(e.evt)) {
				this.handleWheelZoom(e)
			} else {
				// 普通滚轮：平移（RAF 节流，与缩放一致）
				const currentPos = this.panThrottle.getPending() ?? this.canvas.stage.position()
				const newPos = {
					x: currentPos.x - deltaX,
					y: currentPos.y - deltaY,
				}
				this.panThrottle.processEvent(newPos)
			}
		})
	}

	/**
	 * 处理滚轮缩放（RAF 节流）
	 */
	private handleWheelZoom(e: Konva.KonvaEventObject<WheelEvent>): void {
		const pointer = this.canvas.stage.getPointerPosition()
		if (!pointer) return

		const oldScale = this.zoomThrottle.getPending()?.scale ?? this.canvas.stage.scaleX()
		const mousePointTo = {
			x: (pointer.x - this.canvas.stage.x()) / oldScale,
			y: (pointer.y - this.canvas.stage.y()) / oldScale,
		}

		const delta = e.evt.deltaY
		const absDelta = Math.abs(delta)
		let scaleFactor: number
		if (absDelta < 10) scaleFactor = 0.01
		else if (absDelta < 50) scaleFactor = 0.005
		else scaleFactor = 0.002

		const scaleBy = Math.exp(-delta * scaleFactor)
		const newScale = Math.max(this.minScale, Math.min(this.maxScale, oldScale * scaleBy))

		this.zoomThrottle.processEvent({
			scale: newScale,
			position: {
				x: pointer.x - mousePointTo.x * newScale,
				y: pointer.y - mousePointTo.y * newScale,
			},
		})
	}

	/**
	 * 处理原生 WheelEvent 的缩放（leading + RAF 节流）
	 */
	private handleWheelZoomFromNative(e: WheelEvent): void {
		const container = this.canvas.stage.container()
		const rect = container.getBoundingClientRect()
		const pointer = {
			x: e.clientX - rect.left,
			y: e.clientY - rect.top,
		}

		const oldScale = this.zoomThrottle.getPending()?.scale ?? this.canvas.stage.scaleX()
		const mousePointTo = {
			x: (pointer.x - this.canvas.stage.x()) / oldScale,
			y: (pointer.y - this.canvas.stage.y()) / oldScale,
		}

		const delta = e.deltaY
		const absDelta = Math.abs(delta)
		let scaleFactor: number
		if (absDelta < 10) scaleFactor = 0.01
		else if (absDelta < 50) scaleFactor = 0.005
		else scaleFactor = 0.002

		const scaleBy = Math.exp(-delta * scaleFactor)
		const newScale = Math.max(this.minScale, Math.min(this.maxScale, oldScale * scaleBy))

		this.zoomThrottle.processEvent({
			scale: newScale,
			position: {
				x: pointer.x - mousePointTo.x * newScale,
				y: pointer.y - mousePointTo.y * newScale,
			},
		})
	}

	/**
	 * 处理来自悬浮组件的 wheel 事件
	 * 公开方法，供 FloatingUIContext 调用
	 */
	public handleWheelFromFloating(e: WheelEvent): void {
		// 如果禁用了 pan 和缩放，直接返回
		if (this.isPanZoomDisabled) {
			return
		}

		e.preventDefault()

		const deltaX = e.deltaX
		const deltaY = e.deltaY

		// Ctrl/Command + 滚轮：缩放
		if (hasModKey(e)) {
			this.handleWheelZoomFromNative(e)
		} else {
			// 普通滚轮：平移（RAF 节流）
			const currentPos = this.panThrottle.getPending() ?? this.canvas.stage.position()
			const newPos = {
				x: currentPos.x - deltaX,
				y: currentPos.y - deltaY,
			}
			this.panThrottle.processEvent(newPos)
		}
	}

	/**
	 * 设置触摸事件（包括单指平移和双指缩放）
	 */
	private setupTouchEvents(): void {
		let touchStartDistance = 0
		let hasMoved = false

		// 使用原生事件监听器，支持 passive: false
		const container = this.canvas.stage.container()

		const handleTouchStart = (e: TouchEvent) => {
			const touches = e.touches

			if (touches.length === 1) {
				// 单指触摸：准备平移
				this.touchStartTime = Date.now()
				const touch = touches[0]

				this.touchStartPosition = {
					x: touch.clientX,
					y: touch.clientY,
				}

				this.stageStartPosition = {
					x: this.canvas.stage.x(),
					y: this.canvas.stage.y(),
				}

				hasMoved = false
			} else if (touches.length === 2) {
				// 双指触摸：禁用单指平移，启用缩放
				this.isTouchPanning = false
				this.touchStartPosition = null
				this.stageStartPosition = null
				this.isPinching = true

				const touch1 = touches[0]
				const touch2 = touches[1]

				touchStartDistance = this.getTouchDistance(touch1, touch2)
				this.lastTouchDistance = touchStartDistance
			}
		}

		const handleTouchMove = (e: TouchEvent) => {
			// 如果禁用了 pan 和缩放，直接返回
			if (this.isPanZoomDisabled) {
				return
			}

			const touches = e.touches

			if (
				touches.length === 1 &&
				!this.isPinching &&
				this.touchStartPosition &&
				this.stageStartPosition &&
				this.shouldEnableTouchPan()
			) {
				// 单指移动：处理平移（仅移动端）
				const touch = touches[0]
				const currentPos = {
					x: touch.clientX,
					y: touch.clientY,
				}

				const deltaX = currentPos.x - this.touchStartPosition.x
				const deltaY = currentPos.y - this.touchStartPosition.y
				const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

				// 如果移动距离超过阈值，开始平移
				if (!hasMoved && distance > this.TOUCH_MOVE_THRESHOLD) {
					hasMoved = true
					this.isTouchPanning = true
				}

				if (hasMoved) {
					// 只在可以取消时才阻止默认行为
					if (e.cancelable) {
						e.preventDefault()
					}

					// 计算新位置（RAF 节流）
					const newPos = {
						x: this.stageStartPosition.x + deltaX,
						y: this.stageStartPosition.y + deltaY,
					}
					this.panThrottle.processEvent(newPos)
				}
			} else if (touches.length === 2 && this.isPinching) {
				// 双指移动：处理缩放
				if (e.cancelable) {
					e.preventDefault()
				}

				const touch1 = touches[0]
				const touch2 = touches[1]
				const currentDistance = this.getTouchDistance(touch1, touch2)
				const currentCenter = this.getTouchCenter(touch1, touch2)

				if (this.lastTouchDistance > 0) {
					const scale = currentDistance / this.lastTouchDistance
					this.handlePinchZoom(scale, currentCenter)
				}

				this.lastTouchDistance = currentDistance
			}
		}

		const handleTouchEnd = (e: TouchEvent) => {
			const touches = e.touches

			// 单指离开时重置平移状态
			if (touches.length === 0) {
				if (this.isTouchPanning) {
					// 立即应用待处理的平移（flush 内部会 emit viewport:pan）
					this.panThrottle.flush()
				}

				this.isTouchPanning = false
				this.touchStartPosition = null
				this.stageStartPosition = null
				hasMoved = false

				// 重置缩放状态，松手时立即应用待处理的 viewport 状态
				if (this.isPinching) {
					this.isPinching = false
					this.lastTouchDistance = 0
					this.zoomThrottle.flush()
				}
			} else if (touches.length === 1 && this.isPinching) {
				// 从双指变为单指：结束缩放，立即应用待处理状态
				this.isPinching = false
				this.lastTouchDistance = 0
				this.zoomThrottle.flush()
			}
		}

		const handleTouchCancel = () => {
			if (this.isTouchPanning) {
				this.panThrottle.flush()
			}
			this.isTouchPanning = false
			this.touchStartPosition = null
			this.stageStartPosition = null
			if (this.isPinching) {
				this.zoomThrottle.flush()
			}
			this.isPinching = false
			this.lastTouchDistance = 0
			hasMoved = false
		}

		// 添加原生事件监听器，使用 passive: false 以支持 preventDefault
		container.addEventListener("touchstart", handleTouchStart, { passive: false })
		container.addEventListener("touchmove", handleTouchMove, { passive: false })
		container.addEventListener("touchend", handleTouchEnd, { passive: false })
		container.addEventListener("touchcancel", handleTouchCancel, { passive: false })

		// 保存引用以便后续清理
		this.touchHandlers = {
			handleTouchStart,
			handleTouchMove,
			handleTouchEnd,
			handleTouchCancel,
		}
	}

	/**
	 * 处理双指捏合缩放（RAF 节流）
	 */
	private handlePinchZoom(scale: number, center: { x: number; y: number }): void {
		const oldScale = this.zoomThrottle.getPending()?.scale ?? this.canvas.stage.scaleX()
		const mousePointTo = {
			x: (center.x - this.canvas.stage.x()) / oldScale,
			y: (center.y - this.canvas.stage.y()) / oldScale,
		}

		const newScale = Math.max(this.minScale, Math.min(this.maxScale, oldScale * scale))

		this.zoomThrottle.processEvent({
			scale: newScale,
			position: {
				x: center.x - mousePointTo.x * newScale,
				y: center.y - mousePointTo.y * newScale,
			},
		})
	}

	/**
	 * 计算两个触摸点之间的距离
	 */
	private getTouchDistance(touch1: Touch, touch2: Touch): number {
		const dx = touch1.clientX - touch2.clientX
		const dy = touch1.clientY - touch2.clientY
		return Math.sqrt(dx * dx + dy * dy)
	}

	/**
	 * 计算两个触摸点的中心位置（stage 坐标系）
	 */
	private getTouchCenter(touch1: Touch, touch2: Touch): { x: number; y: number } {
		const stageRect = this.canvas.stage.container().getBoundingClientRect()
		return {
			x: (touch1.clientX + touch2.clientX) / 2 - stageRect.left,
			y: (touch1.clientY + touch2.clientY) / 2 - stageRect.top,
		}
	}

	/**
	 * 放大
	 */
	public zoomIn(): void {
		const newScale = Math.min(this.maxScale, this.scale + this.scaleStep)
		this.setScale(newScale)
	}

	/**
	 * 缩小
	 */
	public zoomOut(): void {
		const newScale = Math.max(this.minScale, this.scale - this.scaleStep)
		this.setScale(newScale)
	}

	/**
	 * 重置缩放到 100% 并居中
	 */
	public zoomToFit(): void {
		this.setScale(1)
		this.canvas.stage.position({ x: 0, y: 0 })
		this.canvas.stage.batchDraw()
	}

	/**
	 * 获取当前缩放比例
	 */
	public getScale(): number {
		return this.scale
	}

	/**
	 * 设置缩放比例
	 * @param scale - 缩放比例
	 * @param center - 缩放中心点（可选，默认为画布中心）
	 */
	public setScale(scale: number, center?: { x: number; y: number }): void {
		// 清除待处理的缩放，避免被 RAF 覆盖
		this.zoomThrottle.cancel()

		// 限制缩放范围
		const clampedScale = Math.max(this.minScale, Math.min(this.maxScale, scale))
		this.scale = clampedScale

		const oldScale = this.canvas.stage.scaleX()

		// 如果没有指定中心点，使用画布中心
		const centerPoint = center || {
			x: this.canvas.stage.width() / 2,
			y: this.canvas.stage.height() / 2,
		}

		// 计算缩放中心相对于stage的坐标
		const mousePointTo = {
			x: (centerPoint.x - this.canvas.stage.x()) / oldScale,
			y: (centerPoint.y - this.canvas.stage.y()) / oldScale,
		}

		// 设置新的缩放比例
		this.canvas.stage.scale({ x: clampedScale, y: clampedScale })

		// 调整位置
		const newPos = {
			x: centerPoint.x - mousePointTo.x * clampedScale,
			y: centerPoint.y - mousePointTo.y * clampedScale,
		}

		this.canvas.stage.position(newPos)
		this.canvas.stage.batchDraw()

		// 发送缩放变化事件（格式化精度）
		this.canvas.eventEmitter.emit({
			type: "viewport:scale",
			data: { scale: this.roundScale(this.scale) },
		})
	}

	/**
	 * 设置位置
	 * @param position - 位置坐标
	 */
	public setPosition(position: { x: number; y: number }): void {
		// 清除待处理的平移，避免被 RAF 覆盖
		this.panThrottle.cancel()

		this.canvas.stage.position(position)
		this.canvas.stage.batchDraw()
		this.canvas.eventEmitter.emit({ type: "viewport:pan", data: position })
	}

	/**
	 * 获取缩放范围
	 */
	public getScaleBounds(): { min: number; max: number } {
		return {
			min: this.minScale,
			max: this.maxScale,
		}
	}

	/**
	 * 重置视图（缩放和位置）
	 */
	public resetView(): void {
		this.zoomThrottle.cancel()
		this.panThrottle.cancel()

		this.scale = 1
		this.canvas.stage.scale({ x: 1, y: 1 })
		this.canvas.stage.position({ x: 0, y: 0 })
		this.canvas.stage.batchDraw()

		// 发送重置事件
		this.canvas.eventEmitter.emit({ type: "viewport:reset", data: undefined })
		// 发送缩放变化事件（格式化精度）
		this.canvas.eventEmitter.emit({
			type: "viewport:scale",
			data: { scale: this.roundScale(this.scale) },
		})
		// 发送位置变化事件（格式化精度）
		this.canvas.eventEmitter.emit({
			type: "viewport:pan",
			data: this.roundPosition({ x: 0, y: 0 }),
		})
	}

	/**
	 * 聚焦到指定元素（支持单个或多个元素）
	 * @param elementIds - 要聚焦的元素 ID 数组
	 * @param options - 配置选项
	 */
	public focusOnElements(
		elementIds: string[],
		options?: {
			padding?: PaddingConfig
			viewportOffset?: { left?: number; right?: number; top?: number; bottom?: number }
			animated?: boolean
			duration?: number
			easing?: (t: number, b: number, c: number, d: number) => number
			selectElement?: boolean | string[]
			panOnly?: boolean
			/** 当 viewport 放大导致元素无法完全显示时，是否自动缩小以完整展示元素（默认: true） */
			ensureFullyVisible?: boolean
		},
	): void {
		const {
			padding = defaultPadding,
			viewportOffset = this.defaultViewportOffset,
			animated = false,
			duration = 300,
			easing = Konva.Easings.EaseInOut,
			selectElement = true,
			panOnly = false,
			ensureFullyVisible = true,
		} = options || {}

		if (elementIds.length === 0) {
			return
		}

		// 获取元素节点
		const nodes = this.canvas.elementManager.getNodeAdapter().getNodesForFocus(elementIds)
		if (nodes.length === 0) {
			return
		}

		// 保存当前的 stage 变换状态
		const currentScale = this.canvas.stage.scaleX()
		const currentPosition = this.canvas.stage.position()

		// 临时重置 stage 变换，以获取原始内容边界
		this.canvas.stage.scale({ x: 1, y: 1 })
		this.canvas.stage.position({ x: 0, y: 0 })

		// 计算所有元素的包围盒
		let minX = Infinity
		let minY = Infinity
		let maxX = -Infinity
		let maxY = -Infinity

		nodes.forEach((node) => {
			const clientRect = node.getClientRect()
			minX = Math.min(minX, clientRect.x)
			minY = Math.min(minY, clientRect.y)
			maxX = Math.max(maxX, clientRect.x + clientRect.width)
			maxY = Math.max(maxY, clientRect.y + clientRect.height)
		})

		const boundingBox = {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		}

		if (boundingBox.width === 0 || boundingBox.height === 0) {
			// 恢复之前的变换
			this.canvas.stage.scale({ x: currentScale, y: currentScale })
			this.canvas.stage.position(currentPosition)
			return
		}

		// 恢复之前的变换状态，准备开始动画
		this.canvas.stage.scale({ x: currentScale, y: currentScale })
		this.canvas.stage.position(currentPosition)

		// 应用视口变换
		this.applyViewportTransform(
			boundingBox,
			{
				padding,
				viewportOffset,
				animated,
				duration,
				easing,
				panOnly,
				ensureFullyVisible,
			},
			() => {
				// 选中元素（如果需要）
				if (this.canvas.selectionManager) {
					if (selectElement === true && elementIds.length > 0) {
						// 选中所有聚焦的元素
						this.canvas.selectionManager.selectMultiple(elementIds)
					} else if (Array.isArray(selectElement) && selectElement.length > 0) {
						// 只选中指定的元素
						this.canvas.selectionManager.selectMultiple(selectElement)
					}
				}
			},
		)
	}

	/**
	 * 适应画布大小（将所有内容缩放到可见范围内）
	 * @param options - 配置选项
	 */
	public fitToScreen(options?: {
		padding?: PaddingConfig
		viewportOffset?: { left?: number; right?: number; top?: number; bottom?: number }
		animated?: boolean
		duration?: number
		easing?: (t: number, b: number, c: number, d: number) => number
	}): void {
		const {
			padding = defaultPadding,
			viewportOffset = this.defaultViewportOffset,
			animated = false,
			duration = 300,
			easing = Konva.Easings.EaseInOut,
		} = options || {}

		// 获取 contentLayer
		const layer = this.canvas.contentLayer

		// 保存当前的 stage 变换状态
		const currentScale = this.canvas.stage.scaleX()
		const currentPosition = this.canvas.stage.position()

		// 临时重置 stage 变换，以获取原始内容边界
		this.canvas.stage.scale({ x: 1, y: 1 })
		this.canvas.stage.position({ x: 0, y: 0 })

		// 临时隐藏背景，避免影响边界计算
		const background = layer.findOne(".canvas-background")
		const wasBackgroundVisible = background?.visible()
		if (background) {
			background.visible(false)
		}

		const clientRect = layer.getClientRect()

		// 恢复背景可见性
		if (background && wasBackgroundVisible) {
			background.visible(true)
		}

		if (clientRect.width === 0 || clientRect.height === 0) {
			// 恢复之前的变换
			this.canvas.stage.scale({ x: currentScale, y: currentScale })
			this.canvas.stage.position(currentPosition)
			return
		}

		// 恢复之前的变换状态，准备开始动画
		this.canvas.stage.scale({ x: currentScale, y: currentScale })
		this.canvas.stage.position(currentPosition)

		// 应用视口变换
		this.applyViewportTransform(clientRect, {
			padding,
			viewportOffset,
			animated,
			duration,
			easing,
		})
	}

	/**
	 * 设置缩放范围
	 * @param min - 最小缩放比例
	 * @param max - 最大缩放比例
	 */
	public setScaleRange(min: number, max: number): void {
		this.minScale = min
		this.maxScale = max

		// 如果当前缩放超出范围，调整到范围内
		if (this.scale < this.minScale || this.scale > this.maxScale) {
			this.setScale(Math.max(this.minScale, Math.min(this.maxScale, this.scale)))
		}
	}

	/**
	 * 设置缩放步长
	 * @param scaleStep - 缩放步长
	 */
	public setScaleStep(scaleStep: number): void {
		this.scaleStep = scaleStep
	}

	/**
	 * 销毁控制器，移除事件监听
	 */
	public destroy(): void {
		// 停止并清理动画
		if (this.currentTween) {
			this.currentTween.destroy()
			this.currentTween = null
		}

		// 清理节流器（取消 RAF、清空 pending）
		this.zoomThrottle.destroy()
		this.panThrottle.destroy()

		// 禁用原生拖拽
		this.canvas.stage.draggable(false)

		// 移除 Konva 事件监听
		this.canvas.stage.off("wheel")

		// 移除原生触摸事件监听器
		const container = this.canvas.stage.container()
		if (this.touchHandlers) {
			container.removeEventListener("touchstart", this.touchHandlers.handleTouchStart)
			container.removeEventListener("touchmove", this.touchHandlers.handleTouchMove)
			container.removeEventListener("touchend", this.touchHandlers.handleTouchEnd)
			container.removeEventListener("touchcancel", this.touchHandlers.handleTouchCancel)
			this.touchHandlers = null
		}

		// 清理状态
		this.isPinching = false
		this.lastTouchDistance = 0
		this.isTouchPanning = false
		this.touchStartPosition = null
		this.stageStartPosition = null
	}

	/**
	 * 检查是否正在触摸平移
	 */
	public isTouchPanningActive(): boolean {
		return this.isTouchPanning
	}

	/**
	 * 禁用 pan 和缩放功能
	 */
	public disablePanZoom(): void {
		if (this.isPanZoomDisabled) return
		this.isPanZoomDisabled = true
		// 如果 stage 当前是可拖拽的（PanTool 激活），保存状态并禁用
		this.wasDraggableBeforeDisable = this.canvas.stage.draggable()
		if (this.wasDraggableBeforeDisable) {
			this.canvas.stage.draggable(false)
		}
	}

	/**
	 * 启用 pan 和缩放功能
	 */
	public enablePanZoom(): void {
		if (!this.isPanZoomDisabled) return
		this.isPanZoomDisabled = false
		// 恢复之前的 draggable 状态
		if (this.wasDraggableBeforeDisable) {
			this.canvas.stage.draggable(true)
		}
	}

	/**
	 * 设置默认视口偏移量
	 * @param offset - 视口偏移量
	 */
	setDefaultViewportOffset(offset: {
		left: number
		right: number
		top: number
		bottom: number
	}): void {
		this.defaultViewportOffset = offset
	}

	/**
	 * 获取默认视口偏移量
	 * @returns 视口偏移量
	 */
	getDefaultViewportOffset():
		| {
				left: number
				right: number
				top: number
				bottom: number
		  }
		| undefined {
		return this.defaultViewportOffset
	}

	/**
	 * 判断元素是否完全在可视区域内
	 * @param elementIds - 要检查的元素 ID 数组
	 * @param options - 配置选项
	 * @returns 元素是否完全在可视区域内
	 */
	public isElementInViewport(
		elementIds: string[],
		options?: {
			padding?: PaddingConfig
			viewportOffset?: { left?: number; right?: number; top?: number; bottom?: number }
		},
	): boolean {
		const { padding = defaultPadding, viewportOffset = this.defaultViewportOffset } =
			options || {}

		if (elementIds.length === 0) {
			return false
		}

		// 获取元素节点
		const nodes = this.canvas.elementManager.getNodeAdapter().getNodesForFocus(elementIds)

		if (nodes.length === 0) {
			return false
		}

		// 保存当前的 stage 变换状态
		const currentScale = this.canvas.stage.scaleX()
		const currentPosition = this.canvas.stage.position()

		// 临时重置 stage 变换，以获取原始内容边界
		this.canvas.stage.scale({ x: 1, y: 1 })
		this.canvas.stage.position({ x: 0, y: 0 })

		// 计算所有元素的包围盒（画布坐标系）
		let minX = Infinity
		let minY = Infinity
		let maxX = -Infinity
		let maxY = -Infinity

		nodes.forEach((node) => {
			const clientRect = node.getClientRect()
			minX = Math.min(minX, clientRect.x)
			minY = Math.min(minY, clientRect.y)
			maxX = Math.max(maxX, clientRect.x + clientRect.width)
			maxY = Math.max(maxY, clientRect.y + clientRect.height)
		})

		// 恢复之前的变换
		this.canvas.stage.scale({ x: currentScale, y: currentScale })
		this.canvas.stage.position(currentPosition)

		// 元素边界（画布坐标系）
		const elementBounds = {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		}

		if (elementBounds.width === 0 || elementBounds.height === 0) {
			return false
		}

		// 将元素边界转换为屏幕坐标系
		const elementScreenBounds = {
			left: elementBounds.x * currentScale + currentPosition.x,
			top: elementBounds.y * currentScale + currentPosition.y,
			right: (elementBounds.x + elementBounds.width) * currentScale + currentPosition.x,
			bottom: (elementBounds.y + elementBounds.height) * currentScale + currentPosition.y,
		}

		// 获取 stage 尺寸
		const stageWidth = this.canvas.stage.width()
		const stageHeight = this.canvas.stage.height()

		// 解析 padding 值
		const paddingTop = this.resolvePaddingValue(padding.top, stageHeight)
		const paddingRight = this.resolvePaddingValue(padding.right, stageWidth)
		const paddingBottom = this.resolvePaddingValue(padding.bottom, stageHeight)
		const paddingLeft = this.resolvePaddingValue(padding.left, stageWidth)

		// 计算可视区域边界（考虑 UI 遮挡和 padding）
		const offsetLeft = viewportOffset?.left || 0
		const offsetRight = viewportOffset?.right || 0
		const offsetTop = viewportOffset?.top || 0
		const offsetBottom = viewportOffset?.bottom || 0

		const viewportBounds = {
			left: offsetLeft + paddingLeft,
			top: offsetTop + paddingTop,
			right: stageWidth - offsetRight - paddingRight,
			bottom: stageHeight - offsetBottom - paddingBottom,
		}

		// 判断元素是否完全在可视区域内
		return (
			elementScreenBounds.left >= viewportBounds.left &&
			elementScreenBounds.top >= viewportBounds.top &&
			elementScreenBounds.right <= viewportBounds.right &&
			elementScreenBounds.bottom <= viewportBounds.bottom
		)
	}

	/**
	 * 将元素移到可视区域内
	 * 智能移动：如果元素太大无法完全显示，则缩放+居中；如果可以完全显示，则最小移动
	 * @param elementIds - 要移动的元素 ID 数组
	 * @param options - 配置选项
	 */
	public moveElementToViewport(
		elementIds: string[],
		options?: {
			padding?: PaddingConfig
			viewportOffset?: { left?: number; right?: number; top?: number; bottom?: number }
			animated?: boolean
			duration?: number
			easing?: (t: number, b: number, c: number, d: number) => number
		},
	): void {
		const {
			padding = defaultPadding,
			viewportOffset = this.defaultViewportOffset,
			animated = true,
			duration = 300,
			easing = Konva.Easings.EaseInOut,
		} = options || {}

		if (elementIds.length === 0) {
			return
		}

		// 获取元素节点
		const nodes = this.canvas.elementManager.getNodeAdapter().getNodesForFocus(elementIds)
		if (nodes.length === 0) {
			return
		}

		// 保存当前的 stage 变换状态
		const currentScale = this.canvas.stage.scaleX()
		const currentPosition = this.canvas.stage.position()

		// 临时重置 stage 变换，以获取原始内容边界
		this.canvas.stage.scale({ x: 1, y: 1 })
		this.canvas.stage.position({ x: 0, y: 0 })

		// 计算所有元素的包围盒（画布坐标系）
		let minX = Infinity
		let minY = Infinity
		let maxX = -Infinity
		let maxY = -Infinity

		nodes.forEach((node) => {
			const clientRect = node.getClientRect()
			minX = Math.min(minX, clientRect.x)
			minY = Math.min(minY, clientRect.y)
			maxX = Math.max(maxX, clientRect.x + clientRect.width)
			maxY = Math.max(maxY, clientRect.y + clientRect.height)
		})

		// 恢复之前的变换
		this.canvas.stage.scale({ x: currentScale, y: currentScale })
		this.canvas.stage.position(currentPosition)

		// 元素边界（画布坐标系）
		const elementBounds = {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		}

		if (elementBounds.width === 0 || elementBounds.height === 0) {
			return
		}

		// 获取 stage 尺寸
		const stageWidth = this.canvas.stage.width()
		const stageHeight = this.canvas.stage.height()

		// 解析 padding 值
		const paddingTop = this.resolvePaddingValue(padding.top, stageHeight)
		const paddingRight = this.resolvePaddingValue(padding.right, stageWidth)
		const paddingBottom = this.resolvePaddingValue(padding.bottom, stageHeight)
		const paddingLeft = this.resolvePaddingValue(padding.left, stageWidth)

		// 计算有效视口尺寸（减去UI遮挡区域和 padding）
		const offsetLeft = viewportOffset?.left || 0
		const offsetRight = viewportOffset?.right || 0
		const offsetTop = viewportOffset?.top || 0
		const offsetBottom = viewportOffset?.bottom || 0

		const effectiveWidth = Math.max(
			100,
			stageWidth - offsetLeft - offsetRight - paddingLeft - paddingRight,
		)
		const effectiveHeight = Math.max(
			100,
			stageHeight - offsetTop - offsetBottom - paddingTop - paddingBottom,
		)

		// 判断元素是否需要缩放才能完全显示
		const scaleX = effectiveWidth / elementBounds.width
		const scaleY = effectiveHeight / elementBounds.height
		const requiredScale = Math.min(scaleX, scaleY)

		// 如果元素太大，需要缩放+居中
		if (requiredScale < currentScale) {
			// 使用现有的 applyViewportTransform 方法进行缩放+居中
			this.applyViewportTransform(elementBounds, {
				padding,
				viewportOffset,
				animated,
				duration,
				easing,
			})
			return
		}

		// 元素可以完全显示，执行最小移动
		// 将元素边界转换为当前缩放下的屏幕坐标系
		const elementScreenBounds = {
			left: elementBounds.x * currentScale + currentPosition.x,
			top: elementBounds.y * currentScale + currentPosition.y,
			right: (elementBounds.x + elementBounds.width) * currentScale + currentPosition.x,
			bottom: (elementBounds.y + elementBounds.height) * currentScale + currentPosition.y,
		}

		// 计算可视区域边界
		const viewportBounds = {
			left: offsetLeft + paddingLeft,
			top: offsetTop + paddingTop,
			right: stageWidth - offsetRight - paddingRight,
			bottom: stageHeight - offsetBottom - paddingBottom,
		}

		// 计算需要移动的距离
		let deltaX = 0
		let deltaY = 0

		// 检查左边界
		if (elementScreenBounds.left < viewportBounds.left) {
			deltaX = viewportBounds.left - elementScreenBounds.left
		}
		// 检查右边界
		else if (elementScreenBounds.right > viewportBounds.right) {
			deltaX = viewportBounds.right - elementScreenBounds.right
		}

		// 检查上边界
		if (elementScreenBounds.top < viewportBounds.top) {
			deltaY = viewportBounds.top - elementScreenBounds.top
		}
		// 检查下边界
		else if (elementScreenBounds.bottom > viewportBounds.bottom) {
			deltaY = viewportBounds.bottom - elementScreenBounds.bottom
		}

		// 如果不需要移动，直接返回
		if (deltaX === 0 && deltaY === 0) {
			return
		}

		// 计算新位置
		const newPosition = {
			x: currentPosition.x + deltaX,
			y: currentPosition.y + deltaY,
		}

		// 应用移动
		if (animated) {
			// 停止当前正在进行的动画
			if (this.currentTween) {
				this.currentTween.destroy()
				this.currentTween = null
			}

			const durationInSeconds = duration / 1000
			this.currentTween = new Konva.Tween({
				node: this.canvas.stage,
				duration: durationInSeconds,
				x: newPosition.x,
				y: newPosition.y,
				easing,
				onUpdate: () => {
					// 发送位置变化事件
					this.canvas.eventEmitter.emit({
						type: "viewport:pan",
						data: this.roundPosition(this.canvas.stage.position()),
					})
				},
				onFinish: () => {
					// 确保精确值
					this.canvas.stage.position(newPosition)
					this.canvas.stage.batchDraw()

					// 发送最终事件
					this.canvas.eventEmitter.emit({
						type: "viewport:pan",
						data: this.roundPosition(newPosition),
					})

					// 清理动画引用
					this.currentTween = null
				},
			})

			this.currentTween.play()
		} else {
			// 无动画，直接设置
			this.canvas.stage.position(newPosition)
			this.canvas.stage.batchDraw()

			// 发送位置变化事件
			this.canvas.eventEmitter.emit({
				type: "viewport:pan",
				data: this.roundPosition(newPosition),
			})
		}
	}
}
