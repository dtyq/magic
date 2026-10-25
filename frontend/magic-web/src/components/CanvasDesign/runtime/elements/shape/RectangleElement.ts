import Konva from "konva"
import type {
	RectangleElement as RectangleElementData,
	ShapeElementContent,
} from "../../document/types"
import { ElementTypeEnum } from "../../document/types"
import { BaseElement } from "../core/BaseElement"
import type { Canvas } from "../../core/Canvas"

/**
 * 矩形元素类
 */
export class RectangleElement extends BaseElement<RectangleElementData> {
	constructor(data: RectangleElementData, canvas: Canvas) {
		super(data, canvas)
	}

	/**
	 * 获取矩形默认配置
	 */
	static getDefaultConfig() {
		return {
			fill: "#969696",
			cornerRadius: 0,
		}
	}

	/**
	 * 获取渲染名称（用于显示的默认名称，支持多语言）
	 */
	public getRenderName(): string {
		return this.getText("rectangle.defaultName", "矩形")
	}

	/**
	 * 创建矩形元素数据
	 */
	static createElementData(
		id: string,
		x: number,
		y: number,
		width: number,
		height: number,
		zIndex: number = 0,
	): RectangleElementData {
		const defaultConfig = this.getDefaultConfig()
		return {
			id,
			type: ElementTypeEnum.Rectangle,
			x,
			y,
			width,
			height,
			zIndex,
			activeContentId: `${id}-content-1`,
			mainContentId: `${id}-content-1`,
			contents: [
				{
					contentId: `${id}-content-1`,
					fill: defaultConfig.fill,
					cornerRadius: defaultConfig.cornerRadius,
				},
			],
		}
	}

	render(): Konva.Rect {
		const content = this.getActiveContent<ShapeElementContent>()
		const rect = new Konva.Rect({
			width: this.data.width,
			height: this.data.height,
			fill: content?.fill,
			stroke: content?.stroke,
			strokeWidth: content?.strokeWidth,
			cornerRadius: content?.cornerRadius,
		})

		this.finalizeNode(rect)
		return rect
	}

	update(newData: RectangleElementData): boolean {
		const content = this.getActiveContent<ShapeElementContent>(newData)
		this.data = newData

		// 矩形元素不需要重新渲染，所有属性都可以通过 setAttrs 更新
		if (this.node instanceof Konva.Rect) {
			// 更新基础属性（位置、可见性、透明度、zIndex、锁定状态）
			this.updateBaseProps(this.node, newData)

			// 更新矩形特定属性
			this.node.setAttrs({
				width: newData.width,
				height: newData.height,
				fill: content?.fill,
				stroke: content?.stroke,
				strokeWidth: content?.strokeWidth,
				cornerRadius: content?.cornerRadius,
			})
		}

		return false
	}
}
