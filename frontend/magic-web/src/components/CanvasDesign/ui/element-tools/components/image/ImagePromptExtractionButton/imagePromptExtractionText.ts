import type { Canvas } from "../../../../../runtime/core/Canvas"
import {
	type ImageElement,
	type RichTextParagraph,
	type TextElement,
	type TextStyle,
} from "../../../../../runtime/document/types"
import { TextElement as TextElementClass } from "../../../../../runtime/elements/text/TextElement"
import { generateElementId, type Rect } from "../../../../../runtime/shared/ids"
import {
	compactTextDefaultStyle,
	createRichTextParagraph,
	getDefaultTextStyle,
} from "../../../../../runtime/text/richText"
import { measureRichTextLayout } from "../../../../../runtime/text/layout"
import {
	collectConnectionCreateObstacleRects,
	collectConnectedElementSiblingRects,
	resolveConnectionCreateGapForElement,
	type ConnectionCreatePlacementContext,
} from "../../../../../runtime/shared/placement/connectionCreatePlacement"
import { resolveConnectedPlacement } from "../../../../../runtime/shared/placement/placementEngine"
import { createElementFromElementConnection } from "../../../../../runtime/interaction/connection/elementConnectionCreation"

const IMAGE_PROMPT_TEXT_LINE_HEIGHT = 1.45

interface ImagePromptTextLayoutPreset {
	minEffectiveSize: number
	fontSize: number
	maxLineLength: number
}

export interface ImagePromptTextLayoutConfig {
	fontSize: number
	lineHeight: number
	maxLineLength: number
}

const IMAGE_PROMPT_TEXT_LAYOUT_PRESETS: ImagePromptTextLayoutPreset[] = [
	{ minEffectiveSize: 0, fontSize: 32, maxLineLength: 24 },
	{ minEffectiveSize: 768, fontSize: 44, maxLineLength: 24 },
	{ minEffectiveSize: 1280, fontSize: 64, maxLineLength: 24 },
	{ minEffectiveSize: 1800, fontSize: 96, maxLineLength: 24 },
	{ minEffectiveSize: 2600, fontSize: 128, maxLineLength: 25 },
	{ minEffectiveSize: 3600, fontSize: 168, maxLineLength: 26 },
	{ minEffectiveSize: 5200, fontSize: 224, maxLineLength: 27 },
]

interface ImagePromptTextMeasureResult {
	width: number
	height: number
}

interface BuildImagePromptTextElementDataOptions {
	imageElement: ImageElement
	prompt: string
	zIndex: number
	imageBoundingRect?: Rect | null
	elementId?: string
	defaultStyle?: TextStyle
	obstacleRects?: Rect[]
	siblingRects?: Rect[]
	measureLayout?: (
		content: RichTextParagraph[],
		defaultStyle: TextStyle,
	) => ImagePromptTextMeasureResult
}

export interface ImagePromptTextElementDataResult {
	element: TextElement
	connection: {
		sourceElementId: string
		targetElementId: string
	}
	displayPrompt: string
}

