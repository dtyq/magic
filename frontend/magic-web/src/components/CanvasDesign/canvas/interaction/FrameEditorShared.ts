import Konva from "konva"
import type { Box } from "konva/lib/shapes/Transformer"

export const FRAME_EDITOR_CONFIG = {
	BOX_STROKE: "#fff",
	BOX_STROKE_WIDTH: 2,
	TRANSFORMER_ANCHOR_SIZE: 10,
	TRANSFORMER_BORDER_STROKE: "rgba(255, 255, 255, 1)",
	TRANSFORMER_BORDER_STROKE_WIDTH: 2,
	TRANSFORMER_ANCHOR_STROKE: "rgba(200, 200, 200, 1)",
	TRANSFORMER_ANCHOR_FILL: "#FFFFFF",
	TRANSFORMER_ANCHOR_STROKE_WIDTH: 0.8,
	GRID_LINE_STROKE: "rgba(255, 255, 255, 1)",
	GRID_LINE_STROKE_WIDTH: 2,
	GRID_DIVISIONS: 3,
} as const

export const STANDARD_TRANSFORMER_STYLE = {
	ANCHOR_SIZE: 8,
	BORDER_STROKE: "#3B82F6",
	BORDER_STROKE_WIDTH: 1.25,
	ANCHOR_STROKE: "#3B82F6",
	ANCHOR_FILL: "#FFFFFF",
	ANCHOR_STROKE_WIDTH: 1.25,
	ANCHOR_OPACITY: 0,
	IGNORE_STROKE: true,
} as const

export function createFrameEditorAnchorStyleFunc(anchorSize: number) {
	return (anchor: Konva.Rect) => {
		const name = anchor.name()
		const parent = anchor.getParent()
		const parentSize = parent?.getSize()
		const horizontal = name.startsWith("top-center") || name.startsWith("bottom-center")
		const vertical = name.startsWith("middle-left") || name.startsWith("middle-right")

		if (horizontal || vertical) {
			const size =
				((horizontal ? parentSize?.width : parentSize?.height) || 0) - anchorSize * 2

			switch (name) {
				case "top-center _anchor":
					if (parentSize) {
						anchor.width(size)
						anchor.position({
							x: (parentSize.width - size) / 2 + anchorSize / 2,
							y: 0,
						})
					} else {
						anchor.width(anchorSize * 2)
					}
					anchor.height(anchorSize)
					break
				case "bottom-center _anchor":
					if (parentSize) {
						anchor.width(size)
						anchor.position({
							x: (parentSize.width - size) / 2 + anchorSize / 2,
							y: parentSize.height,
						})
					} else {
						anchor.width(anchorSize * 2)
					}
					anchor.height(anchorSize)
					break
				case "middle-left _anchor":
					if (parentSize) {
						anchor.height(size)
						anchor.position({
							x: 0,
							y: (parentSize.height - size) / 2 + anchorSize / 2,
						})
					} else {
						anchor.height(anchorSize * 2)
					}
					anchor.width(anchorSize)
					break
				case "middle-right _anchor":
					if (parentSize) {
						anchor.height(size)
						anchor.position({
							x: parentSize.width,
							y: (parentSize.height - size) / 2 + anchorSize / 2,
						})
					} else {
						anchor.height(anchorSize * 2)
					}
					anchor.width(anchorSize)
					break
				default:
					break
			}

			anchor.opacity(0)
		}
	}
}

export function createFrameGridLines(
	rect: { x: number; y: number; width: number; height: number },
	lineName: string,
	divisions = FRAME_EDITOR_CONFIG.GRID_DIVISIONS,
): Konva.Line[] {
	const { x, y, width, height } = rect
	const stroke = FRAME_EDITOR_CONFIG.GRID_LINE_STROKE
	const strokeWidth = FRAME_EDITOR_CONFIG.GRID_LINE_STROKE_WIDTH

	return [
		new Konva.Line({
			points: [x + width / divisions, y, x + width / divisions, y + height],
			stroke,
			strokeWidth,
			name: lineName,
			listening: false,
		}),
		new Konva.Line({
			points: [x + (width * 2) / divisions, y, x + (width * 2) / divisions, y + height],
			stroke,
			strokeWidth,
			name: lineName,
			listening: false,
		}),
		new Konva.Line({
			points: [x, y + height / divisions, x + width, y + height / divisions],
			stroke,
			strokeWidth,
			name: lineName,
			listening: false,
		}),
		new Konva.Line({
			points: [x, y + (height * 2) / divisions, x + width, y + (height * 2) / divisions],
			stroke,
			strokeWidth,
			name: lineName,
			listening: false,
		}),
	]
}

export function updateFrameGridLines(
	overlayGroup: Konva.Group | undefined,
	rect: { x: number; y: number; width: number; height: number },
	lineName: string,
	divisions = FRAME_EDITOR_CONFIG.GRID_DIVISIONS,
): void {
	if (!overlayGroup) return

	const lines = overlayGroup.find(`.${lineName}`)
	const { x, y, width, height } = rect

	lines.forEach((line, index) => {
		if (!(line instanceof Konva.Line)) return

		switch (index) {
			case 0:
				line.points([x + width / divisions, y, x + width / divisions, y + height])
				break
			case 1:
				line.points([
					x + (width * 2) / divisions,
					y,
					x + (width * 2) / divisions,
					y + height,
				])
				break
			case 2:
				line.points([x, y + height / divisions, x + width, y + height / divisions])
				break
			case 3:
				line.points([
					x,
					y + (height * 2) / divisions,
					x + width,
					y + (height * 2) / divisions,
				])
				break
			default:
				break
		}
	})
}

export function boxToLocalBox(container: Konva.Node | undefined, box: Box): Box | null {
	if (!container) return null

	try {
		const transform = container.getAbsoluteTransform().copy().invert()
		const corners = [
			{ x: box.x, y: box.y },
			{ x: box.x + box.width, y: box.y },
			{ x: box.x, y: box.y + box.height },
			{ x: box.x + box.width, y: box.y + box.height },
		]
		const localCorners = corners.map((point) => transform.point(point))
		const minX = Math.min(...localCorners.map((point) => point.x))
		const minY = Math.min(...localCorners.map((point) => point.y))
		const maxX = Math.max(...localCorners.map((point) => point.x))
		const maxY = Math.max(...localCorners.map((point) => point.y))

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
			rotation: box.rotation,
		}
	} catch {
		return null
	}
}

export function localBoxToAbsoluteBox(container: Konva.Node | undefined, localBox: Box): Box {
	if (!container) return localBox

	const transform = container.getAbsoluteTransform()
	const corners = [
		{ x: localBox.x, y: localBox.y },
		{ x: localBox.x + localBox.width, y: localBox.y },
		{ x: localBox.x, y: localBox.y + localBox.height },
		{ x: localBox.x + localBox.width, y: localBox.y + localBox.height },
	]
	const absoluteCorners = corners.map((point) => transform.point(point))
	const minX = Math.min(...absoluteCorners.map((point) => point.x))
	const minY = Math.min(...absoluteCorners.map((point) => point.y))
	const maxX = Math.max(...absoluteCorners.map((point) => point.x))
	const maxY = Math.max(...absoluteCorners.map((point) => point.y))

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
		rotation: localBox.rotation,
	}
}

export function isManagedOverlayNode(
	node: Konva.Node | null,
	overlayGroupNames: string[],
): boolean {
	let current: Konva.Node | null = node

	while (current) {
		if (overlayGroupNames.includes(current.name())) return true
		current = current.getParent()
	}

	return false
}
