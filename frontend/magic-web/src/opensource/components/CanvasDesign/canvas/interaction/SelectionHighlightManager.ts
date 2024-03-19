import Konva from "konva"
import type { Canvas } from "../Canvas"

/**
 * 框选高亮管理器 - 管理框选过程中的元素高亮效果
 * 职责：
 * 1. 在框选过程中为被框选到的元素显示高亮边框
 * 2. 实时更新高亮效果（框选到显示，移走隐藏）
 * 3. 支持使用 Element 的自定义高亮效果（类似 hover）
 */
export class SelectionHighlightManager {
	private canvas: Canvas

	// 高亮状态管理
	private highlightedElementIds: Set<string> = new Set()
	private highlightNodes: Map<string, Konva.Shape | Konva.Group> = new Map()

	// 高亮边框样式配置（与 hover 保持一致）
	private readonly HIGHLIGHT_STROKE = "#3B82F6"
	private readonly HIGHLIGHT_STROKE_WIDTH = 1.25

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas

		this.setupEventListeners()
	}

	/**
	 * 设置事件监听
	 */
	private setupEventListeners(): void {
		// 监听视口缩放事件，更新高亮边框宽度
		this.canvas.eventEmitter.on("viewport:scale", () => {
			this.updateHighlightStrokeWidth()
		})

		// 监听选中事件，多选时显示边框
		this.canvas.eventEmitter.on("element:select", ({ data }) => {
			const { elementIds } = data
			// 只在多选时（2个或以上）显示边框
			if (elementIds.length >= 2) {
				this.updateHighlights(elementIds)
			} else {
				// 单选时清除边框
				this.clearAllHighlights()
			}
		})

		// 监听取消选中事件，清除边框
		this.canvas.eventEmitter.on("element:deselect", () => {
			this.clearAllHighlights()
		})

		// 监听拖拽开始事件，隐藏边框（类似 Transformer）
		this.canvas.eventEmitter.on("elements:transform:dragstart", () => {
			this.hideAllHighlights()
		})

		// 监听缩放开始事件，隐藏边框
		this.canvas.eventEmitter.on("elements:transform:anchorDragStart", () => {
			this.hideAllHighlights()
		})

		// 监听拖拽结束事件，重新显示边框
		this.canvas.eventEmitter.on("elements:transform:dragend", () => {
			this.showAllHighlights()
		})

		// 监听缩放结束事件，重新显示边框
		this.canvas.eventEmitter.on("elements:transform:anchorDragend", () => {
			this.showAllHighlights()
		})

		// 处理元素变化的共享逻辑
		const handleElementChange = ({ data }: { data: { elementId: string } }) => {
			const { elementId } = data
			if (this.highlightedElementIds.has(elementId)) {
				this.updateHighlight(elementId)
			}
		}

		// 监听元素数据更新事件
		this.canvas.eventEmitter.on("element:updated", handleElementChange)

		// 监听元素重新渲染事件
		this.canvas.eventEmitter.on("element:rerendered", handleElementChange)

		// 监听文档恢复事件（撤销/恢复时触发）
		this.canvas.eventEmitter.on("document:restored", () => {
			// 更新所有高亮元素的位置
			const highlightedIds = Array.from(this.highlightedElementIds)
			highlightedIds.forEach((elementId) => {
				this.updateHighlight(elementId)
			})
		})
	}

	/**
	 * 更新高亮元素列表
	 * @param elementIds 当前框选到的元素 ID 数组
	 */
	public updateHighlights(elementIds: string[]): void {
		const newHighlightSet = new Set(elementIds)

		// 移除不再高亮的元素
		for (const elementId of this.highlightedElementIds) {
			if (!newHighlightSet.has(elementId)) {
				this.removeHighlight(elementId)
			}
		}

		// 添加新高亮的元素
		for (const elementId of elementIds) {
			if (!this.highlightedElementIds.has(elementId)) {
				this.addHighlight(elementId)
			}
		}
	}

	/**
	 * 为元素添加高亮效果
	 */
	private addHighlight(elementId: string): void {
		// 使用 NodeAdapter 获取元素边界
		const adapter = this.canvas.elementManager.getNodeAdapter()
		const bounds = adapter.getElementBounds(elementId)
		if (!bounds) return

		// 使用 PermissionManager 判断元素是否可见
		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (!this.canvas.permissionManager.isVisible(elementData)) {
			return
		}

		// 尝试从 Element 获取自定义高亮效果（复用 createHoverEffect 方法）
		const element = this.canvas.elementManager.getElementInstance(elementId)
		let highlightNode: Konva.Shape | Konva.Group | null = null

		if (element && typeof element.createHoverEffect === "function") {
			const customHighlight = element.createHoverEffect(this.canvas.stage)
			// 确保返回的是 Shape 或 Group 类型
			if (customHighlight instanceof Konva.Shape || customHighlight instanceof Konva.Group) {
				// 修改样式为高亮样式（1px 边框）
				if (customHighlight instanceof Konva.Shape) {
					customHighlight.stroke(this.HIGHLIGHT_STROKE)
					customHighlight.strokeWidth(
						this.HIGHLIGHT_STROKE_WIDTH / this.canvas.stage.scaleX(),
					)
				}
				customHighlight.name("selection-highlight")
				highlightNode = customHighlight
			}
		}

		// 如果没有自定义高亮效果，使用默认的矩形边框
		if (!highlightNode) {
			// 优先使用 Element 实例的自定义边界计算
			let boundingRect: { x: number; y: number; width: number; height: number } | null = null
			if (element && typeof element.getBoundingRect === "function") {
				boundingRect = element.getBoundingRect()
			}

			// 如果没有自定义边界计算，使用之前获取的 bounds
			if (!boundingRect) {
				boundingRect = bounds
			}

			// 确保有有效的边界矩形
			if (!boundingRect) {
				return
			}

			// 创建默认的矩形边框
			highlightNode = new Konva.Rect({
				x: boundingRect.x,
				y: boundingRect.y,
				width: boundingRect.width,
				height: boundingRect.height,
				stroke: this.HIGHLIGHT_STROKE,
				strokeWidth: this.HIGHLIGHT_STROKE_WIDTH / this.canvas.stage.scaleX(),
				listening: false,
				name: "selection-highlight",
			})
		}

		// 添加到图层并移到最上层
		this.canvas.selectionLayer.add(highlightNode)
		highlightNode.moveToTop()

		// 保存高亮节点
		this.highlightNodes.set(elementId, highlightNode)
		this.highlightedElementIds.add(elementId)
	}

	/**
	 * 更新单个元素的高亮效果
	 */
	private updateHighlight(elementId: string): void {
		// 移除旧的 highlight
		const oldHighlightNode = this.highlightNodes.get(elementId)
		if (oldHighlightNode) {
			oldHighlightNode.destroy()
			this.highlightNodes.delete(elementId)
		}

		// 重新创建 highlight（位置会自动更新）
		this.addHighlight(elementId)
		this.canvas.selectionLayer.batchDraw()
	}

	/**
	 * 移除元素的高亮效果
	 */
	private removeHighlight(elementId: string): void {
		const highlightNode = this.highlightNodes.get(elementId)
		if (highlightNode) {
			highlightNode.destroy()
			this.highlightNodes.delete(elementId)
		}
		this.highlightedElementIds.delete(elementId)
	}

	/**
	 * 清除所有高亮效果
	 */
	public clearAllHighlights(): void {
		for (const elementId of this.highlightedElementIds) {
			this.removeHighlight(elementId)
		}
		this.canvas.selectionLayer.batchDraw()
	}

	/**
	 * 隐藏所有高亮边框（拖动时）
	 */
	private hideAllHighlights(): void {
		for (const highlightNode of this.highlightNodes.values()) {
			highlightNode.hide()
		}
		this.canvas.selectionLayer.batchDraw()
	}

	/**
	 * 显示所有高亮边框（拖动结束后）
	 * 重新创建边框以更新位置
	 */
	private showAllHighlights(): void {
		// 获取当前高亮的元素 ID 列表
		const elementIds = Array.from(this.highlightedElementIds)

		// 清除旧的边框
		for (const [elementId, highlightNode] of this.highlightNodes) {
			highlightNode.destroy()
			this.highlightNodes.delete(elementId)
		}

		// 重新创建边框（位置会自动更新）
		for (const elementId of elementIds) {
			this.addHighlight(elementId)
		}

		this.canvas.selectionLayer.batchDraw()
	}

	/**
	 * 更新高亮效果（当 viewport 缩放变化时）
	 */
	public updateHighlightStrokeWidth(): void {
		for (const [elementId, highlightNode] of this.highlightNodes) {
			// 尝试使用 Element 的自定义更新方法
			const element = this.canvas.elementManager.getElementInstance(elementId)
			if (element && typeof element.updateHoverEffect === "function") {
				element.updateHoverEffect(highlightNode, this.canvas.stage)
				// 确保使用高亮样式（1px）而不是 hover 样式（2px）
				if (highlightNode instanceof Konva.Shape) {
					highlightNode.strokeWidth(
						this.HIGHLIGHT_STROKE_WIDTH / this.canvas.stage.scaleX(),
					)
				}
			} else {
				// 默认更新描边宽度
				if (highlightNode instanceof Konva.Shape) {
					highlightNode.strokeWidth(
						this.HIGHLIGHT_STROKE_WIDTH / this.canvas.stage.scaleX(),
					)
				}
			}
		}
		this.canvas.selectionLayer.batchDraw()
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		this.clearAllHighlights()
		// 移除事件监听
		this.canvas.eventEmitter.off("viewport:scale")
		this.canvas.eventEmitter.off("element:select")
		this.canvas.eventEmitter.off("element:deselect")
		this.canvas.eventEmitter.off("elements:transform:dragstart")
		this.canvas.eventEmitter.off("elements:transform:anchorDragStart")
		this.canvas.eventEmitter.off("elements:transform:dragend")
		this.canvas.eventEmitter.off("elements:transform:anchorDragend")
		this.canvas.eventEmitter.off("element:updated")
		this.canvas.eventEmitter.off("document:restored")
	}
}
