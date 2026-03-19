import Konva from "konva"
import type { StarElement as StarElementData } from "../../types"
import { ElementTypeEnum } from "../../types"
import { BaseElement } from "../BaseElement"
import type { Canvas } from "../../Canvas"
import { HoverManager } from "../../interaction/HoverManager"

/**
 * 星形元素类
 */
export class StarElement extends BaseElement<StarElementData> {
	constructor(data: StarElementData, canvas: Canvas) {
		super(data, canvas)
	}

	/**
	 * 获取星形默认配置
	 */
	static getDefaultConfig() {
		return {
			width: 100,
			height: 100,
			fill: "#969696",
			cornerRadius: 0,
			sides: 5,
			innerRadiusRatio: 0.4,
		}
	}

	/**
	 * 获取渲染名称（用于显示的默认名称，支持多语言）
	 */
	public getRenderName(): string {
		return this.getText("star.defaultName", "星形")
	}

	/**
	 * 创建星形元素数据
	 */
	static createElementData(
		id: string,
		x: number,
		y: number,
		width: number,
		height: number,
		zIndex: number = 0,
	): StarElementData {
		const defaultConfig = this.getDefaultConfig()
		return {
			id,
			type: ElementTypeEnum.Star,
			x,
			y,
			width,
			height,
			zIndex,
			fill: defaultConfig.fill,
			sides: defaultConfig.sides,
			innerRadiusRatio: defaultConfig.innerRadiusRatio,
		}
	}

	render(): Konva.Star | null {
		if (
			!this.data.width ||
			!this.data.height ||
			!this.data.sides ||
			!this.data.innerRadiusRatio
		)
			return null

		const width = this.data.width
		const height = this.data.height
		const radius = Math.min(width, height) / 2

		const sides = this.data.sides
		const innerRadiusRatio = this.data.innerRadiusRatio

		const star = new Konva.Star({
			numPoints: sides,
			innerRadius: radius * innerRadiusRatio,
			outerRadius: radius,
			// 星形中心位置需要偏移半径
			offsetX: -width / 2,
			offsetY: -height / 2,
			fill: this.data.fill,
			stroke: this.data.stroke,
			strokeWidth: this.data.strokeWidth,
		})

		this.finalizeNode(star)
		return star
	}

	update(newData: StarElementData): boolean {
		this.data = newData

		// 星形元素不需要重新渲染，所有属性都可以通过 setAttrs 更新
		if (this.node instanceof Konva.Star) {
			const width = newData.width || 0
			const height = newData.height || 0
			const radius = Math.min(width, height) / 2
			const sides = newData.sides || 0
			const innerRadiusRatio = newData.innerRadiusRatio || 0

			// 更新基础属性（位置、可见性、透明度、zIndex、锁定状态）
			this.updateBaseProps(this.node, newData)

			// 更新星形特定属性
			this.node.setAttrs({
				numPoints: sides,
				innerRadius: radius * innerRadiusRatio,
				outerRadius: radius,
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
	 * 星形使用负 offset，需要使用左上角坐标作为注册点
	 */
	protected override getHoverPosition(): { x: number; y: number } | null {
		const rect = this.getLayerRelativeRect()
		if (!rect) return null

		// 星形的 offset 是 -width/2, -height/2（负值）
		// 所以注册点应该在视觉左上角
		return {
			x: rect.x,
			y: rect.y,
		}
	}

	/**
	 * 创建星形的 hover 效果（星形边框）
	 */
	public override createHoverEffect(stage: Konva.Stage): Konva.Star | null {
		if (!this.node || !(this.node instanceof Konva.Star)) return null

		const pos = this.getHoverPosition()
		if (!pos) return null

		// 克隆星形节点作为 hover 边框
		const hoverStar = new Konva.Star({
			x: pos.x,
			y: pos.y,
			scaleX: this.node.scaleX(),
			scaleY: this.node.scaleY(),
			numPoints: this.node.numPoints(),
			innerRadius: this.node.innerRadius(),
			outerRadius: this.node.outerRadius(),
			offsetX: this.node.offsetX(),
			offsetY: this.node.offsetY(),
			fill: "transparent", // 透明填充
			stroke: HoverManager.HOVER_STROKE,
			strokeWidth: HoverManager.HOVER_STROKE_WIDTH / stage.scaleX(),
			listening: false, // 不响应鼠标事件
			name: "hover-effect", // 标记为 hover 效果
		})

		return hoverStar
	}

	/**
	 * 更新星形 hover 效果
	 */
	public override updateHoverEffect(hoverNode: Konva.Node, stage: Konva.Stage): void {
		if (!(hoverNode instanceof Konva.Star) || !(this.node instanceof Konva.Star)) return

		const pos = this.getHoverPosition()
		if (!pos) return

		// 更新位置和形状
		hoverNode.setAttrs({
			x: pos.x,
			y: pos.y,
			scaleX: this.node.scaleX(),
			scaleY: this.node.scaleY(),
			numPoints: this.node.numPoints(),
			innerRadius: this.node.innerRadius(),
			outerRadius: this.node.outerRadius(),
			offsetX: this.node.offsetX(),
			offsetY: this.node.offsetY(),
			strokeWidth: HoverManager.HOVER_STROKE_WIDTH / stage.scaleX(),
		})
	}
}