export function buildImagePromptTextElementData(
	options: BuildImagePromptTextElementDataOptions,
): ImagePromptTextElementDataResult {
	const elementId = options.elementId ?? generateElementId()
	const sourceRect = resolveImagePromptSourceRect(options.imageElement, options.imageBoundingRect)
	const layoutConfig = resolveImagePromptTextLayoutConfig(sourceRect)
	const defaultStyle = options.defaultStyle ?? getImagePromptTextDefaultStyle(layoutConfig)
	const displayPrompt = wrapPromptForTextNode(options.prompt, layoutConfig.maxLineLength)
	const content = buildImagePromptTextContent(
		displayPrompt,
		defaultStyle,
		layoutConfig.lineHeight,
	)
	const layout =
		options.measureLayout?.(content, defaultStyle) ??
		measureRichTextLayout(content, defaultStyle)
	const width = Math.max(Math.ceil(layout.width), 1)
	const height = Math.max(Math.ceil(layout.height), 1)
	const placementContext: ConnectionCreatePlacementContext = {
		originSide: "right",
		source: "handle",
		canvasX: sourceRect.x + sourceRect.width,
		canvasY: sourceRect.y + sourceRect.height / 2,
	}
	const point = resolveConnectedPlacement(
		undefined,
		placementContext,
		{ width, height },
		{
			output: "top-left",
			gap: resolveConnectionCreateGapForElement(options.imageElement, "right"),
			obstacleRects: options.obstacleRects,
			siblingRects: options.siblingRects,
		},
	)
	const element = TextElementClass.createElementData(
		elementId,
		point.x,
		point.y,
		width,
		height,
		options.zIndex,
		"",
	)
	element.contents = element.contents.map((item) =>
		item.contentId === element.activeContentId
			? {
					...item,
					content,
					defaultStyle: compactTextDefaultStyle(defaultStyle),
				}
			: item,
	)

	return {
		element,
		connection: {
			sourceElementId: options.imageElement.id,
			targetElementId: elementId,
		},
		displayPrompt,
	}
}

export function createImagePromptTextElement(options: {
	canvas: Canvas
	imageElement: ImageElement
	prompt: string
}): ImagePromptTextElementDataResult | null {
	const { canvas, imageElement, prompt } = options
	const normalizedPrompt = prompt.trim()
	if (!normalizedPrompt) return null

	const imageElementInstance = canvas.elementManager.getElementInstance(imageElement.id) as
		{ getBoundingRect?: () => Rect | null } | undefined
	const imageBoundingRect = imageElementInstance?.getBoundingRect?.() ?? null
	const result = buildImagePromptTextElementData({
		imageElement,
		prompt: normalizedPrompt,
		zIndex: canvas.elementManager.getNextZIndexInLevel(),
		imageBoundingRect,
		obstacleRects: collectConnectionCreateObstacleRects(canvas),
		siblingRects: collectConnectedElementSiblingRects(canvas, {
			originElementId: imageElement.id,
			originSide: "right",
		}),
	})

	const createdElementId = createElementFromElementConnection({
		canvas,
		origin: { kind: "element", elementId: imageElement.id, side: "right" },
		createElement: () => {
			canvas.elementManager.create(result.element)
			return result.element.id
		},
		afterConnect: ({ createdElementId: elementId }) => {
			canvas.selectionManager.selectMultiple([elementId])
		},
	})
	if (!createdElementId) return null

	if (typeof requestAnimationFrame !== "undefined") {
		requestAnimationFrame(() => {
			if (!canvas.viewportController.isElementInViewport([result.element.id])) {
				canvas.viewportController.moveElementToViewport([result.element.id], {
					animated: true,
					padding: { top: 50, right: 50, bottom: 50, left: 100 },
				})
			}
		})
	}

	return result
}

export function buildImagePromptTextContent(
	displayPrompt: string,
	defaultStyle: TextStyle = getImagePromptTextDefaultStyle(),
	lineHeight = IMAGE_PROMPT_TEXT_LINE_HEIGHT,
): RichTextParagraph[] {
	return displayPrompt
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => {
			const paragraph = createRichTextParagraph(line, defaultStyle)
			return {
				...paragraph,
				style: {
					...paragraph.style,
					lineHeight,
				},
			}
		})
}

export function wrapPromptForTextNode(
	prompt: string,
	maxLineLength = IMAGE_PROMPT_TEXT_LAYOUT_PRESETS[0].maxLineLength,
): string {
	const normalized = prompt.trim().replace(/\r\n?/g, "\n")
	if (!normalized) return ""
	return normalized
		.split("\n")
		.flatMap((line) => wrapPromptLine(line.trim(), maxLineLength))
		.join("\n")
}

function wrapPromptLine(line: string, maxLineLength: number): string[] {
	if (line.length <= maxLineLength) return [line]

	const chunks: string[] = []
	let rest = line
	while (rest.length > maxLineLength) {
		const boundary = findWrapBoundary(rest, maxLineLength)
		chunks.push(rest.slice(0, boundary).trim())
		rest = rest.slice(boundary).trim()
	}
	if (rest) chunks.push(rest)
	return chunks
}

