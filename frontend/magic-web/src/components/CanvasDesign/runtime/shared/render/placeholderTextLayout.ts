import Konva from "konva"

export interface PlaceholderTextLayoutOptions {
	text: string
	availableWidth: number
	inverseScaleX: number
	fontSize: number
	fontFamily: string
	horizontalInset?: number
	maxWidthRatio?: number
	maxHeight?: number
	paddingX?: number
	paddingY?: number
	fill?: string
	name?: string
	listening?: boolean
}

export interface PlaceholderTextLayout {
	naturalWidth: number
	nodeWidth: number
	textWidth: number
	textHeight: number
	backgroundWidth: number
	backgroundHeight: number
	lineCount: number
	maxTextWidth: number
	truncated: boolean
}

export interface PlaceholderTextNodeResult {
	node: Konva.Text
	layout: PlaceholderTextLayout
}

const DEFAULT_HORIZONTAL_INSET = 16
const DEFAULT_MAX_WIDTH_RATIO = 0.8

export function createPlaceholderTextNode(
	options: PlaceholderTextLayoutOptions,
): PlaceholderTextNodeResult {
	const {
		text,
		availableWidth,
		inverseScaleX,
		fontSize,
		fontFamily,
		horizontalInset = DEFAULT_HORIZONTAL_INSET,
		maxWidthRatio = DEFAULT_MAX_WIDTH_RATIO,
		maxHeight,
		paddingX = 0,
		paddingY = 0,
		fill,
		name,
		listening = false,
	} = options

	const measureNode = new Konva.Text({
		text,
		fontSize,
		fontFamily,
		listening: false,
	})
	const naturalWidth = Math.max(1, measureNode.getTextWidth())
	const scale = Math.max(Math.abs(inverseScaleX), 0.001)
	const safeWidth = Math.max(1, availableWidth - horizontalInset * 2)
	const maxTextWidth = Math.max(1, Math.min(safeWidth, availableWidth * maxWidthRatio) / scale)
	const nodeWidth = Math.min(naturalWidth, maxTextWidth)

	const node = new Konva.Text({
		text,
		fontSize,
		fontFamily,
		width: nodeWidth,
		...(maxHeight !== undefined
			? {
					height: Math.max(1, maxHeight),
					ellipsis: true,
				}
			: {}),
		wrap: "char",
		align: "center",
		fill,
		name,
		listening,
	})
	const naturalWrappedNode = new Konva.Text({
		text,
		fontSize,
		fontFamily,
		width: nodeWidth,
		wrap: "char",
		listening: false,
	})

	const lineHeight = Math.max(1, node.fontSize() * node.lineHeight())
	const textHeight = node.height()
	const textWidth = Math.max(1, node.getTextWidth())
	const lineCount = Math.max(1, Math.round(textHeight / lineHeight))
	const truncated = Boolean(maxHeight !== undefined && naturalWrappedNode.height() > maxHeight)

	return {
		node,
		layout: {
			naturalWidth,
			nodeWidth,
			textWidth,
			textHeight,
			backgroundWidth: textWidth + paddingX * 2,
			backgroundHeight: textHeight + paddingY * 2,
			lineCount,
			maxTextWidth,
			truncated,
		},
	}
}

export function applyPlaceholderTextLayout(
	node: Konva.Text,
	result: PlaceholderTextNodeResult,
): void {
	node.setAttrs({
		width: result.layout.nodeWidth,
		wrap: "char",
		ellipsis: result.layout.truncated,
	})
	node.setAttr("height", result.layout.truncated ? result.layout.textHeight : undefined)
}
