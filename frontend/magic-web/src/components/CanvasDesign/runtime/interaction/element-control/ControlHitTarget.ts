import type Konva from "konva"

export interface ControlHitRectBounds {
	x: number
	y: number
	width: number
	height: number
	expandX?: boolean
	maxWidth?: number
}

export function syncControlHitRect(
	hit: Konva.Rect,
	bounds: ControlHitRectBounds,
	minimumScreenSize: number,
	minimumScreenHeight = minimumScreenSize,
): void {
	const absoluteScale = hit.getAbsoluteScale()
	const scaleX = Math.max(0.0001, Math.abs(absoluteScale.x))
	const scaleY = Math.max(0.0001, Math.abs(absoluteScale.y))
	const desiredWidth =
		bounds.expandX === false ? bounds.width : Math.max(bounds.width, minimumScreenSize / scaleX)
	const width = Math.min(bounds.maxWidth ?? Number.POSITIVE_INFINITY, desiredWidth)
	const height = Math.max(bounds.height, minimumScreenHeight / scaleY)

	hit.setAttrs({
		x: bounds.x - (width - bounds.width) / 2,
		y: bounds.y - (height - bounds.height) / 2,
		width,
		height,
	})
}

export function syncControlHitCircle(
	hit: Konva.Circle,
	baseRadius: number,
	minimumScreenSize: number,
): void {
	const absoluteScale = hit.getAbsoluteScale()
	const minimumScale = Math.max(
		0.0001,
		Math.min(Math.abs(absoluteScale.x), Math.abs(absoluteScale.y)),
	)
	hit.radius(Math.max(baseRadius, minimumScreenSize / minimumScale / 2))
}

export function moveControlHitsToTop(root: Konva.Node, selector: string): void {
	root.find(selector).forEach((candidate) => candidate.moveToTop())
}