function findWrapBoundary(text: string, maxLineLength: number): number {
	const windowText = text.slice(0, maxLineLength + 1)
	const punctuationBoundary = Math.max(
		windowText.lastIndexOf("，"),
		windowText.lastIndexOf("。"),
		windowText.lastIndexOf("、"),
		windowText.lastIndexOf(","),
		windowText.lastIndexOf("."),
		windowText.lastIndexOf(";"),
		windowText.lastIndexOf("；"),
	)
	if (punctuationBoundary >= Math.floor(maxLineLength * 0.5)) {
		return punctuationBoundary + 1
	}

	const spaceBoundary = windowText.lastIndexOf(" ")
	if (spaceBoundary >= Math.floor(maxLineLength * 0.5)) {
		return spaceBoundary + 1
	}

	return maxLineLength
}

export function resolveImagePromptTextLayoutConfig(
	sourceRect?: Rect | null,
): ImagePromptTextLayoutConfig {
	const effectiveSize = resolveImagePromptTextEffectiveSize(sourceRect)
	const preset = IMAGE_PROMPT_TEXT_LAYOUT_PRESETS.reduce((matchedPreset, candidatePreset) => {
		return effectiveSize >= candidatePreset.minEffectiveSize ? candidatePreset : matchedPreset
	}, IMAGE_PROMPT_TEXT_LAYOUT_PRESETS[0])

	return {
		fontSize: preset.fontSize,
		lineHeight: IMAGE_PROMPT_TEXT_LINE_HEIGHT,
		maxLineLength: adjustImagePromptTextLineLengthForAspectRatio(
			preset.maxLineLength,
			sourceRect,
		),
	}
}

function getImagePromptTextDefaultStyle(
	layoutConfig: ImagePromptTextLayoutConfig = resolveImagePromptTextLayoutConfig(),
): TextStyle {
	return {
		...getDefaultTextStyle(),
		fontSize: layoutConfig.fontSize,
	}
}

function resolveImagePromptTextEffectiveSize(sourceRect?: Rect | null): number {
	if (!sourceRect || !Number.isFinite(sourceRect.width) || !Number.isFinite(sourceRect.height)) {
		return 0
	}
	const width = Math.max(Math.abs(sourceRect.width), 1)
	const height = Math.max(Math.abs(sourceRect.height), 1)
	return Math.sqrt(width * height)
}

function adjustImagePromptTextLineLengthForAspectRatio(
	maxLineLength: number,
	sourceRect?: Rect | null,
): number {
	if (
		!sourceRect ||
		!Number.isFinite(sourceRect.width) ||
		!Number.isFinite(sourceRect.height) ||
		sourceRect.width <= 0 ||
		sourceRect.height <= 0
	) {
		return maxLineLength
	}

	const aspectRatio = sourceRect.width / sourceRect.height
	if (aspectRatio < 0.75) {
		return Math.max(maxLineLength - 2, 18)
	}
	if (aspectRatio > 1.6) {
		return maxLineLength + 2
	}
	return maxLineLength
}

function resolveImagePromptSourceRect(
	imageElement: ImageElement,
	imageBoundingRect?: Rect | null,
): Rect {
	if (
		imageBoundingRect &&
		Number.isFinite(imageBoundingRect.x) &&
		Number.isFinite(imageBoundingRect.y) &&
		Number.isFinite(imageBoundingRect.width) &&
		Number.isFinite(imageBoundingRect.height) &&
		imageBoundingRect.width > 0 &&
		imageBoundingRect.height > 0
	) {
		return imageBoundingRect
	}

	return {
		x: imageElement.x ?? 0,
		y: imageElement.y ?? 0,
		width: Math.max(Math.abs((imageElement.width ?? 1) * (imageElement.scaleX ?? 1)), 1),
		height: Math.max(Math.abs((imageElement.height ?? 1) * (imageElement.scaleY ?? 1)), 1),
	}
}
