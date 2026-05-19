import Konva from "konva"
import { hasModKey } from "./shortcuts/modifierUtils"
import type { Canvas } from "../Canvas"
import type {
	PaddingInsetConfig,
	PaddingInsetValue,
	ViewportPaddingAlignment,
	ViewportPaddingInsets,
} from "../types"
import {
	getViewportSnapshot,
	zoomByFactorAtAnchor,
	zoomToScaleAtAnchor,
	zoomByWheelDeltaAtAnchor,
	type ZoomPending,
	type ViewportPoint,
	type ViewportSnapshot,
} from "./viewport/ViewportZoomEngine"
import {
	WEBKIT_GESTURE_EVENTS,
	createWebKitGesturePinchState,
	getContainerRelativePoint,
	getTouchCenter,
	getTouchDistance,
	getWebKitGestureScaleFactor,
	offsetPanPosition,
	type WebKitGestureEventLike,
	type WebKitGesturePinchState,
} from "./viewport/ViewportInputAdapters"
import { createLeadingRafThrottle } from "../utils/leadingRafThrottle"
import { normalizePosition } from "../utils/normalizeUtils"
import { getNextZoomScale } from "./viewport-zoom"

type PanPending = { x: number; y: number }
type ViewportBoundingRect = { x: number; y: number; width: number; height: number }

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

	private defaultViewportPadding: PaddingInsetConfig = {
		top: 50,
		right: 50,
		bottom: 50,
		left: 50,
	}

	/** 将预留值解析为像素（支持数字或百分比字符串） */
	private resolveInsetValue(value: PaddingInsetValue | undefined, reference: number): number {
		if (value === undefined) return 0
		if (typeof value === "string" && value.endsWith("%")) {
			const percentage = parseFloat(value)
			return (reference * percentage) / 100
		}
		return value as number
	}

	/**
	 * 单边预留约束：优先级 max > min > normal（冲突时 max 优先）。
	 * 先以 normal 为基准，再应用 min 下限，最后应用 max 上限。
	 */
	private clampInset(
		normal: number,
		minVal: number | undefined,
		maxVal: number | undefined,
	): number {
		if (maxVal !== undefined && minVal !== undefined && minVal > maxVal) {
			return maxVal
		}
		const afterMin = minVal !== undefined ? Math.max(normal, minVal) : normal
		return maxVal !== undefined ? Math.min(afterMin, maxVal) : afterMin
	}

	private addOptionalInset(
		base: number | undefined,
		extra: number | undefined,
	): number | undefined {
		if (base === undefined && extra === undefined) {
			return undefined
		}

		return (base ?? 0) + (extra ?? 0)
	}

	private resolvePaddingSource(
		padding: PaddingInsetConfig | undefined,
		stageWidth: number,
		stageHeight: number,
	): {
		left?: number
		right?: number
		top?: number
		bottom?: number
		minLeft?: number
		minRight?: number
		minTop?: number
		minBottom?: number
		maxLeft?: number
		maxRight?: number
		maxTop?: number
		maxBottom?: number
	} {
		if (!padding) {
			return {}
		}

		return {
			left:
				padding.left !== undefined
					? this.resolveInsetValue(padding.left, stageWidth)
					: undefined,
			right:
				padding.right !== undefined
					? this.resolveInsetValue(padding.right, stageWidth)
					: undefined,
			top:
				padding.top !== undefined
					? this.resolveInsetValue(padding.top, stageHeight)
					: undefined,
			bottom:
				padding.bottom !== undefined
					? this.resolveInsetValue(padding.bottom, stageHeight)
					: undefined,
			minLeft:
				padding.minLeft !== undefined
					? this.resolveInsetValue(padding.minLeft, stageWidth)
					: undefined,
			minRight:
				padding.minRight !== undefined
					? this.resolveInsetValue(padding.minRight, stageWidth)
					: undefined,
			minTop:
				padding.minTop !== undefined
					? this.resolveInsetValue(padding.minTop, stageHeight)
					: undefined,
			minBottom:
				padding.minBottom !== undefined
					? this.resolveInsetValue(padding.minBottom, stageHeight)
					: undefined,
			maxLeft:
				padding.maxLeft !== undefined
					? this.resolveInsetValue(padding.maxLeft, stageWidth)
					: undefined,
			maxRight:
				padding.maxRight !== undefined
					? this.resolveInsetValue(padding.maxRight, stageWidth)
					: undefined,
			maxTop:
				padding.maxTop !== undefined
					? this.resolveInsetValue(padding.maxTop, stageHeight)
					: undefined,
			maxBottom:
				padding.maxBottom !== undefined
					? this.resolveInsetValue(padding.maxBottom, stageHeight)
					: undefined,
		}
	}

	/**
	 * 解析 viewportPadding：默认占位与调用方 padding 统一叠加，再应用 min/max 约束。
	 * @param stageWidth - 用于解析 left/right/minLeft/minRight/maxLeft/maxRight 的参考宽度
	 * @param stageHeight - 用于解析 top/bottom/minTop/minBottom/maxTop/maxBottom 的参考高度
	 */
	private getEffectiveViewportPadding(
		padding: PaddingInsetConfig | undefined,
		stageWidth: number,
		stageHeight: number,
	): { left: number; right: number; top: number; bottom: number } {
		const defaultInsets = this.resolvePaddingSource(
			this.defaultViewportPadding,
			stageWidth,
			stageHeight,
		)
		const requestInsets = this.resolvePaddingSource(padding, stageWidth, stageHeight)

		const leftVal = this.addOptionalInset(defaultInsets.left, requestInsets.left) ?? 0
		const leftMin = this.addOptionalInset(defaultInsets.minLeft, requestInsets.minLeft)
		const leftMax = this.addOptionalInset(defaultInsets.maxLeft, requestInsets.maxLeft)
		const left = this.clampInset(leftVal, leftMin, leftMax)

		const rightVal = this.addOptionalInset(defaultInsets.right, requestInsets.right) ?? 0
		const rightMin = this.addOptionalInset(defaultInsets.minRight, requestInsets.minRight)
		const rightMax = this.addOptionalInset(defaultInsets.maxRight, requestInsets.maxRight)
		const right = this.clampInset(rightVal, rightMin, rightMax)

		const topVal = this.addOptionalInset(defaultInsets.top, requestInsets.top) ?? 0
		const topMin = this.addOptionalInset(defaultInsets.minTop, requestInsets.minTop)
		const topMax = this.addOptionalInset(defaultInsets.maxTop, requestInsets.maxTop)
		const top = this.clampInset(topVal, topMin, topMax)

		const bottomVal = this.addOptionalInset(defaultInsets.bottom, requestInsets.bottom) ?? 0
		const bottomMin = this.addOptionalInset(defaultInsets.minBottom, requestInsets.minBottom)
		const bottomMax = this.addOptionalInset(defaultInsets.maxBottom, requestInsets.maxBottom)
		const bottom = this.clampInset(bottomVal, bottomMin, bottomMax)

		return { left, right, top, bottom }
	}

	private static hasHorizontalPaddingConfig(config: PaddingInsetConfig | undefined): boolean {
		if (!config) return false
		return [
			config.left,
			config.right,
			config.minLeft,
			config.minRight,
			config.maxLeft,
			config.maxRight,
		].some((v) => v !== undefined)
	}

	private static hasVerticalPaddingConfig(config: PaddingInsetConfig | undefined): boolean {
		if (!config) return false
		return [
			config.top,
			config.bottom,
			config.minTop,
			config.minBottom,
			config.maxTop,
			config.maxBottom,
		].some((v) => v !== undefined)
	}

	/**
	 * 根据 padding 配置与解析后的 insets 返回智能对齐规则。
	 * 当水平、垂直都有配置且传入 insets 时，根据两侧 inset 大小推导：inset 更小的一侧贴边，相等则居中。
	 */
	getPaddingAlignment(
		padding: PaddingInsetConfig | undefined,
		insets?: ViewportPaddingInsets,
	): ViewportPaddingAlignment {
		const hasH = ViewportController.hasHorizontalPaddingConfig(padding)
		const hasV = ViewportController.hasVerticalPaddingConfig(padding)
		if (hasH && hasV) {
			if (insets) {
				const horizontal: ViewportPaddingAlignment["horizontal"] =
					insets.right < insets.left
						? "right"
						: insets.left < insets.right
							? "left"
							: "center"
				const vertical: ViewportPaddingAlignment["vertical"] =
					insets.bottom < insets.top
						? "bottom"
						: insets.top < insets.bottom
							? "top"
							: "center"
				return { horizontal, vertical }
			}
			return { horizontal: "left", vertical: "top" }
		}
		if (hasH) return { horizontal: "left", vertical: "center" }
		if (hasV) return { horizontal: "center", vertical: "top" }
		return { horizontal: "center", vertical: "center" }
	}

	private scale = 1
	private minScale = 0.001
	private maxScale = 5
	private scaleStep = 0.1

	private getActiveMinScale(): number {
		return Math.min(this.minScale, this.scale)
	}

	// 触摸缩放相关
	private lastTouchPinchDistance = 0
	private isTouchPinching = false

	// 触摸平移相关
	private isTouchPanning = false
	private touchStartPosition: { x: number; y: number } | null = null
	private stageStartPosition: { x: number; y: number } | null = null
	private touchStartTime = 0
	private readonly TOUCH_MOVE_THRESHOLD = 10 // 移动阈值，避免误触

	// 动画相关
	private currentTween: Konva.Tween | null = null

	// 触摸事件处理器引用
	private touchEventHandlers: TouchEventHandlers | null = null

	/** 桌面 WebKit 触控板捏合进行中时为非 null */
	private activeWebKitGesturePinch: WebKitGesturePinchState | null = null

	private webKitGestureHandler: ((e: Event) => void) | null = null

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

	private getZoomViewportSnapshot(): ViewportSnapshot {
		return getViewportSnapshot(this.canvas.stage, this.zoomThrottle.getPending())
	}

	private getCurrentPanPosition(): PanPending {
		const position = this.panThrottle.getPending() ?? this.canvas.stage.position()
		return { x: position.x, y: position.y }
	}

	private queuePanPosition(position: PanPending): void {
		this.panThrottle.processEvent(position)
	}

	private queueZoomUpdate(update: ZoomPending): void {
		this.zoomThrottle.processEvent(update)
	}

	private zoomByFactorAt(anchor: ViewportPoint, scaleFactor: number): void {
		this.queueZoomUpdate(
			zoomByFactorAtAnchor(
				this.getZoomViewportSnapshot(),
				anchor,
				scaleFactor,
				this.getActiveMinScale(),
				this.maxScale,
			),
		)
	}

	private zoomByWheelDelta(e: WheelEvent): void {
		this.queueZoomUpdate(
			zoomByWheelDeltaAtAnchor(
				this.getZoomViewportSnapshot(),
				getContainerRelativePoint(this.canvas.stage, e.clientX, e.clientY),
				e.deltaY,
				this.getActiveMinScale(),
				this.maxScale,
			),
		)
	}

	private handleWheelInput(e: WheelEvent): void {
		// 桌面 WebKit 捏合会同时产生无 ctrlKey 的 wheel，已由 gesture* 处理，此处避免当成平移
		if (this.activeWebKitGesturePinch !== null) {
			e.preventDefault()
			return
		}

		if (this.isPanZoomDisabled) {
			return
		}

		e.preventDefault()

		if (hasModKey(e)) {
			this.zoomByWheelDelta(e)
			return
		}

		this.queuePanPosition(offsetPanPosition(this.getCurrentPanPosition(), e.deltaX, e.deltaY))
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
	 * 应用视口变换（缩放和位置）到指定的边界框
	 * @param boundingBox - 目标区域的边界框
	 * @param options - 配置选项
	 * @param onComplete - 完成回调（用于选中元素等后续操作）
	 */
	private applyViewportTransform(
		boundingBox: { x: number; y: number; width: number; height: number },
		options: {
			padding?: PaddingInsetConfig
			animated: boolean
			duration: number
			easing: (t: number, b: number, c: number, d: number) => number
			panOnly?: boolean
			ensureFullyVisible?: boolean
			allowBelowMinScale?: boolean
		},
		onComplete?: () => void,
	): void {
		const {
			padding,
			animated,
			duration,
			easing,
			panOnly = false,
			ensureFullyVisible = true,
			allowBelowMinScale = false,
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

		// 解析视口预留（数字或百分比），并应用 min* 下限
		const {
			left: insetLeft,
			right: insetRight,
			top: insetTop,
			bottom: insetBottom,
		} = this.getEffectiveViewportPadding(padding, stageWidth, stageHeight)

		// 确保有效尺寸为正数
		const effectiveWidth = Math.max(100, stageWidth - insetLeft - insetRight)
		const effectiveHeight = Math.max(100, stageHeight - insetTop - insetBottom)

		// 计算在当前缩放级别下，元素在屏幕坐标系中的边界
		const currentScale = this.scale
		const currentPosition = this.canvas.stage.position()

		const elementScreenBounds = {
			left: boundingBox.x * currentScale + currentPosition.x,
			top: boundingBox.y * currentScale + currentPosition.y,
			right: (boundingBox.x + boundingBox.width) * currentScale + currentPosition.x,
			bottom: (boundingBox.y + boundingBox.height) * currentScale + currentPosition.y,
		}

		// 可视区域边界（即视口预留后的区域）
		const viewportBounds = {
			left: insetLeft,
			top: insetTop,
			right: stageWidth - insetRight,
			bottom: stageHeight - insetBottom,
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
			const minScale = allowBelowMinScale ? 0 : this.minScale
			return Math.max(minScale, Math.min(this.maxScale, newScale))
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

		// 按智能对齐规则在有效视口区域内定位
		const availableWidth = stageWidth - insetLeft - insetRight
		const availableHeight = stageHeight - insetTop - insetBottom
		const alignment = this.getPaddingAlignment(padding, {
			left: insetLeft,
			right: insetRight,
			top: insetTop,
			bottom: insetBottom,
		})

		const newX =
			alignment.horizontal === "center"
				? insetLeft +
					(availableWidth - boundingBox.width * finalScale) / 2 -
					boundingBox.x * finalScale
				: alignment.horizontal === "right"
					? stageWidth - insetRight - (boundingBox.x + boundingBox.width) * finalScale
					: insetLeft - boundingBox.x * finalScale
		const newY =
			alignment.vertical === "center"
				? insetTop +
					(availableHeight - boundingBox.height * finalScale) / 2 -
					boundingBox.y * finalScale
				: alignment.vertical === "bottom"
					? stageHeight - insetBottom - (boundingBox.y + boundingBox.height) * finalScale
					: insetTop - boundingBox.y * finalScale

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

		// 视口缩放/平移节流配置写死在本类（如需限频可在此增加 maxFps）
		this.zoomThrottle = createLeadingRafThrottle<ZoomPending>((v) => this.applyZoomUpdate(v), {
			enabled: true,
			leading: true,
		})
		this.panThrottle = createLeadingRafThrottle<PanPending>((v) => this.applyPanUpdate(v), {
			enabled: true,
			leading: true,
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
		this.setupWebKitGesturePinch()
		this.setupTouchEvents()
	}

	/** 桌面 Safari 等：触控板捏合走 gesture 的 scale，需在非移动端单独处理 */
	private setupWebKitGesturePinch(): void {
		if (this.canvas.isMobileDevice) {
			return
		}

		const container = this.canvas.stage.container()
		this.webKitGestureHandler = (e: Event) => {
			const gestureEvent = e as WebKitGestureEventLike

			if (this.isPanZoomDisabled) {
				return
			}

			if (e.type === "gesturestart") {
				e.preventDefault()
				this.activeWebKitGesturePinch = createWebKitGesturePinchState(
					this.canvas.stage,
					gestureEvent,
					this.getZoomViewportSnapshot(),
				)
				return
			}

			if (!this.activeWebKitGesturePinch) {
				e.preventDefault()
				return
			}

			if (e.type === "gesturechange") {
				e.preventDefault()
				const pinch = this.activeWebKitGesturePinch
				this.queueZoomUpdate(
					zoomByFactorAtAnchor(
						pinch.viewport,
						pinch.anchor,
						getWebKitGestureScaleFactor(gestureEvent, pinch),
						this.getActiveMinScale(),
						this.maxScale,
					),
				)
				return
			}

			// gestureend / gesturecancel
			e.preventDefault()
			this.zoomThrottle.flush()
			this.activeWebKitGesturePinch = null
		}

		const handler = this.webKitGestureHandler
		for (const t of WEBKIT_GESTURE_EVENTS) {
			container.addEventListener(t, handler, { passive: false })
		}
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
			this.handleWheelInput(e.evt)
		})
	}

	/**
	 * 处理来自悬浮组件的 wheel 事件
	 * 公开方法，供 FloatingUIContext 调用
	 */
	public handleWheelFromFloating(e: WheelEvent): void {
		this.handleWheelInput(e)
	}

	/**
	 * 设置触摸事件（包括单指平移和双指缩放）
	 */
	private setupTouchEvents(): void {
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
				this.isTouchPinching = true

				const touch1 = touches[0]
				const touch2 = touches[1]

				this.lastTouchPinchDistance = getTouchDistance(touch1, touch2)
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
				!this.isTouchPinching &&
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
					this.queuePanPosition(newPos)
				}
			} else if (touches.length === 2 && this.isTouchPinching) {
				// 双指移动：处理缩放
				if (e.cancelable) {
					e.preventDefault()
				}

				const touch1 = touches[0]
				const touch2 = touches[1]
				const currentDistance = getTouchDistance(touch1, touch2)
				const currentCenter = getTouchCenter(this.canvas.stage, touch1, touch2)

				if (this.lastTouchPinchDistance > 0) {
					const scale = currentDistance / this.lastTouchPinchDistance
					this.zoomByFactorAt(currentCenter, scale)
				}

				this.lastTouchPinchDistance = currentDistance
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
				if (this.isTouchPinching) {
					this.isTouchPinching = false
					this.lastTouchPinchDistance = 0
					this.zoomThrottle.flush()
				}
			} else if (touches.length === 1 && this.isTouchPinching) {
				// 从双指变为单指：结束缩放，立即应用待处理状态
				this.isTouchPinching = false
				this.lastTouchPinchDistance = 0
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
			if (this.isTouchPinching) {
				this.zoomThrottle.flush()
			}
			this.isTouchPinching = false
			this.lastTouchPinchDistance = 0
			hasMoved = false
		}

		// 添加原生事件监听器，使用 passive: false 以支持 preventDefault
		container.addEventListener("touchstart", handleTouchStart, { passive: false })
		container.addEventListener("touchmove", handleTouchMove, { passive: false })
		container.addEventListener("touchend", handleTouchEnd, { passive: false })
		container.addEventListener("touchcancel", handleTouchCancel, { passive: false })

		// 保存引用以便后续清理
		this.touchEventHandlers = {
			handleTouchStart,
			handleTouchMove,
			handleTouchEnd,
			handleTouchCancel,
		}
	}

	/**
	 * 放大
	 */
	public zoomIn(): void {
		const newScale = getNextZoomScale({
			state: {
				rawScale: this.scale,
				fitScale: this.getFitToScreenScale(),
				minScale: this.getActiveMinScale(),
				maxScale: this.maxScale,
			},
			mode: "absolute-scale",
			direction: 1,
			scaleStep: this.scaleStep,
		})
		this.setScale(newScale)
	}

	/**
	 * 缩小
	 */
	public zoomOut(): void {
		const newScale = getNextZoomScale({
			state: {
				rawScale: this.scale,
				fitScale: this.getFitToScreenScale(),
				minScale: this.getActiveMinScale(),
				maxScale: this.maxScale,
			},
			mode: "absolute-scale",
			direction: -1,
			scaleStep: this.scaleStep,
		})
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
		const clampedScale = Math.max(this.getActiveMinScale(), Math.min(this.maxScale, scale))

		// 如果没有指定中心点，使用画布中心
		const centerPoint = center || {
			x: this.canvas.stage.width() / 2,
			y: this.canvas.stage.height() / 2,
		}

		const nextViewport = zoomToScaleAtAnchor(
			getViewportSnapshot(this.canvas.stage, null),
			centerPoint,
			clampedScale,
		)

		this.scale = clampedScale
		this.canvas.stage.scale({ x: clampedScale, y: clampedScale })
		this.canvas.stage.position(nextViewport.position)
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
	 * 获取当前内容层在画布坐标系中的边界。
	 */
	private getContentBoundingRect(): ViewportBoundingRect | null {
		const rect = this.canvas.geometryCacheManager.getAllElementsBounds()
		if (!rect || rect.width === 0 || rect.height === 0) {
			return null
		}

		return rect
	}

	/**
	 * 计算指定边界在当前视口下的适配缩放。
	 */
	private calculateFitScaleForRect(
		boundingBox: ViewportBoundingRect,
		padding?: PaddingInsetConfig,
	): number {
		const stageWidth = this.canvas.stage.width()
		const stageHeight = this.canvas.stage.height()
		const {
			left: insetLeft,
			right: insetRight,
			top: insetTop,
			bottom: insetBottom,
		} = this.getEffectiveViewportPadding(padding, stageWidth, stageHeight)

		const effectiveWidth = Math.max(100, stageWidth - insetLeft - insetRight)
		const effectiveHeight = Math.max(100, stageHeight - insetTop - insetBottom)
		const scaleX = effectiveWidth / boundingBox.width
		const scaleY = effectiveHeight / boundingBox.height
		const fitScale = Math.min(scaleX, scaleY)

		return Math.max(this.minScale, Math.min(this.maxScale, fitScale))
	}

	/**
	 * 获取当前内容适配到屏幕时的基准缩放
	 * 无内容时返回 1，便于 UI 使用 100% 作为默认值
	 */
	public getFitToScreenScale(options?: { padding?: PaddingInsetConfig }): number {
		const boundingBox = this.getContentBoundingRect()
		if (!boundingBox) {
			return 1
		}

		return this.calculateFitScaleForRect(boundingBox, options?.padding)
	}

	/**
	 * 聚焦到指定元素（支持单个或多个元素）
	 * @param elementIds - 要聚焦的元素 ID 数组
	 * @param options - 配置选项
	 */
	public focusOnElements(
		elementIds: string[],
		options?: {
			padding?: PaddingInsetConfig
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
			padding,
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

		const boundingBox = this.canvas.elementManager
			.getNodeAdapter()
			.getElementsBounds(elementIds)
		if (!boundingBox || boundingBox.width === 0 || boundingBox.height === 0) {
			return
		}

		// 应用视口变换
		this.applyViewportTransform(
			boundingBox,
			{
				padding,
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
		padding?: PaddingInsetConfig
		animated?: boolean
		duration?: number
		easing?: (t: number, b: number, c: number, d: number) => number
	}): void {
		const {
			padding,
			animated = false,
			duration = 300,
			easing = Konva.Easings.EaseInOut,
		} = options || {}

		const boundingBox = this.getContentBoundingRect()
		if (!boundingBox) {
			return
		}

		// 应用视口变换
		this.applyViewportTransform(boundingBox, {
			padding,
			animated,
			duration,
			easing,
			allowBelowMinScale: true,
			ensureFullyVisible: false,
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
		if (this.webKitGestureHandler) {
			const handler = this.webKitGestureHandler
			for (const t of WEBKIT_GESTURE_EVENTS) {
				container.removeEventListener(t, handler)
			}
			this.webKitGestureHandler = null
		}
		this.activeWebKitGesturePinch = null
		if (this.touchEventHandlers) {
			container.removeEventListener("touchstart", this.touchEventHandlers.handleTouchStart)
			container.removeEventListener("touchmove", this.touchEventHandlers.handleTouchMove)
			container.removeEventListener("touchend", this.touchEventHandlers.handleTouchEnd)
			container.removeEventListener("touchcancel", this.touchEventHandlers.handleTouchCancel)
			this.touchEventHandlers = null
		}

		// 清理状态
		this.isTouchPinching = false
		this.lastTouchPinchDistance = 0
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
	 * 设置默认视口预留（支持数字与百分比字符串）
	 */
	setDefaultViewportPadding(padding: PaddingInsetConfig): void {
		this.defaultViewportPadding = padding
	}

	/**
	 * 获取默认视口预留配置
	 */
	getDefaultViewportPadding(): PaddingInsetConfig | undefined {
		return this.defaultViewportPadding
	}

	/**
	 * 获取已解析为像素的默认视口预留（用于外部需要数值的场景）
	 * @param width - 参考宽度（用于 left/right/minLeft/minRight/maxLeft/maxRight）
	 * @param height - 参考高度（用于 top/bottom/minTop/minBottom/maxTop/maxBottom）
	 */
	getResolvedDefaultViewportPadding(
		width: number,
		height: number,
	): { left: number; right: number; top: number; bottom: number } {
		const resolved = this.resolvePaddingSource(this.defaultViewportPadding, width, height)
		return {
			left: this.clampInset(resolved.left ?? 0, resolved.minLeft, resolved.maxLeft),
			right: this.clampInset(resolved.right ?? 0, resolved.minRight, resolved.maxRight),
			top: this.clampInset(resolved.top ?? 0, resolved.minTop, resolved.maxTop),
			bottom: this.clampInset(resolved.bottom ?? 0, resolved.minBottom, resolved.maxBottom),
		}
	}

	/**
	 * 判断元素是否完全在可视区域内
	 * @param elementIds - 要检查的元素 ID 数组
	 * @param options - 配置选项
	 * @returns 元素是否完全在可视区域内
	 */
	public isElementInViewport(
		elementIds: string[],
		options?: { padding?: PaddingInsetConfig },
	): boolean {
		const { padding } = options || {}

		if (elementIds.length === 0) {
			return false
		}

		const adapter = this.canvas.elementManager.getNodeAdapter()
		const elementBounds = adapter.getElementsBounds(elementIds)
		if (!elementBounds || elementBounds.width === 0 || elementBounds.height === 0) {
			return false
		}

		const currentScale = this.canvas.stage.scaleX()
		const currentPosition = this.canvas.stage.position()

		// 将元素边界转换为屏幕坐标系
		const elementScreenBounds = {
			left: elementBounds.x * currentScale + currentPosition.x,
			top: elementBounds.y * currentScale + currentPosition.y,
			right: (elementBounds.x + elementBounds.width) * currentScale + currentPosition.x,
			bottom: (elementBounds.y + elementBounds.height) * currentScale + currentPosition.y,
		}

		// 获取 stage 尺寸并解析视口预留
		const stageWidth = this.canvas.stage.width()
		const stageHeight = this.canvas.stage.height()
		const {
			left: insetLeft,
			right: insetRight,
			top: insetTop,
			bottom: insetBottom,
		} = this.getEffectiveViewportPadding(padding, stageWidth, stageHeight)

		const viewportBounds = {
			left: insetLeft,
			top: insetTop,
			right: stageWidth - insetRight,
			bottom: stageHeight - insetBottom,
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
			padding?: PaddingInsetConfig
			animated?: boolean
			duration?: number
			easing?: (t: number, b: number, c: number, d: number) => number
		},
	): void {
		const {
			padding,
			animated = true,
			duration = 300,
			easing = Konva.Easings.EaseInOut,
		} = options || {}

		if (elementIds.length === 0) {
			return
		}

		const adapter = this.canvas.elementManager.getNodeAdapter()
		const elementBounds = adapter.getElementsBounds(elementIds)
		if (!elementBounds || elementBounds.width === 0 || elementBounds.height === 0) {
			return
		}

		const currentScale = this.canvas.stage.scaleX()
		const currentPosition = this.canvas.stage.position()

		// 获取 stage 尺寸并解析视口预留
		const stageWidth = this.canvas.stage.width()
		const stageHeight = this.canvas.stage.height()
		const {
			left: insetLeft,
			right: insetRight,
			top: insetTop,
			bottom: insetBottom,
		} = this.getEffectiveViewportPadding(padding, stageWidth, stageHeight)

		const effectiveWidth = Math.max(100, stageWidth - insetLeft - insetRight)
		const effectiveHeight = Math.max(100, stageHeight - insetTop - insetBottom)

		// 判断元素是否需要缩放才能完全显示
		const scaleX = effectiveWidth / elementBounds.width
		const scaleY = effectiveHeight / elementBounds.height
		const requiredScale = Math.min(scaleX, scaleY)

		// 如果元素太大，需要缩放+居中
		if (requiredScale < currentScale) {
			this.applyViewportTransform(elementBounds, {
				padding,
				animated,
				duration,
				easing,
			})
			return
		}

		// 元素可以完全显示，执行最小移动
		const elementScreenBounds = {
			left: elementBounds.x * currentScale + currentPosition.x,
			top: elementBounds.y * currentScale + currentPosition.y,
			right: (elementBounds.x + elementBounds.width) * currentScale + currentPosition.x,
			bottom: (elementBounds.y + elementBounds.height) * currentScale + currentPosition.y,
		}

		const viewportBounds = {
			left: insetLeft,
			top: insetTop,
			right: stageWidth - insetRight,
			bottom: stageHeight - insetBottom,
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
