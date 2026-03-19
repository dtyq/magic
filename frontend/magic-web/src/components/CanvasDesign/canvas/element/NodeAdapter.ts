import Konva from "konva"
import type { BaseElement } from "./BaseElement"
import { calculateNodesRect, type Rect } from "../utils/utils"
import type { Canvas } from "../Canvas"

/**
 * Node 适配器 - 为框架层提供受控的 Node 访问
 * 仅供框架内部使用（TransformManager、HoverManager 等）
 *
 * 设计目的：
 * 1. 隔离业务代码和 Konva Node 的直接交互
 * 2. 提供框架层需要的 Node 访问能力
 * 3. 保持元素封装的完整性
 */
export class NodeAdapter {
	private canvas: Canvas
	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas
	}

	/**
	 * 获取用于 Transformer 的节点数组
	 * @param elementIds - 元素 ID 数组
	 * @returns Konva Node 数组
	 */
	public getNodesForTransform(elementIds: string[]): Konva.Node[] {
		return elementIds
			.map((id) => this.canvas.elementManager.getElementInstance(id))
			.filter((el): el is BaseElement => el !== null && el !== undefined)
			.map((el) => el.getNode())
			.filter((node): node is Konva.Node => node !== null)
	}

	/**
	 * 获取元素的边界矩形（用于 Hover、SnapGuide 等）
	 * @param elementId - 元素 ID
	 * @returns 边界矩形，如果元素不存在则返回 null
	 */
	public getElementBounds(elementId: string): Rect | null {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		return element?.getBoundingRect() ?? null
	}

	/**
	 * 批量获取边界矩形（计算多个元素的总体边界）
	 * @param elementIds - 元素 ID 数组
	 * @returns 总体边界矩形，如果没有有效元素则返回 null
	 */
	public getElementsBounds(elementIds: string[]): Rect | null {
		const nodes = this.getNodesForTransform(elementIds)
		if (nodes.length === 0) return null

		// 使用现有的 calculateNodesRect 工具函数
		return calculateNodesRect(nodes, this.canvas.stage, this.canvas.elementManager)
	}

	/**
	 * 获取节点用于父子关系操作（FrameManager 专用）
	 * @param elementId - 元素 ID
	 * @returns Konva Node，如果元素不存在则返回 null
	 */
	public getNodeForParenting(elementId: string): Konva.Node | null {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		return element?.getNode() ?? null
	}

	/**
	 * 创建 Hover 效果节点
	 * @param elementId - 元素 ID
	 * @param stage - Konva Stage 实例
	 * @returns Hover 效果节点，如果元素没有自定义效果则返回 null
	 */
	public createHoverEffect(
		elementId: string,
		stage: Konva.Stage,
	): Konva.Shape | Konva.Group | null {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		return element?.createHoverEffect(stage) ?? null
	}

	/**
	 * 更新 Hover 效果节点
	 * @param elementId - 元素 ID
	 * @param hoverNode - Hover 效果节点
	 * @param stage - Konva Stage 实例
	 */
	public updateHoverEffect(
		elementId: string,
		hoverNode: Konva.Shape | Konva.Group,
		stage: Konva.Stage,
	): void {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		element?.updateHoverEffect(hoverNode, stage)
	}

	/**
	 * 获取节点用于聚焦操作（ViewportController 专用）
	 * @param elementId - 元素 ID
	 * @returns Konva Node，如果元素不存在则返回 null
	 */
	public getNodeForFocus(elementId: string): Konva.Node | null {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		return element?.getNode() ?? null
	}

	/**
	 * 批量获取节点用于聚焦操作
	 * @param elementIds - 元素 ID 数组
	 * @returns Konva Node 数组
	 */
	public getNodesForFocus(elementIds: string[]): Konva.Node[] {
		return this.getNodesForTransform(elementIds)
	}
}
