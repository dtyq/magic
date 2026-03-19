import Konva from "konva"
import type { ToolOptions } from "./BaseTool"
import { BaseTool } from "./BaseTool"
import type { LayerElement } from "../../types"
import { isMultiSelectEvent } from "../shortcuts/modifierUtils"

/**
 * 选择工具 - 提供框选功能
 */
export class SelectionTool extends BaseTool {
	// 框选状态
	private isSelecting = false
	private toolSelectionRect: Konva.Rect | null = null
	private startPoint: { x: number; y: number } | null = null
	private isMultiSelectMode = false // 记录是否是多选模式（按住 Cmd/Ctrl）
	private readonly TOOL_SELECTION_FILL = "rgba(0, 112, 255, 0.05)"
	private readonly TOOL_SELECTION_STROKE = "#3B82F6"
	private readonly TOOL_SELECTION_STROKE_WIDTH = 1

	// 边缘滚动相关
	private edgeScrollAnimationFrame: number | null = null
	private readonly EDGE_SCROLL_THRESHOLD = 50 // 边缘触发滚动的距离（像素）
	private readonly EDGE_SCROLL_SPEED = 5 // 滚动速度（像素/帧）

	constructor(options: ToolOptions) {
		super(options)

		// 绑定事件处理函数
		this.handleMouseDown = this.handleMouseDown.bind(this)
		this.handleMouseMove = this.handleMouseMove.bind(this)
		this.handleMouseUp = this.handleMouseUp.bind(this)
		this.handleWindowMouseUp = this.handleWindowMouseUp.bind(this)
		this.handleWindowMouseMove = this.handleWindowMouseMove.bind(this)
		this.handleElementsDragStart = this.handleElementsDragStart.bind(this)
	}

	/**
	 * 激活工具
	 */
	public activate(): void {
		if (this.isActive) return
		this.isActive = true

		// 禁用 stage 的拖拽功能，避免与选择工具冲突
		this.canvas.stage.draggable(false)

		this.setupEventListeners()
	}

	/**
	 * 停用工具
	 */
	public deactivate(): void {
		if (!this.isActive) return
		this.isActive = false
		this.removeEventListeners()
		this.clearToolSelectionRect()
		this.stopEdgeScroll()

		// 注意：不恢复 draggable，因为可能由其他工具控制
	}

	/**
	 * 设置事件监听器
	 */
	private setupEventListeners(): void {
		this.canvas.stage.on("mousedown", this.handleMouseDown)
		this.canvas.stage.on("mousemove", this.handleMouseMove)
		this.canvas.stage.on("mouseup", this.handleMouseUp)
		// 监听元素拖动开始事件，当元素开始拖动时清除框选矩形
		this.canvas.eventEmitter.on("elements:transform:dragstart", this.handleElementsDragStart)
	}

	/**
	 * 移除事件监听器
	 */
	private removeEventListeners(): void {
		this.canvas.stage.off("mousedown", this.handleMouseDown)
		this.canvas.stage.off("mousemove", this.handleMouseMove)
		this.canvas.stage.off("mouseup", this.handleMouseUp)
		this.canvas.eventEmitter.off("elements:transform:dragstart", this.handleElementsDragStart)
		// 移除 window 的监听器（如果存在）
		window.removeEventListener("mouseup", this.handleWindowMouseUp)
		window.removeEventListener("mousemove", this.handleWindowMouseMove)
	}

	/**
	 * 处理 window 的 mouseup 事件
	 * 确保即使鼠标移出浏览器窗口后松开也能捕获到，清理框选状态
	 */
	private handleWindowMouseUp(): void {
		if (this.isSelecting) {
			// 移除 window 监听器
			window.removeEventListener("mouseup", this.handleWindowMouseUp)
			window.removeEventListener("mousemove", this.handleWindowMouseMove)
			// 停止边缘滚动
			this.stopEdgeScroll()
			// 清理框选状态
			this.clearToolSelectionRect()
			this.isSelecting = false
			// 发出框选结束事件
			this.canvas.eventEmitter.emit({ type: "selection:end", data: undefined })
			this.startPoint = null
			this.isMultiSelectMode = false
		}
	}

