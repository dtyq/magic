import {
	ElementTypeEnum,
	type CanvasDocument,
	type CropConfig,
	type InteractionConfig,
	type LayerElement,
	type StoryboardShot,
	type TextStyle,
} from "./types"
import { compactTextDefaultStyle } from "../text/richText"
import { getContents } from "./elementContent"
import { normalizeStoryboardShot } from "./storyboardMigration"

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

function assignBaseElementProps(
	result: Record<string, unknown>,
	element: LayerElement,
): Record<string, unknown> {
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
	const result = exportLayerElementInternal(element)
	const contents = getContents(element).map((content) => {
		const serialized = cloneSerializable(content) as unknown as Record<string, unknown>
		if (element.type === ElementTypeEnum.Image && serialized.discarded !== true) {
			delete serialized.discarded
		}
		if (element.type === ElementTypeEnum.Image && serialized.crop) {
			serialized.crop = exportCropConfig(serialized.crop as CropConfig)
		}
		if (element.type === ElementTypeEnum.Text && serialized.defaultStyle) {
			serialized.defaultStyle = exportTextStyle(
				compactTextDefaultStyle(serialized.defaultStyle as TextStyle),
			)
		}
		if (element.type === ElementTypeEnum.Storyboard && Array.isArray(serialized.shots)) {
			serialized.shots = (serialized.shots as Array<Record<string, unknown>>).map((shot) =>
				normalizeStoryboardShot(shot as unknown as StoryboardShot),
			)
		}
		return serialized
	})
	result.contents = contents
	result.activeContentId = element.activeContentId ?? null
	result.mainContentId = element.mainContentId ?? null
	return result as unknown as LayerElement
}

function exportLayerElementInternal(element: LayerElement): Record<string, unknown> {
	const result = assignBaseElementProps({ id: element.id, type: element.type }, element)
	// Frame/Group 的 children 属于 Element 外壳，其余业务字段统一由 contents 导出。
	if ("children" in element && element.children !== undefined) {
		result.children = element.children.map(exportLayerElement)
	}
	return result
}

export function exportCanvasDocument(elements: LayerElement[]): CanvasDocument {
	return {
		elements: elements.map(exportLayerElement),
	}
}
