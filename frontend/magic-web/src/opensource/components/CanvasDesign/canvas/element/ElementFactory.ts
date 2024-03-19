import type { LayerElement, ElementType } from "../types"
import { ElementTypeEnum } from "../types"
import { BaseElement, BASE_ELEMENT_DEFAULTS } from "./BaseElement"
// import { RectangleElement } from "./elements/RectangleElement"
// import { EllipseElement } from "./elements/EllipseElement"
// import { TriangleElement } from "./elements/TriangleElement"
// import { StarElement } from "./elements/StarElement"
// import { TextElement } from "./elements/TextElement"
import { ImageElement } from "./elements/ImageElement"
// import { GroupElement } from "./elements/GroupElement"
import { FrameElement } from "./elements/FrameElement"
import type { Canvas } from "../Canvas"

/**
 * 元素工厂类
 * 负责创建元素实例和元素数据
 */
export class ElementFactory {
	/**
	 * 创建元素实例
	 */
	static create(data: LayerElement, canvas: Canvas): BaseElement | null {
		switch (data.type) {
			// case ElementTypeEnum.Rectangle:
			// 	return new RectangleElement(
			// 		data,
			// 		eventEmitter,
			// 		methods,
			// 		elementManager,
			// 		selectionManager,
			// 	)

			// case ElementTypeEnum.Ellipse:
			// 	return new EllipseElement(
			// 		data,
			// 		eventEmitter,
			// 		methods,
			// 		elementManager,
			// 		selectionManager,
			// 	)

			// case ElementTypeEnum.Triangle:
			// 	return new TriangleElement(
			// 		data,
			// 		eventEmitter,
			// 		methods,
			// 		elementManager,
			// 		selectionManager,
			// 	)

			// case ElementTypeEnum.Star:
			// 	return new StarElement(
			// 		data,
			// 		eventEmitter,
			// 		methods,
			// 		elementManager,
			// 		selectionManager,
			// 	)

			// case ElementTypeEnum.Text:
			// 	return new TextElement(
			// 		data,
			// 		eventEmitter,
			// 		methods,
			// 		elementManager,
			// 		selectionManager,
			// 	)

			case ElementTypeEnum.Image:
				return new ImageElement(data, canvas)

			// case ElementTypeEnum.Group:
			// 	return new GroupElement(
			// 		data,
			// 		eventEmitter,
			// 		methods,
			// 		elementManager,
			// 		selectionManager,
			// 	)

			case ElementTypeEnum.Frame:
				return new FrameElement(data, canvas)

			default:
				// 不支持的类型，返回 null 而不是抛出错误
				return null
		}
	}

	/**
	 * 创建元素数据
	 */
	static createElementData(
		elementType: ElementType,
		id: string,
		x: number,
		y: number,
		width: number,
		height: number,
		zIndex: number = 0,
	): LayerElement {
		// 将宽高转换为整数
		const roundedWidth = Math.round(width)
		const roundedHeight = Math.round(height)

		switch (elementType) {
			// case ElementTypeEnum.Rectangle:
			// 	return RectangleElement.createElementData(
			// 		id,
			// 		x,
			// 		y,
			// 		roundedWidth,
			// 		roundedHeight,
			// 		zIndex,
			// 	)

			// case ElementTypeEnum.Ellipse:
			// 	return EllipseElement.createElementData(
			// 		id,
			// 		x,
			// 		y,
			// 		roundedWidth,
			// 		roundedHeight,
			// 		zIndex,
			// 	)

			// case ElementTypeEnum.Triangle:
			// 	return TriangleElement.createElementData(
			// 		id,
			// 		x,
			// 		y,
			// 		roundedWidth,
			// 		roundedHeight,
			// 		zIndex,
			// 	)

			// case ElementTypeEnum.Star:
			// 	return StarElement.createElementData(id, x, y, roundedWidth, roundedHeight, zIndex)

			case ElementTypeEnum.Frame:
				return FrameElement.createElementData(id, x, y, roundedWidth, roundedHeight, zIndex)

			default:
				// 不支持的类型，抛出错误（因为这是创建数据的方法，调用者应该知道类型）
				throw new Error(`Unsupported element type: ${elementType}`)
		}
	}

	/**
	 * 获取指定元素类型的默认配置
	 * @param elementType 元素类型
	 * @param options 可选的配置选项
	 * @param options.imageWidth 图片元素的宽度（仅对图片元素有效）
	 * @param options.imageHeight 图片元素的高度（仅对图片元素有效）
	 */
	static getDefaultConfig(
		elementType: ElementType,
		options?: { imageWidth?: number; imageHeight?: number },
	): Record<string, unknown> {
		// 先获取基础元素默认配置
		const baseConfig = { ...BASE_ELEMENT_DEFAULTS }

		// 根据元素类型获取特定的默认配置
		let specificConfig: Record<string, unknown> = {}

		switch (elementType) {
			// case ElementTypeEnum.Rectangle:
			// 	specificConfig = RectangleElement.getDefaultConfig()
			// 	break

			// case ElementTypeEnum.Ellipse:
			// 	specificConfig = EllipseElement.getDefaultConfig()
			// 	break

			// case ElementTypeEnum.Triangle:
			// 	specificConfig = TriangleElement.getDefaultConfig()
			// 	break

			// case ElementTypeEnum.Star:
			// 	specificConfig = StarElement.getDefaultConfig()
			// 	break

			// case ElementTypeEnum.Text:
			// 	specificConfig = TextElement.getDefaultConfig()
			// 	break

			case ElementTypeEnum.Image:
				specificConfig = ImageElement.getDefaultConfig(
					options?.imageWidth,
					options?.imageHeight,
				)
				break

			case ElementTypeEnum.Frame:
				specificConfig = FrameElement.getDefaultConfig()
				break

			// case ElementTypeEnum.Group:
			// 	specificConfig = GroupElement.getDefaultConfig()
			// 	break

			default:
				console.warn(`Unknown element type: ${elementType}`)
				break
		}

		// 合并基础配置和特定配置
		return { ...baseConfig, ...specificConfig }
	}
}