	/**
	 * 处理 window 的 mousemove 事件
	 * 确保即使鼠标移动到其他悬浮元素上也能继续检测边缘和更新框选矩形
	 */
	private handleWindowMouseMove(e: MouseEvent): void {
		if (!this.isSelecting || !this.startPoint || !this.toolSelectionRect) {
			return
		}

		// 获取 stage 容器的位置
		const container = this.canvas.stage.container()
		const rect = container.getBoundingClientRect()

		// 将屏幕坐标转换为相对于 stage 容器的坐标
		const stageX = e.clientX - rect.left
		const stageY = e.clientY - rect.top

		// 创建虚拟的指针位置对象
		const pos = { x: stageX, y: stageY }

		// 检测边缘并触发滚动
		this.handleEdgeScroll(pos)

		// startPoint 已经是 layer 坐标系，直接使用
		// 将当前鼠标位置转换为 layer 本地坐标
		const layerTransform = this.canvas.contentLayer.getAbsoluteTransform().copy().invert()
		const currentLayerPos = layerTransform.point(pos)

		// 更新框选矩形（使用 layer 坐标系）
		const x = Math.min(this.startPoint.x, currentLayerPos.x)
		const y = Math.min(this.startPoint.y, currentLayerPos.y)
		const width = Math.abs(currentLayerPos.x - this.startPoint.x)
		const height = Math.abs(currentLayerPos.y - this.startPoint.y)

		this.toolSelectionRect.setAttrs({
			x,
			y,
			width,
			height,
		})

		// 实时更新框选区域内的元素选中状态
		const box = { x, y, width, height }
		const selectedIds = this.findElementsInBox(box)

		// 实时更新选中状态，让 Layers UI 可以看到变化
		if (selectedIds.length > 0) {
			this.canvas.selectionManager.selectMultiple(selectedIds, this.isMultiSelectMode)
		} else if (!this.isMultiSelectMode) {
			// 如果没有框选到元素且不是多选模式，清空选中
			this.canvas.selectionManager.deselectAll()
		}

		this.toolLayer.batchDraw()
	}

	/**
	 * 处理元素拖动开始事件
	 * 当元素开始拖动时，清除框选矩形，避免框选矩形干扰拖动
	 */
	private handleElementsDragStart(): void {
		if (this.isSelecting) {
			// 移除 window 监听器
			window.removeEventListener("mouseup", this.handleWindowMouseUp)
			window.removeEventListener("mousemove", this.handleWindowMouseMove)
			// 停止边缘滚动
			this.stopEdgeScroll()
			this.clearToolSelectionRect()
			this.isSelecting = false
			// 发出框选结束事件
			this.canvas.eventEmitter.emit({ type: "selection:end", data: undefined })
			this.startPoint = null
			this.isMultiSelectMode = false
		}
	}

