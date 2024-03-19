import Konva from "konva"
import { BaseTool, type ToolOptions, ToolCompletionStrategy } from "./BaseTool"
import { MarkerTypeEnum } from "../../types"
import { AREA_MARKER_STYLES } from "../markers/markerStyles"

/**
 * MarkerTool 配置接口
 */
export interface MarkerToolOptions extends ToolOptions {}

/**
 * 标记工具 - 用于在图片上添加标记
 * 支持点击创建点标记，拖拽创建区域标记
 */
export class MarkerTool extends BaseTool {
	private mousedownHandler: ((e: Konva.KonvaEventObject<MouseEvent>) => void) | null = null
	private mousemoveHandler: ((e: Konva.KonvaEventObject<MouseEvent>) => void) | null = null
	private mouseupHandler: ((e: Konva.KonvaEventObject<MouseEvent>) => void) | null = null

	// 拖拽状态
	private isDragging = false
	private dragStartPos: { x: number; y: number } | null = null
	private dragTargetElement: { id: string } | null = null
	private previewRect: Konva.Rect | null = null

	// 预览样式配置
	private readonly PREVIEW_FILL = AREA_MARKER_STYLES.AREA_FILL_COLOR
	private readonly PREVIEW_STROKE = AREA_MARKER_STYLES.AREA_STROKE_COLOR
	private readonly PREVIEW_STROKE_WIDTH = AREA_MARKER_STYLES.AREA_STROKE_WIDTH
	private readonly PREVIEW_CORNER_RADIUS = AREA_MARKER_STYLES.AREA_CORNER_RADIUS

	constructor(options: MarkerToolOptions) {
		super(options)
	}

	/**
	 * 激活工具
	 */
	public activate(): void {
		this.isActive = true

		// 只禁用元素的拖拽功能，保持交互功能（listening）以便检测点击
		this.canvas.elementManager.disableElementDraggingOnly()

		// 监听 ESC 键取消框选
		this.canvas.eventEmitter.on("keyboard:escape", this.handleEscapeKey.bind(this))

		// 监听 mousedown 事件
		this.mousedownHandler = (e: Konva.KonvaEventObject<MouseEvent>) => {
			// 从点击的节点向上查找图片元素
			const clickedElement = this.findImageElementAt(e.target)
			if (!clickedElement) return

			// 获取点击位置（画布坐标）
			const pos = this.canvas.stage.getPointerPosition()
			if (!pos) return

			// 转换为画布坐标（考虑viewport的缩放和偏移）
			const transform = this.canvas.stage.getAbsoluteTransform().copy()
			transform.invert()
			const canvasPos = transform.point(pos)

			// 记录拖拽起点
			this.isDragging = true
			this.dragStartPos = canvasPos
			this.dragTargetElement = clickedElement
		}

		// 监听 mousemove 事件
		this.mousemoveHandler = (e: Konva.KonvaEventObject<MouseEvent>) => {
			if (!this.isDragging || !this.dragStartPos || !this.dragTargetElement) return

			// 获取当前位置
			const pos = this.canvas.stage.getPointerPosition()
			if (!pos) return

			const transform = this.canvas.stage.getAbsoluteTransform().copy()
			transform.invert()
			const canvasPos = transform.point(pos)

			// 计算拖拽距离
			const dx = canvasPos.x - this.dragStartPos.x
			const dy = canvasPos.y - this.dragStartPos.y
			const distance = Math.sqrt(dx * dx + dy * dy)

			// 如果拖拽距离超过阈值，显示预览矩形
			if (distance > 5) {
				this.showPreviewRect(this.dragStartPos, canvasPos)
			}
		}

		// 监听 mouseup 事件
		this.mouseupHandler = (e: Konva.KonvaEventObject<MouseEvent>) => {
			if (!this.isDragging || !this.dragStartPos) return

			// 获取当前位置
			const pos = this.canvas.stage.getPointerPosition()
			if (!pos) return

			const transform = this.canvas.stage.getAbsoluteTransform().copy()
			transform.invert()
			const canvasPos = transform.point(pos)

			// 计算拖拽距离
			const dx = canvasPos.x - this.dragStartPos.x
			const dy = canvasPos.y - this.dragStartPos.y
			const distance = Math.sqrt(dx * dx + dy * dy)

			// 清除预览矩形
			this.clearPreviewRect()

			if (this.dragTargetElement) {
				if (distance > 5) {
					// 拖拽距离超过阈值，创建区域标记
					this.createAreaMarker(this.dragStartPos, canvasPos, this.dragTargetElement)
				} else {
					// 拖拽距离小于阈值，创建点标记
					this.createPointMarker(this.dragStartPos, this.dragTargetElement)
				}
			}

			// 重置拖拽状态
			this.isDragging = false
			this.dragStartPos = null
			this.dragTargetElement = null
		}

		this.canvas.stage.on("mousedown", this.mousedownHandler)
		this.canvas.stage.on("mousemove", this.mousemoveHandler)
		this.canvas.stage.on("mouseup", this.mouseupHandler)
	}

