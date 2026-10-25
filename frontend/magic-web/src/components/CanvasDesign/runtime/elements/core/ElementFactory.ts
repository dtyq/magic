import type {
	LayerElement,
	ElementType,
	StoryboardElement as StoryboardElementData,
} from "../../document/types"
import { ElementTypeEnum } from "../../document/types"
import { normalizeStoryboardShot } from "../../document/storyboardMigration"
import { BaseElement, BASE_ELEMENT_DEFAULTS } from "./BaseElement"
// import { RectangleElement } from "../shape/RectangleElement"
// import { EllipseElement } from "../shape/EllipseElement"
// import { TriangleElement } from "../shape/TriangleElement"
// import { StarElement } from "../shape/StarElement"
import { TextElement } from "../text/TextElement"
import { ImageElement } from "../image/ImageElement"
import { VideoElement } from "../video/VideoElement"
import { AudioElement } from "../audio/AudioElement"
import { StoryboardElement } from "../storyboard/StoryboardElement"
import { VideoEditElement } from "../video-edit/VideoEditElement"
import { GroupElement } from "../frame/GroupElement"
import { FrameElement } from "../frame/FrameElement"
import type { Canvas } from "../../core/Canvas"

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

			case ElementTypeEnum.Text:
				return new TextElement(data, canvas)

			case ElementTypeEnum.Image:
				return new ImageElement(data, canvas)

			case ElementTypeEnum.Video:
				return new VideoElement(data, canvas)

			case ElementTypeEnum.Audio:
				return new AudioElement(data, canvas)

			case ElementTypeEnum.Storyboard:
				return new StoryboardElement(normalizeStoryboardData(data), canvas)

			case ElementTypeEnum.VideoEdit:
				return new VideoEditElement(data, canvas)

			case ElementTypeEnum.Group:
				// Groups are layout scopes just like Frames, but intentionally have no
				// clipping/background decoration. Keep them as real runtime elements so
				// their direct children can be selected and arranged on a loaded canvas.
				return new GroupElement(data, canvas)

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

			case ElementTypeEnum.Text:
				return TextElement.createElementData(id, x, y, roundedWidth, roundedHeight, zIndex)

			case ElementTypeEnum.Image: {
				const contentId = `${id}-content-1`
				return {
					id,
					type: ElementTypeEnum.Image,
					x,
					y,
					width: roundedWidth,
					height: roundedHeight,
					zIndex,
					activeContentId: contentId,
					mainContentId: contentId,
					contents: [{ contentId }],
				}
			}

			case ElementTypeEnum.Video: {
				const contentId = `${id}-content-1`
				return {
					id,
					type: ElementTypeEnum.Video,
					x,
					y,
					width: roundedWidth,
					height: roundedHeight,
					zIndex,
					activeContentId: contentId,
					mainContentId: contentId,
					contents: [{ contentId }],
				}
			}

			case ElementTypeEnum.Audio: {
				const contentId = `${id}-content-1`
				return {
					id,
					type: ElementTypeEnum.Audio,
					x,
					y,
					width: roundedWidth,
					height: roundedHeight,
					zIndex,
					activeContentId: contentId,
					mainContentId: contentId,
					contents: [{ contentId }],
				}
			}

			case ElementTypeEnum.Storyboard:
				return StoryboardElement.createElementData({
					id,
					x,
					y,
					width: roundedWidth,
					height: roundedHeight,
					zIndex,
				})

			case ElementTypeEnum.Rectangle:
			case ElementTypeEnum.Ellipse:
			case ElementTypeEnum.Triangle:
			case ElementTypeEnum.Star: {
				const contentId = `${id}-content-1`
				const config = this.getDefaultConfig(elementType)
				const { width: _width, height: _height, ...content } = config
				return {
					id,
					type: elementType,
					x,
					y,
					width: roundedWidth,
					height: roundedHeight,
					zIndex,
					activeContentId: contentId,
					mainContentId: contentId,
					contents: [{ contentId, ...content }],
				}
			}

			case ElementTypeEnum.Group: {
				const contentId = `${id}-content-1`
				return {
					id,
					type: ElementTypeEnum.Group,
					x,
					y,
					width: roundedWidth,
					height: roundedHeight,
					zIndex,
					activeContentId: contentId,
					mainContentId: contentId,
					contents: [{ contentId }],
				}
			}

			case ElementTypeEnum.Frame:
				return FrameElement.createElementData(id, x, y, roundedWidth, roundedHeight, zIndex)

			case ElementTypeEnum.VideoEdit:
				return VideoEditElement.createElementData({
					id,
					x,
					y,
					width: roundedWidth,
					height: roundedHeight,
					zIndex,
				})

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
		options?: {
			imageWidth?: number
			imageHeight?: number
			videoWidth?: number
			videoHeight?: number
			audioWidth?: number
			storyboardWidth?: number
			storyboardHeight?: number
			videoEditWidth?: number
			videoEditHeight?: number
		},
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

			case ElementTypeEnum.Text:
				specificConfig = TextElement.getDefaultConfig()
				break

			case ElementTypeEnum.Image:
				specificConfig = ImageElement.getDefaultConfig(
					options?.imageWidth,
					options?.imageHeight,
				)
				break

			case ElementTypeEnum.Video:
				specificConfig = VideoElement.getDefaultConfig(
					options?.videoWidth,
					options?.videoHeight,
				)
				break

			case ElementTypeEnum.Audio:
				specificConfig = {
					...AudioElement.getDefaultConfig(),
					width: options?.audioWidth ?? AudioElement.getDefaultConfig().width,
				}
				break

			case ElementTypeEnum.Storyboard:
				specificConfig = {
					...StoryboardElement.getDefaultConfig(),
					width: options?.storyboardWidth ?? StoryboardElement.getDefaultConfig().width,
					height:
						options?.storyboardHeight ?? StoryboardElement.getDefaultConfig().height,
				}
				break

			case ElementTypeEnum.VideoEdit:
				specificConfig = {
					...VideoEditElement.getDefaultConfig(),
					width: options?.videoEditWidth ?? VideoEditElement.getDefaultConfig().width,
					height: options?.videoEditHeight ?? VideoEditElement.getDefaultConfig().height,
				}
				break
			case ElementTypeEnum.Frame:
				specificConfig = FrameElement.getDefaultConfig()
				break

			case ElementTypeEnum.Group:
				specificConfig = GroupElement.getDefaultConfig()
				break

			default:
				console.warn(`Unknown element type: ${elementType}`)
				break
		}

		// 合并基础配置和特定配置
		return { ...baseConfig, ...specificConfig }
	}
}

function normalizeStoryboardData(data: StoryboardElementData): StoryboardElementData {
	// 镜头字段归一化；宽高由 StoryboardElement 构造时升到当前默认尺寸。
	return {
		...data,
		contents: data.contents.map((content) => ({
			...content,
			shots: content.shots?.map(normalizeStoryboardShot),
		})),
	}
}