	/**
	 * 处理鼠标按下事件
	 */
	private handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>): void {
		// 右键点击时不触发框选
		if (e.evt.button === 2) {
			return
		}

		const clickedNode = e.target

		// 检查是否点击了装饰性元素（包括按钮本身或其父节点）
		let currentNode: Konva.Node | null = clickedNode
		while (currentNode) {
			if (currentNode.name().startsWith("decorator-")) {
				return
			}
			currentNode = currentNode.getParent()
		}

		// 检查是否点击了有效的元素
		const isValidElement = this.isValidElementNode(clickedNode)

		if (isValidElement) {
			// 获取被点击元素的 ID
			// 如果点击的是 hit-area 节点，使用其 ID（即父 Group 的 ID）
			let elementId = clickedNode.id()

			// 如果当前节点没有 ID，但它是 hit-area 且父节点是 Group，使用父节点的 ID
			if (
				!elementId &&
				clickedNode.name() === "hit-area" &&
				clickedNode.getParent() instanceof Konva.Group
			) {
				const parent = clickedNode.getParent()
				if (parent) {
					elementId = parent.id()
				}
			}

			if (elementId) {
				// 检查是否按住 Cmd/Ctrl 键（多选）
				const isMultiSelect = isMultiSelectEvent(e.evt)

				if (isMultiSelect) {
					// 多选模式：切换选中状态
					this.canvas.selectionManager.toggle(elementId)
				} else {
					// 单选模式：如果点击的不是已选中的元素，选中它
					// 如果点击的是已选中的元素，保持选中（允许拖拽）
					if (!this.canvas.selectionManager.isSelected(elementId)) {
						this.canvas.selectionManager.select(elementId, false)
					}
				}
			}
			return
		}

		// 检查是否点击了 Transformer 或其子元素（如 anchor）
		// 如果是，则不做任何处理，让 Transformer 处理事件
		if (
			clickedNode.getClassName() === "Transformer" ||
			clickedNode.getParent()?.getClassName() === "Transformer"
		) {
			return
		}

		// 点击空白区域，开始框选
		const pos = this.canvas.stage.getPointerPosition()
		if (!pos) return

		// 清空选中（如果没有按住 Cmd/Ctrl）
		const isMultiSelect = isMultiSelectEvent(e.evt)
		this.isMultiSelectMode = isMultiSelect // 记录多选模式
		if (!isMultiSelect) {
			this.canvas.selectionManager.deselectAll()
		}

		this.isSelecting = true
		// 发出框选开始事件
		this.canvas.eventEmitter.emit({ type: "selection:start", data: undefined })
		// 转换为 layer 本地坐标，存储相对于画布的起点
		const layerTransform = this.toolLayer.getAbsoluteTransform().copy().invert()
		const layerPos = layerTransform.point(pos)
		// 存储 layer 坐标系中的起点，这样即使视口移动，起点在画布上的位置也不会改变
		this.startPoint = { x: layerPos.x, y: layerPos.y }

		this.toolSelectionRect = new Konva.Rect({
			x: layerPos.x,
			y: layerPos.y,
			width: 0,
			height: 0,
			fill: this.TOOL_SELECTION_FILL,
			stroke: this.TOOL_SELECTION_STROKE,
			strokeWidth: this.TOOL_SELECTION_STROKE_WIDTH / this.canvas.stage.scaleX(), // 调整描边宽度，使其在任何缩放下都保持一致
			listening: false,
			name: "selection-tool-rect",
		})

		this.toolLayer.add(this.toolSelectionRect)
		this.toolSelectionRect.moveToTop()

		// 监听 window 的 mouseup 和 mousemove 事件
		// 确保即使鼠标移出浏览器窗口或移动到其他元素上也能捕获到
		window.addEventListener("mouseup", this.handleWindowMouseUp)
		window.addEventListener("mousemove", this.handleWindowMouseMove)
	}

	/**
	 * 处理鼠标移动事件
	 */
	private handleMouseMove(): void {
		if (!this.isSelecting || !this.startPoint || !this.toolSelectionRect) {
			return
		}

		const pos = this.canvas.stage.getPointerPosition()
		if (!pos) return

		// 检测边缘并触发滚动
		this.handleEdgeScroll(pos)

		// startPoint 已经是 layer 坐标系，直接使用
		// 将当前鼠标位置转换为 layer 本地坐标
		const layerTransform = this.toolLayer.getAbsoluteTransform().copy().invert()
		const currentLayerPos = layerTransform.point(pos)

		// 更新框选矩形（使用 layer 坐标系）
		const x = Math.min(this.startPoint.x, currentLayerPos.x)
		const y = Math.min(this.startPoint.y, currentLayerPos.y)
		const width = Math.abs(currentLayerPos.x - this.startPoint.x)
		const height = Math.abs(currentLayerPos.y - this.startPoint.y)

		this.toolSelectionRect.setAttrs({
			x,
			y,
			width,
			height,
		})

		// 实时更新框选区域内的元素选中状态
		const box = { x, y, width, height }
		const selectedIds = this.findElementsInBox(box)

		// 实时更新选中状态，让 Layers UI 可以看到变化
		if (selectedIds.length > 0) {
			this.canvas.selectionManager.selectMultiple(selectedIds, this.isMultiSelectMode)
		} else if (!this.isMultiSelectMode) {
			// 如果没有框选到元素且不是多选模式，清空选中
			this.canvas.selectionManager.deselectAll()
		}

		this.toolLayer.batchDraw()
	}

	/**
	 * 处理鼠标释放事件
	 */
	private handleMouseUp(e: Konva.KonvaEventObject<MouseEvent>): void {
		// 移除 window 监听器
		window.removeEventListener("mouseup", this.handleWindowMouseUp)
		window.removeEventListener("mousemove", this.handleWindowMouseMove)
		// 停止边缘滚动
		this.stopEdgeScroll()

		if (!this.isSelecting || !this.startPoint || !this.toolSelectionRect) {
			return
		}

		// 清理
		this.clearToolSelectionRect()
		this.isSelecting = false
		// 发出框选结束事件
		this.canvas.eventEmitter.emit({ type: "selection:end", data: undefined })
		this.startPoint = null
		this.isMultiSelectMode = false
	}

	/**
	 * 查找框选范围内的元素
	 * @param box 框选矩形
	 */
	private findElementsInBox(box: {
		x: number
		y: number
		width: number
		height: number
	}): string[] {
		const elements = this.canvas.elementManager.getAllElements()
		const selectedIds: string[] = []

		for (const element of elements) {
			if (this.isElementInBox(element, box)) {
				selectedIds.push(element.id)
			}
		}

		return selectedIds
	}

	/**
	 * 检查元素是否在框选范围内
	 * @param element 元素
	 * @param box 框选矩形
	 */
	private isElementInBox(
		element: LayerElement,
		box: { x: number; y: number; width: number; height: number },
	): boolean {
		const { x, y, width, height } = element

		if (x === undefined || y === undefined || width === undefined || height === undefined) {
			return false
		}

		// 使用 PermissionManager 统一判断元素是否可以被选中
		if (!this.canvas.permissionManager.canSelect(element)) {
			return false
		}

		// 检查元素是否与框选矩形相交
		const elementRight = x + width
		const elementBottom = y + height
		const boxRight = box.x + box.width
		const boxBottom = box.y + box.height

		return !(elementRight < box.x || x > boxRight || elementBottom < box.y || y > boxBottom)
	}

	/**
	 * 判断节点是否是有效的可选中元素
	 * @param node - Konva 节点
	 * @returns 是否是有效元素
	 */
	private isValidElementNode(node: Konva.Node): boolean {
		// 排除 Stage
		if (node === this.canvas.stage) {
			return false
		}

		// 排除 Layer
		if (node.getClassName() === "Layer") {
			return false
		}

		// 排除 Transformer 及其子元素
		if (
			node.getClassName() === "Transformer" ||
			node.getParent()?.getClassName() === "Transformer"
		) {
			return false
		}

		// 排除框选工具矩形
		if (node.name() === "selection-tool-rect") {
			return false
		}

		// 处理 hit-area 节点：hit 节点继承父 Group 的 ID，可以直接识别
		// 如果点击的是 hit-area，使用其 ID（即父 Group 的 ID）来选中
		let elementId = node.id()

		// 如果当前节点没有 ID，但它是 hit-area 且父节点是 Group，使用父节点的 ID
		if (!elementId && node.name() === "hit-area" && node.getParent() instanceof Konva.Group) {
			const parent = node.getParent()
			if (parent) {
				elementId = parent.id()
			}
		}

		// 必须有 ID 才是有效的元素
		if (!elementId) {
			return false
		}

		// 检查是否是 ElementManager 管理的元素
		if (!this.canvas.elementManager.hasElement(elementId)) {
			return false
		}

		// 使用 PermissionManager 统一判断元素是否可以被选中
		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (!this.canvas.permissionManager.canSelect(elementData)) {
			return false
		}

		return true
	}

	/**
	 * 处理边缘滚动
	 * 当鼠标接近画布边缘时，自动滚动视口
	 */
	private handleEdgeScroll(pos: { x: number; y: number }): void {
		const stageWidth = this.canvas.stage.width()
		const stageHeight = this.canvas.stage.height()
		const threshold = this.EDGE_SCROLL_THRESHOLD

		// 计算距离边缘的距离
		const distToLeft = pos.x
		const distToRight = stageWidth - pos.x
		const distToTop = pos.y
		const distToBottom = stageHeight - pos.y

		// 计算滚动方向（-1: 向左/上, 0: 不滚动, 1: 向右/下）
		// 注意：在 Konva 中，stage 向右移动（x 增大）时，视口向左移动（显示右边的内容）
		// 所以当鼠标在左边缘时，我们希望显示右边的内容，stage 应该向右移动（x 增大）
		let scrollX = 0
		let scrollY = 0

		if (distToLeft < threshold) {
			scrollX = 1 // 鼠标在左边缘，stage 向右移动（显示右边的内容）
		} else if (distToRight < threshold) {
			scrollX = -1 // 鼠标在右边缘，stage 向左移动（显示左边的内容）
		}

		if (distToTop < threshold) {
			scrollY = 1 // 鼠标在上边缘，stage 向下移动（显示下边的内容）
		} else if (distToBottom < threshold) {
			scrollY = -1 // 鼠标在下边缘，stage 向上移动（显示上边的内容）
		}

		// 如果需要在边缘滚动，启动滚动动画
		if (scrollX !== 0 || scrollY !== 0) {
			this.startEdgeScroll(scrollX, scrollY)
		} else {
			// 不在边缘，停止滚动
			this.stopEdgeScroll()
		}
	}

	/**
	 * 开始边缘滚动
	 */
	private startEdgeScroll(scrollX: number, scrollY: number): void {
		// 如果已经在滚动且方向相同，不需要重新启动
		if (this.edgeScrollAnimationFrame !== null) {
			return
		}

		const scroll = (): void => {
			if (!this.isSelecting) {
				this.stopEdgeScroll()
				return
			}

			const currentPos = this.canvas.stage.position()
			const speed = this.EDGE_SCROLL_SPEED

			const newPos = {
				x: currentPos.x + scrollX * speed,
				y: currentPos.y + scrollY * speed,
			}

			// 更新视口位置
			this.canvas.viewportController.setPosition(newPos)

			// 更新框选矩形（因为视口移动了，需要重新计算框选矩形）
			// startPoint 已经是 layer 坐标系，不需要调整，但需要重新计算框选矩形
			if (this.startPoint && this.toolSelectionRect) {
				const pos = this.canvas.stage.getPointerPosition()
				if (pos) {
					// startPoint 已经是 layer 坐标系，直接使用
					// 将当前鼠标位置转换为 layer 本地坐标
					const layerTransform = this.toolLayer.getAbsoluteTransform().copy().invert()
					const currentLayerPos = layerTransform.point(pos)

					// 更新框选矩形
					const x = Math.min(this.startPoint.x, currentLayerPos.x)
					const y = Math.min(this.startPoint.y, currentLayerPos.y)
					const width = Math.abs(currentLayerPos.x - this.startPoint.x)
					const height = Math.abs(currentLayerPos.y - this.startPoint.y)

					this.toolSelectionRect.setAttrs({
						x,
						y,
						width,
						height,
					})

					this.toolLayer.batchDraw()
				}
			}

			// 继续滚动
			this.edgeScrollAnimationFrame = requestAnimationFrame(scroll)
		}

		// 开始滚动
		this.edgeScrollAnimationFrame = requestAnimationFrame(scroll)
	}

	/**
	 * 停止边缘滚动
	 */
	private stopEdgeScroll(): void {
		if (this.edgeScrollAnimationFrame !== null) {
			cancelAnimationFrame(this.edgeScrollAnimationFrame)
			this.edgeScrollAnimationFrame = null
		}
	}

	/**
	 * 清除框选矩形
	 */
	private clearToolSelectionRect(): void {
		if (this.toolSelectionRect) {
			this.toolSelectionRect.destroy()
			this.toolSelectionRect = null
			this.toolLayer.batchDraw()
		}
	}

	/**
	 * 获取工具元数据
	 */
	public getMetadata() {
		return {
			name: "Selection Tool",
			cursor: "default" as const,
			isTemporary: false,
		}
	}

	/**
	 * 销毁工具
	 */
	public destroy(): void {
		this.deactivate()
		this.clearToolSelectionRect()
		this.stopEdgeScroll()
	}
}