	/**
	 * 停用工具
	 */
	public deactivate(): void {
		this.isActive = false

		// 恢复所有元素的拖拽功能
		this.canvas.elementManager.enableElementDragging()

		// 清除预览矩形
		this.clearPreviewRect()

		// 移除事件监听
		if (this.mousedownHandler) {
			this.canvas.stage.off("mousedown", this.mousedownHandler)
			this.mousedownHandler = null
		}
		if (this.mousemoveHandler) {
			this.canvas.stage.off("mousemove", this.mousemoveHandler)
			this.mousemoveHandler = null
		}
		if (this.mouseupHandler) {
			this.canvas.stage.off("mouseup", this.mouseupHandler)
			this.mouseupHandler = null
		}

		// 移除 ESC 键监听
		this.canvas.eventEmitter.off("keyboard:escape")

		// 重置拖拽状态
		this.isDragging = false
		this.dragStartPos = null
		this.dragTargetElement = null
	}

	/**
	 * 获取工具完成策略
	 * 标记工具在添加标记后保持激活状态，允许连续添加多个标记
	 */
	protected getCompletionStrategy(): ToolCompletionStrategy {
		return ToolCompletionStrategy.STAY_ACTIVE
	}

	/**
	 * 任务完成时的处理
	 * 添加标记后立即切换回选择工具
	 */
	protected onTaskComplete(): void {
		if (!this.canvas.toolManager) return

		// 使用 setTimeout 延迟切换工具，避免以下时序问题：
		// 1. mouseup 事件触发 → 创建 marker → 调用此方法切换工具
		// 2. 工具切换后，currentTool 变为 Select
		// 3. 原始 mouseup 事件继续冒泡 → 触发 stage 的 click 事件
		// 4. MarkerManager 的 stage click handler 检测到：
		//    - currentTool 是 Select（条件通过）
		//    - 点击目标不是 marker 节点（是图片元素）
		//    - 有 selectedMarkerId（刚创建的 marker）
		//    → 执行 deselectMarker()，导致新创建的 marker 被立即取消选中
		//
		// 通过 setTimeout(fn, 0) 将工具切换推迟到下一个事件循环：
		// - 让当前的 mouseup/click 事件完全处理完毕
		// - 然后再切换工具，避免 stage click handler 误判
		// - 确保新创建的 marker 保持选中状态（视觉上完全不透明）
		setTimeout(() => {
			// 添加标记后立即切换到选择工具
			this.canvas.toolManager.switchToSelection()
		}, 0)
	}

	/**
	 * 处理 ESC 键按下
	 * 如果正在框选，取消框选；否则让默认行为处理（切换回选择工具）
	 */
	private handleEscapeKey(): void {
		if (this.isDragging) {
			// 正在框选，取消框选
			this.clearPreviewRect()
			this.isDragging = false
			this.dragStartPos = null
			this.dragTargetElement = null
			// 阻止默认的切换工具行为
			return
		}
		// 如果没有在框选，让默认行为处理（切换回选择工具）
		// 不需要做任何事，Canvas 的 keyboard:escape 监听器会处理
	}

