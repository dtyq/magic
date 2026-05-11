export type TextDecorationKind = "underline" | "strikethrough"

export interface TextDecorationSource {
	x: number
	y: number
	width: number
	height: number
	fontSize: number
	color: string
	underline?: boolean
	strikethrough?: boolean
}

export interface TextDecorationRect {
	kind: TextDecorationKind
	x: number
	y: number
	width: number
	height: number
	color: string
}

const TEXT_DECORATION_THICKNESS_RATIO = 0.06
const UNDERLINE_BOTTOM_OFFSET_RATIO = 0.12
const STRIKETHROUGH_CENTER_RATIO = 0.54

export function getTextDecorationRects(source: TextDecorationSource): TextDecorationRect[] {
	if (source.width <= 0 || source.height <= 0) {
		return []
	}

	const thickness = getTextDecorationThickness(source.fontSize)
	const rects: TextDecorationRect[] = []

	if (source.underline) {
		rects.push({
			kind: "underline",
			x: source.x,
			y:
				source.y +
				source.height -
				thickness -
				source.fontSize * UNDERLINE_BOTTOM_OFFSET_RATIO,
			width: source.width,
			height: thickness,
			color: source.color,
		})
	}

	if (source.strikethrough) {
		rects.push({
			kind: "strikethrough",
			x: source.x,
			y: source.y + source.height * STRIKETHROUGH_CENTER_RATIO - thickness / 2,
			width: source.width,
			height: thickness,
			color: source.color,
		})
	}

	return rects
}

function getTextDecorationThickness(fontSize: number): number {
	return Math.max(1, fontSize * TEXT_DECORATION_THICKNESS_RATIO)
}
