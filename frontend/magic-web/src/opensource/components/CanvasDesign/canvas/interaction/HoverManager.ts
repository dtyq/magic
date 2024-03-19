import Konva from "konva"
import type { Canvas } from "../Canvas"

/**
 * Hover 管理器 - 管理元素的 hover 效果
 * 职责：
 * 1. 监听鼠标移入/移出事件
 * 2. 在 hover 时显示边框
 * 3. 发出 hover 事件
 */
export class HoverManager {
	private canvas: Canvas

	// Hover 状态
	private hoveredElementId: string | null = null
	private hoverNode: Konva.Shape | Konva.Group | null = null

	// Hover 边框样式配置（静态属性，供其他类使用）
	public static readonly HOVER_STROKE = "#3B82F6"
	// public static readonly HOVER_STROKE_WIDTH = 1.25
	public static readonly HOVER_STROKE_WIDTH = 2

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas

		this.setupEventListeners()
	}

	/**
	 * 设置事件监听
	 */
	private setupEventListeners(): void {
		// 监听鼠标移动事件
		this.canvas.stage.on("mousemove", this.handleMouseMove)

		// 监听鼠标离开 stage 事件
		this.canvas.stage.on("mouseleave", this.handleMouseLeave)

		// 监听元素删除事件，如果删除的是 hover 的元素，清除 hover 状态
		this.canvas.eventEmitter.on("element:deleted", ({ data }) => {
			const { elementId } = data
			if (this.hoveredElementId === elementId) {
				this.clearHover()
			}
		})

		// 监听选中事件，清除 hover（避免冲突）
		this.canvas.eventEmitter.on("element:select", () => {
			this.clearHover()
		})

		// 监听元素拖拽移动事件，清除 hover
		this.canvas.eventEmitter.on("elements:transform:dragstart", () => {
			this.clearHover()
		})

		// 监听视口缩放事件，更新 hover 边框宽度
		this.canvas.eventEmitter.on("viewport:scale", () => {
			this.updateHoverStrokeWidth()
		})

		// 监听文档恢复事件（撤销/恢复时触发）
		this.canvas.eventEmitter.on("document:restored", () => {
			// 清除 hover 状态，因为元素位置可能已经改变
			this.clearHover()
		})
	}

	/**
	 * 处理鼠标移动事件
	 */
	private handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>): void => {
		const target = e.target

		// 获取元素 ID（使用与 isValidElementNode 相同的逻辑）
		const elementId = this.getElementIdFromNode(target)
		if (!elementId) {
			this.clearHover()
			return
		}

		// 检查是否是有效的元素节点
		if (!this.isValidElementNode(target)) {
			this.clearHover()
			return
		}

		// 如果已经 hover 在同一个元素上，不做处理
		if (this.hoveredElementId === elementId) {
			return
		}

		// 更新 hover 状态
		this.setHover(elementId)
	}

	/**
	 * 处理鼠标离开 stage 事件
	 */
	private handleMouseLeave = (): void => {
		this.clearHover()
	}

	/**
	 * 设置 hover 状态
	 */
	private setHover(elementId: string): void {
		// 清除之前的 hover
		this.clearHover()

		// 如果元素已被选中，不显示 hover 效果
		if (this.canvas.selectionManager.isSelected(elementId)) {
			return
		}

		// 使用 NodeAdapter 获取元素边界和 hover 效果
		const adapter = this.canvas.elementManager.getNodeAdapter()
		const boundingRect = adapter.getElementBounds(elementId)
		if (!boundingRect) return

		// 尝试从 Element 获取自定义 hover 效果
		let hoverNode: Konva.Shape | Konva.Group | null = adapter.createHoverEffect(
			elementId,
			this.canvas.stage,
		)

		// 如果没有自定义 hover 效果，使用默认的矩形边框
		if (!hoverNode) {
			// 创建默认的矩形边框
			hoverNode = new Konva.Rect({
				x: boundingRect.x,
				y: boundingRect.y,
				width: boundingRect.width,
				height: boundingRect.height,
				stroke: HoverManager.HOVER_STROKE,
				strokeWidth: HoverManager.HOVER_STROKE_WIDTH / this.canvas.stage.scaleX(),
				listening: false,
				name: "hover-rect",
			})
		}

		// 添加到图层并移到最上层
		this.canvas.controlsLayer.add(hoverNode)
		hoverNode.moveToTop()
		this.canvas.controlsLayer.batchDraw()

		// 更新状态
		this.hoverNode = hoverNode
		this.hoveredElementId = elementId

		// 发出 hover 事件
		this.canvas.eventEmitter.emit({ type: "element:hover", data: { elementId } })
	}

	/**
	 * 更新 hover 效果（当缩放改变时调用）
	 */
	private updateHoverStrokeWidth(): void {
		if (!this.hoverNode || !this.hoveredElementId) return

		// 尝试使用 Element 的自定义更新方法
		const element = this.canvas.elementManager.getElementInstance(this.hoveredElementId)
		if (element && typeof element.updateHoverEffect === "function") {
			element.updateHoverEffect(this.hoverNode, this.canvas.stage)
			// 确保使用正确的 strokeWidth（覆盖自定义方法可能使用的错误值）
			this.applyHoverStrokeWidth(this.hoverNode)
		} else {
			// 默认更新描边宽度
			this.applyHoverStrokeWidth(this.hoverNode)
		}

		this.canvas.controlsLayer.batchDraw()
	}

	/**
	 * 递归应用 hover 边框宽度到节点及其子节点
	 */
	private applyHoverStrokeWidth(node: Konva.Node): void {
		if (node instanceof Konva.Shape) {
			node.strokeWidth(HoverManager.HOVER_STROKE_WIDTH / this.canvas.stage.scaleX())
		} else if (node instanceof Konva.Group) {
			// 递归更新 Group 中的所有子节点
			node.children.forEach((child) => {
				this.applyHoverStrokeWidth(child)
			})
		}
	}

	/**
	 * 清除 hover 状态
	 */
	private clearHover(): void {
		if (this.hoverNode) {
			this.hoverNode.destroy()
			this.hoverNode = null
			this.canvas.controlsLayer.batchDraw()
		}

		if (this.hoveredElementId) {
			this.hoveredElementId = null
			// 发出 hover 清除事件
			this.canvas.eventEmitter.emit({ type: "element:hover", data: { elementId: null } })
		}
	}

	/**
	 * 从节点获取元素 ID（处理 hit-area 节点的情况）
	 */
	private getElementIdFromNode(node: Konva.Node): string | null {
		let elementId = node.id()

		// 如果当前节点没有 ID，但它是 hit-area 且父节点是 Group，使用父节点的 ID
		if (!elementId && node.name() === "hit-area" && node.getParent() instanceof Konva.Group) {
			const parent = node.getParent()
			if (parent) {
				elementId = parent.id()
			}
		}

		return elementId || null
	}

	/**
	 * 判断节点是否是有效的可 hover 元素
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

		// 排除 hover 边框自身
		if (node.name() === "hover-rect") {
			return false
		}

		// 排除框选工具矩形
		if (node.name() === "selection-tool-rect") {
			return false
		}

		// 获取元素 ID（处理 hit-area 节点的情况）
		const elementId = this.getElementIdFromNode(node)

		// 必须有 ID 才是有效的元素
		if (!elementId) {
			return false
		}

		// 检查是否是 ElementManager 管理的元素
		if (!this.canvas.elementManager.hasElement(elementId)) {
			return false
		}

		// 使用 PermissionManager 统一判断元素是否可以 hover
		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (!this.canvas.permissionManager.canHover(elementData)) {
			return false
		}

		// 排除正在被 transform 的元素
		if (this.canvas.transformManager.isTransforming(elementId)) {
			return false
		}

		// 排除正在拖拽时的所有元素
		if (this.canvas.transformManager.isDraggingElement()) {
			return false
		}

		return true
	}

	/**
	 * 获取当前 hover 的元素 ID
	 */
	public getHoveredElementId(): string | null {
		return this.hoveredElementId
	}

	/**
	 * 手动设置 hover 状态（用于外部触发，如图层面板）
	 */
	public manualSetHover(elementId: string | null): void {
		if (elementId === null) {
			this.clearHover()
		} else {
			// 检查元素是否存在
			if (this.canvas.elementManager.hasElement(elementId)) {
				this.setHover(elementId)
			}
		}
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		// 清除 hover 状态
		this.clearHover()

		// 移除事件监听
		this.canvas.stage.off("mousemove", this.handleMouseMove)
		this.canvas.stage.off("mouseleave", this.handleMouseLeave)
		this.canvas.eventEmitter.off("element:deleted")
		this.canvas.eventEmitter.off("element:select")
		this.canvas.eventEmitter.off("elements:transform:dragstart")
		this.canvas.eventEmitter.off("viewport:scale")
	}
}
