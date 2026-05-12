import {
	ElementTypeEnum,
	type CanvasDocument,
	type CropConfig,
	type EllipseElement,
	type FrameElement,
	type GroupElement,
	type ImageElement,
	type InteractionConfig,
	type LayerElement,
	type RectangleElement,
	type RichTextParagraph,
	type RichTextNode,
	type StarElement,
	type TextElement,
	type TextStyle,
	type TriangleElement,
	type VideoElement,
} from "../types"
import { compactTextDefaultStyle } from "../text/richText"
import { getImageGenerationTaskMeta } from "./imageGenerationTaskMeta"

const BASE_EXPORT_DEFAULTS = {
	visible: true,
	locked: false,
	opacity: 1,
	scaleX: 1,
	scaleY: 1,
} as const

function cloneSerializable<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T
}

function exportInteractionConfig(
	interactionConfig?: InteractionConfig,
): InteractionConfig | undefined {
	if (!interactionConfig) return undefined

	const result: InteractionConfig = {}

	if (interactionConfig.fillTransparent !== undefined) {
		result.fillTransparent = interactionConfig.fillTransparent
	}
	if (interactionConfig.fillColorMode !== undefined) {
		result.fillColorMode = interactionConfig.fillColorMode
	}
	if (interactionConfig.strokeTransparent !== undefined) {
		result.strokeTransparent = interactionConfig.strokeTransparent
	}
	if (interactionConfig.strokeColorMode !== undefined) {
		result.strokeColorMode = interactionConfig.strokeColorMode
	}
	if (interactionConfig.strokePosition !== undefined) {
		result.strokePosition = interactionConfig.strokePosition
	}
	if (interactionConfig.aspectRatioLocked !== undefined) {
		result.aspectRatioLocked = interactionConfig.aspectRatioLocked
	}

	return result
}

function exportCropConfig(crop?: CropConfig): CropConfig | undefined {
	if (!crop) return undefined

	const result: CropConfig = {
		width: crop.width,
		height: crop.height,
		x: crop.x,
		y: crop.y,
	}

	if (crop.displayWidth !== undefined) {
		result.displayWidth = crop.displayWidth
	}
	if (crop.displayHeight !== undefined) {
		result.displayHeight = crop.displayHeight
	}

	return result
}

function exportTextStyle(style?: TextStyle): TextStyle | undefined {
	if (!style) return undefined

	const result: TextStyle = {}

	if (style.fontSize !== undefined) result.fontSize = style.fontSize
	if (style.fontWeight !== undefined) result.fontWeight = style.fontWeight
	if (style.color !== undefined) result.color = style.color
	if (style.fontFamily !== undefined) result.fontFamily = style.fontFamily
	if (style.bold !== undefined) result.bold = style.bold
	if (style.italic !== undefined) result.italic = style.italic
	if (style.underline !== undefined) result.underline = style.underline
	if (style.strikethrough !== undefined) result.strikethrough = style.strikethrough
	if (style.backgroundColor !== undefined) {
		result.backgroundColor = style.backgroundColor
	}
	if (style.letterSpacing !== undefined) result.letterSpacing = style.letterSpacing

	return result
}

function exportRichTextNode(node: RichTextNode): RichTextNode {
	const result: RichTextNode = {
		type: "text",
		text: node.text,
	}

	if (node.style !== undefined) {
		result.style = exportTextStyle(node.style)
	}

	return result
}

function exportRichTextParagraph(paragraph: RichTextParagraph): RichTextParagraph {
	const result: RichTextParagraph = {}

	if (paragraph.children !== undefined) {
		result.children = paragraph.children.map(exportRichTextNode)
	}

	if (paragraph.style !== undefined) {
		result.style = {}

		if (paragraph.style.textAlign !== undefined) {
			result.style.textAlign = paragraph.style.textAlign
		}
		if (paragraph.style.lineHeight !== undefined) {
			result.style.lineHeight = paragraph.style.lineHeight
		}
		if (paragraph.style.paragraphSpacing !== undefined) {
			result.style.paragraphSpacing = paragraph.style.paragraphSpacing
		}
		if (paragraph.style.listType !== undefined) {
			result.style.listType = paragraph.style.listType
		}
	}

	return result
}