	/**
	 * 创建点标记
	 */
	private createPointMarker(
		canvasPos: { x: number; y: number },
		targetElement: { id: string },
	): void {
		// 使用元素实例的 getBoundingRect 方法获取实际边界（考虑 scale）
		const elementInstance = this.canvas.elementManager.getElementInstance(targetElement.id)
		if (!elementInstance) return

		const boundingRect = elementInstance.getBoundingRect()
		if (!boundingRect) return

		const elementX = boundingRect.x
		const elementY = boundingRect.y
		const elementWidth = boundingRect.width
		const elementHeight = boundingRect.height

		// 计算点击位置相对于元素的相对位置（0-1）
		const relativeX = (canvasPos.x - elementX) / elementWidth
		const relativeY = (canvasPos.y - elementY) / elementHeight

		// 在该位置添加点标记
		const success = this.canvas.markerManager.addMarker(
			targetElement.id,
			relativeX,
			relativeY,
			MarkerTypeEnum.Mark,
		)

		// 只有成功添加标记后才切回选择工具
		if (success) {
			this.onTaskComplete()
		}
	}

	/**
	 * 创建区域标记
	 */
	private createAreaMarker(
		startPos: { x: number; y: number },
		endPos: { x: number; y: number },
		targetElement: { id: string },
	): void {
		// 使用元素实例的 getBoundingRect 方法获取实际边界（考虑 scale）
		const elementInstance = this.canvas.elementManager.getElementInstance(targetElement.id)
		if (!elementInstance) return

		const boundingRect = elementInstance.getBoundingRect()
		if (!boundingRect) return

		const elementX = boundingRect.x
		const elementY = boundingRect.y
		const elementWidth = boundingRect.width
		const elementHeight = boundingRect.height

		// 计算区域的左上角和右下角
		const x1 = Math.min(startPos.x, endPos.x)
		const y1 = Math.min(startPos.y, endPos.y)
		const x2 = Math.max(startPos.x, endPos.x)
		const y2 = Math.max(startPos.y, endPos.y)

		// 限制在元素边界内
		const clampedX1 = Math.max(elementX, x1)
		const clampedY1 = Math.max(elementY, y1)
		const clampedX2 = Math.min(elementX + elementWidth, x2)
		const clampedY2 = Math.min(elementY + elementHeight, y2)

		// 计算相对位置和尺寸（0-1）
		const relativeX = (clampedX1 - elementX) / elementWidth
		const relativeY = (clampedY1 - elementY) / elementHeight
		const areaWidth = (clampedX2 - clampedX1) / elementWidth
		const areaHeight = (clampedY2 - clampedY1) / elementHeight

		// 确保区域有最小尺寸
		if (areaWidth < 0.01 || areaHeight < 0.01) {
			// 区域太小，创建点标记
			this.createPointMarker(startPos, targetElement)
			return
		}

		// 在该位置添加区域标记
		const success = this.canvas.markerManager.addMarker(
			targetElement.id,
			relativeX,
			relativeY,
			MarkerTypeEnum.Area,
			areaWidth,
			areaHeight,
		)

		// 只有成功添加标记后才切回选择工具
		if (success) {
			this.onTaskComplete()
		}
	}

