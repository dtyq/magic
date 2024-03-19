import Konva from "konva"
import type { TriangleElement as TriangleElementData } from "../../types"
import { ElementTypeEnum } from "../../types"
import { BaseElement } from "../BaseElement"
import type { Canvas } from "../../Canvas"
import { HoverManager } from "../../interaction/HoverManager"

/**
 * 三角形元素类
 */
export class TriangleElement extends BaseElement<TriangleElementData> {
	constructor(data: TriangleElementData, canvas: Canvas) {
		super(data, canvas)
	}

	/**
	 * 获取三角形默认配置
	 */
	static getDefaultConfig() {
		return {
			fill: "#969696",
		}
	}

	/**
	 * 获取渲染名称（用于显示的默认名称，支持多语言）
	 */
	public getRenderName(): string {
		return this.getText("triangle.defaultName", "三角形")
	}

	/**
	 * 创建三角形元素数据
	 */
	static createElementData(
		id: string,
		x: number,
		y: number,
		width: number,
		height: number,
		zIndex: number = 0,
	): TriangleElementData {
		const defaultConfig = this.getDefaultConfig()
		return {
			id,
			type: ElementTypeEnum.Triangle,
			x,
			y,
			width,
			height,
			zIndex,
			fill: defaultConfig.fill,
		}
	}

	render(): Konva.Line | null {
		if (!this.data.width || !this.data.height) return null

		const width = this.data.width
		const height = this.data.height

		// 计算三角形的三个顶点（等边三角形，顶点在上方）
		const points = this.calculatePoints(width, height)

		// 使用Line绘制闭合的三角形路径
		const triangle = new Konva.Line({
			points,
			closed: true,
			fill: this.data.fill,
			stroke: this.data.stroke,
			strokeWidth: this.data.strokeWidth,
		})

		this.finalizeNode(triangle)
		return triangle
	}

	update(newData: TriangleElementData): boolean {
		this.data = newData

		// 三角形元素不需要重新渲染，所有属性都可以通过 setAttrs 更新
		if (this.node instanceof Konva.Line) {
			const width = newData.width || 0
			const height = newData.height || 0
			const points = this.calculatePoints(width, height)

			// 更新基础属性（位置、可见性、透明度、zIndex、锁定状态）
			this.updateBaseProps(this.node, newData)

			// 更新三角形特定属性
			this.node.setAttrs({
				points,
				fill: newData.fill,
				stroke: newData.stroke,
				strokeWidth: newData.strokeWidth,
			})
		}

		return false
	}

	/**
	 * 计算三角形的顶点坐标
	 */
	private calculatePoints(width: number, height: number): number[] {
		return [
			width / 2,
			0, // 顶点
			0,
			height, // 左下角
			width,
			height, // 右下角
		]
	}

	/**
	 * 创建三角形的 hover 效果（三角形边框）
	 */
	public override createHoverEffect(stage: Konva.Stage): Konva.Line | null {
		if (!this.node || !(this.node instanceof Konva.Line)) return null

		const pos = this.getHoverPosition()
		if (!pos) return null

		// 克隆三角形节点作为 hover 边框
		const hoverTriangle = new Konva.Line({
			x: pos.x,
			y: pos.y,
			scaleX: this.node.scaleX(),
			scaleY: this.node.scaleY(),
			points: this.node.points(),
			closed: true,
			fill: "transparent", // 透明填充
			stroke: HoverManager.HOVER_STROKE,
			strokeWidth: HoverManager.HOVER_STROKE_WIDTH / stage.scaleX(),
			listening: false, // 不响应鼠标事件
			name: "hover-effect", // 标记为 hover 效果
		})

		return hoverTriangle
	}

	/**
	 * 更新三角形 hover 效果
	 */
	public override updateHoverEffect(hoverNode: Konva.Node, stage: Konva.Stage): void {
		if (!(hoverNode instanceof Konva.Line) || !(this.node instanceof Konva.Line)) return

		const pos = this.getHoverPosition()
		if (!pos) return

		// 更新位置和形状
		hoverNode.setAttrs({
			x: pos.x,
			y: pos.y,
			scaleX: this.node.scaleX(),
			scaleY: this.node.scaleY(),
			points: this.node.points(),
			strokeWidth: HoverManager.HOVER_STROKE_WIDTH / stage.scaleX(),
		})
	}
}