function assignBaseElementProps<T extends LayerElement>(result: T, element: T): T {
	if (element.name !== undefined) result.name = element.name
	if (element.visible !== undefined && element.visible !== BASE_EXPORT_DEFAULTS.visible) {
		result.visible = element.visible
	}
	if (element.locked !== undefined && element.locked !== BASE_EXPORT_DEFAULTS.locked) {
		result.locked = element.locked
	}
	if (element.opacity !== undefined && element.opacity !== BASE_EXPORT_DEFAULTS.opacity) {
		result.opacity = element.opacity
	}
	if (element.x !== undefined) result.x = element.x
	if (element.y !== undefined) result.y = element.y
	if (element.width !== undefined) result.width = element.width
	if (element.height !== undefined) result.height = element.height
	if (element.scaleX !== undefined && element.scaleX !== BASE_EXPORT_DEFAULTS.scaleX) {
		result.scaleX = element.scaleX
	}
	if (element.scaleY !== undefined && element.scaleY !== BASE_EXPORT_DEFAULTS.scaleY) {
		result.scaleY = element.scaleY
	}
	if (element.zIndex !== undefined) result.zIndex = element.zIndex
	if (element.interactionConfig !== undefined) {
		result.interactionConfig = exportInteractionConfig(element.interactionConfig)
	}

	return result
}

export function exportLayerElement(element: LayerElement): LayerElement {
	switch (element.type) {
		case ElementTypeEnum.Frame: {
			const result = assignBaseElementProps<FrameElement>(
				{ id: element.id, type: element.type },
				element,
			)
			if (element.children !== undefined) {
				result.children = element.children.map(exportLayerElement)
			}
			return result
		}

		case ElementTypeEnum.Group: {
			const result = assignBaseElementProps<GroupElement>(
				{ id: element.id, type: element.type },
				element,
			)
			if (element.children !== undefined) {
				result.children = element.children.map(exportLayerElement)
			}
			return result
		}

		case ElementTypeEnum.Rectangle: {
			const result = assignBaseElementProps<RectangleElement>(
				{ id: element.id, type: element.type },
				element,
			)
			if (element.fill !== undefined) result.fill = element.fill
			if (element.stroke !== undefined) result.stroke = element.stroke
			if (element.strokeWidth !== undefined) result.strokeWidth = element.strokeWidth
			if (element.cornerRadius !== undefined) result.cornerRadius = element.cornerRadius
			return result
		}

		case ElementTypeEnum.Star: {
			const result = assignBaseElementProps<StarElement>(
				{ id: element.id, type: element.type },
				element,
			)
			if (element.fill !== undefined) result.fill = element.fill
			if (element.stroke !== undefined) result.stroke = element.stroke
			if (element.strokeWidth !== undefined) result.strokeWidth = element.strokeWidth
			if (element.cornerRadius !== undefined) result.cornerRadius = element.cornerRadius
			if (element.sides !== undefined) result.sides = element.sides
			if (element.innerRadiusRatio !== undefined) {
				result.innerRadiusRatio = element.innerRadiusRatio
			}
			return result
		}

		case ElementTypeEnum.Ellipse:
		case ElementTypeEnum.Triangle: {
			const result = assignBaseElementProps<EllipseElement | TriangleElement>(
				{ id: element.id, type: element.type },
				element,
			)
			if (element.fill !== undefined) result.fill = element.fill
			if (element.stroke !== undefined) result.stroke = element.stroke
			if (element.strokeWidth !== undefined) result.strokeWidth = element.strokeWidth
			return result
		}

		case ElementTypeEnum.Text: {
			const result = assignBaseElementProps<TextElement>(
				{ id: element.id, type: element.type },
				element,
			)
			if (element.content !== undefined) {
				result.content = element.content.map(exportRichTextParagraph)
			}
			const defaultStyle = compactTextDefaultStyle(element.defaultStyle)
			if (defaultStyle !== undefined) {
				result.defaultStyle = exportTextStyle(defaultStyle)
			}
			return result
		}

		case ElementTypeEnum.Image: {
			const result = assignBaseElementProps<ImageElement>(
				{ id: element.id, type: element.type },
				element,
			)
			if (element.src !== undefined) result.src = element.src
			if (element.status !== undefined) result.status = element.status
			if (element.errorMessage !== undefined) result.errorMessage = element.errorMessage
			if (element.generateImageRequest !== undefined) {
				result.generateImageRequest = cloneSerializable(element.generateImageRequest)
			}
			const imageGenerationTaskMeta = getImageGenerationTaskMeta(element)
			if (imageGenerationTaskMeta !== undefined) {
				result.imageGenerationTaskMeta = cloneSerializable(imageGenerationTaskMeta)
			}
			if (element.crop !== undefined) {
				result.crop = exportCropConfig(element.crop)
			}
			return result
		}

		case ElementTypeEnum.Video: {
			const result = assignBaseElementProps<VideoElement>(
				{ id: element.id, type: element.type },
				element,
			)
			if (element.src !== undefined) result.src = element.src
			if (element.status !== undefined) result.status = element.status
			if (element.errorMessage !== undefined) result.errorMessage = element.errorMessage
			if (element.generateVideoRequest !== undefined) {
				result.generateVideoRequest = cloneSerializable(element.generateVideoRequest)
			}
			return result
		}

		default:
			return element
	}
}

export function exportCanvasDocument(elements: LayerElement[]): CanvasDocument {
	return {
		elements: elements.map(exportLayerElement),
	}
}