	/**
	 * 显示预览矩形
	 */
	private showPreviewRect(
		startPos: { x: number; y: number },
		endPos: { x: number; y: number },
	): void {
		// 计算矩形位置和尺寸（画布坐标系）
		const x = Math.min(startPos.x, endPos.x)
		const y = Math.min(startPos.y, endPos.y)
		const width = Math.abs(endPos.x - startPos.x)
		const height = Math.abs(endPos.y - startPos.y)

		// 获取 viewport 缩放
		const viewportScale = this.canvas.stage.scaleX()
		const inverseScale = 1 / viewportScale

		if (!this.previewRect) {
			// 创建预览矩形，使用与 AreaMarker 相同的样式
			// 注意：宽度和高度需要乘以 viewportScale，因为后面会应用 inverseScale
			this.previewRect = new Konva.Rect({
				x,
				y,
				width: width * viewportScale,
				height: height * viewportScale,
				fill: this.PREVIEW_FILL,
				stroke: this.PREVIEW_STROKE,
				strokeWidth: this.PREVIEW_STROKE_WIDTH,
				cornerRadius: this.PREVIEW_CORNER_RADIUS,
				listening: false,
				name: "marker-preview-rect",
				scaleX: inverseScale,
				scaleY: inverseScale,
			})
			// 添加到 markersLayer，确保在正确的层级
			this.canvas.markersLayer.add(this.previewRect)
			this.previewRect.moveToTop()
		} else {
			// 更新预览矩形位置和尺寸
			// 宽度和高度需要乘以 viewportScale
			this.previewRect.setAttrs({
				x,
				y,
				width: width * viewportScale,
				height: height * viewportScale,
				scaleX: inverseScale,
				scaleY: inverseScale,
			})
		}

		this.canvas.markersLayer.batchDraw()
	}

	/**
	 * 清除预览矩形
	 */
	private clearPreviewRect(): void {
		if (this.previewRect) {
			this.previewRect.destroy()
			this.previewRect = null
			this.canvas.markersLayer.batchDraw()
		}
	}

	/**
	 * 查找指定位置的图片元素
	 * 从点击的节点向上查找，找到图片元素节点
	 */
	private findImageElementAt(clickedNode: Konva.Node): { id: string } | null {
		// 从点击的节点向上查找，直到找到图片元素
		let currentNode: Konva.Node | null = clickedNode

		while (currentNode) {
			// 排除 Stage 和 Layer
			if (currentNode === this.canvas.stage || currentNode.getClassName() === "Layer") {
				break
			}

			// 排除 Transformer 及其子元素
			if (
				currentNode.getClassName() === "Transformer" ||
				currentNode.getParent()?.getClassName() === "Transformer"
			) {
				currentNode = currentNode.getParent()
				continue
			}

			// 排除 marker 节点
			if (currentNode.name() === "marker") {
				currentNode = currentNode.getParent()
				continue
			}

			// 获取节点对应的元素 ID
			let elementId = currentNode.id()

			// 如果当前节点没有 ID，但它是 hit-area 且父节点是 Group，使用父节点的 ID
			if (
				!elementId &&
				currentNode.name() === "hit-area" &&
				currentNode.getParent() instanceof Konva.Group
			) {
				const parent = currentNode.getParent()
				if (parent) {
					elementId = parent.id()
				}
			}

			// 如果有 ID 且是 ElementManager 管理的元素
			if (elementId && this.canvas.elementManager.hasElement(elementId)) {
				// 获取元素数据
				const element = this.canvas.elementManager.getElementData(elementId)
				if (element && element.type === "image") {
					// 使用 PermissionManager 统一判断元素是否可以被添加标记
					// 需要元素可见且未锁定
					if (
						this.canvas.permissionManager.isVisible(element) &&
						!this.canvas.permissionManager.isLocked(element)
					) {
						// 检查图片是否有 src 且已加载完成
						if (element.src) {
							const elementInstance =
								this.canvas.elementManager.getElementInstance(elementId)
							if (
								elementInstance &&
								"isImageLoaded" in elementInstance &&
								typeof elementInstance.isImageLoaded === "function" &&
								elementInstance.isImageLoaded()
							) {
								return { id: elementId }
							}
						}
					}
				}
			}

			// 继续向上查找
			currentNode = currentNode.getParent()
		}

		return null
	}

	/**
	 * 获取工具元数据
	 */
	public getMetadata() {
		return {
			name: "Marker Tool",
			cursor: "crosshair" as const,
			isTemporary: false,
		}
	}

	/**
	 * 销毁工具
	 */
	public destroy(): void {
		this.deactivate()
	}
}
