import Konva from "konva"
import type { EllipseElement as EllipseElementData } from "../../types"
import { ElementTypeEnum } from "../../types"
import { BaseElement } from "../BaseElement"
import { HoverManager } from "../../interaction/HoverManager"
import type { Canvas } from "../../Canvas"

/**
 * 圆形元素类
 */
export class EllipseElement extends BaseElement<EllipseElementData> {
	constructor(data: EllipseElementData, canvas: Canvas) {
		super(data, canvas)
	}

	/**
	 * 获取圆形默认配置
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
		return this.getText("ellipse.defaultName", "椭圆")
	}

	/**
	 * 创建圆形元素数据
	 */
	static createElementData(
		id: string,
		x: number,
		y: number,
		width: number,
		height: number,
		zIndex: number = 0,
	): EllipseElementData {
		const defaultConfig = this.getDefaultConfig()
		return {
			id,
			type: ElementTypeEnum.Ellipse,
			x,
			y,
			width,
			height,
			zIndex,
			fill: defaultConfig.fill,
		}
	}

	render(): Konva.Ellipse | null {
		if (!this.data.width || !this.data.height) return null

		const width = this.data.width
		const height = this.data.height

		const ellipse = new Konva.Ellipse({
			radiusX: width / 2,
			radiusY: height / 2,
			offsetX: -width / 2,
			offsetY: -height / 2,
			fill: this.data.fill,
			stroke: this.data.stroke,
			strokeWidth: this.data.strokeWidth,
		})

		this.finalizeNode(ellipse)
		return ellipse
	}

	update(newData: EllipseElementData): boolean {
		this.data = newData

		// 椭圆元素不需要重新渲染，所有属性都可以通过 setAttrs 更新
		if (this.node instanceof Konva.Ellipse) {
			const width = newData.width || 0
			const height = newData.height || 0

			// 更新基础属性（位置、可见性、透明度、zIndex、锁定状态）
			this.updateBaseProps(this.node, newData)

			// 更新椭圆特定属性
			this.node.setAttrs({
				radiusX: width / 2,
				radiusY: height / 2,
				offsetX: -width / 2,
				offsetY: -height / 2,
				fill: newData.fill,
				stroke: newData.stroke,
				strokeWidth: newData.strokeWidth,
			})
		}

		return false
	}

	/**
	 * 重写 hover 位置计算
	 * 椭圆使用负 offset，需要使用左上角坐标作为注册点
	 */
	protected override getHoverPosition(): { x: number; y: number } | null {
		const rect = this.getLayerRelativeRect()
		if (!rect) return null

		// 椭圆的 offset 是 -width/2, -height/2（负值）
		// 所以注册点应该在视觉左上角
		return {
			x: rect.x,
			y: rect.y,
		}
	}

	/**
	 * 创建椭圆的 hover 效果（椭圆边框）
	 */
	public override createHoverEffect(stage: Konva.Stage): Konva.Ellipse | null {
		if (!this.node || !(this.node instanceof Konva.Ellipse)) return null

		const pos = this.getHoverPosition()
		if (!pos) return null

		// 克隆椭圆节点作为 hover 边框
		const hoverEllipse = new Konva.Ellipse({
			x: pos.x,
			y: pos.y,
			scaleX: this.node.scaleX(),
			scaleY: this.node.scaleY(),
			radiusX: this.node.radiusX(),
			radiusY: this.node.radiusY(),
			offsetX: this.node.offsetX(),
			offsetY: this.node.offsetY(),
			fill: "transparent", // 透明填充
			stroke: HoverManager.HOVER_STROKE,
			strokeWidth: HoverManager.HOVER_STROKE_WIDTH / stage.scaleX(),
			listening: false, // 不响应鼠标事件
			name: "hover-effect", // 标记为 hover 效果
		})

		return hoverEllipse
	}

	/**
	 * 更新椭圆 hover 效果
	 */
	public override updateHoverEffect(hoverNode: Konva.Node, stage: Konva.Stage): void {
		if (!(hoverNode instanceof Konva.Ellipse) || !(this.node instanceof Konva.Ellipse)) return

		const pos = this.getHoverPosition()
		if (!pos) return

		// 更新位置和形状
		hoverNode.setAttrs({
			x: pos.x,
			y: pos.y,
			scaleX: this.node.scaleX(),
			scaleY: this.node.scaleY(),
			radiusX: this.node.radiusX(),
			radiusY: this.node.radiusY(),
			offsetX: this.node.offsetX(),
			offsetY: this.node.offsetY(),
			strokeWidth: HoverManager.HOVER_STROKE_WIDTH / stage.scaleX(),
		})
	}
}
