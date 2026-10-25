import type { ElementRect } from "../types"

export const GAP_HANDLE_MIN_HIT = 16
export type GapAxis = "row" | "column"
export type GapChildRect = ElementRect & { position?: string; display?: string }

export interface GapHandleFrame {
	id: string
	axis: GapAxis
	left: number
	top: number
	width: number
	height: number
	cursor: "col-resize" | "row-resize"
	valueLabel?: string
}

const ROW_OVERLAP_RATIO = 0.5

export function isFlexOrGridDisplay(display: string): boolean {
	return (
		display === "flex" ||
		display === "inline-flex" ||
		display === "grid" ||
		display === "inline-grid"
	)
}

export function getInFlowChildRects(children: GapChildRect[]): ElementRect[] {
	return children.filter((child) => {
		const position = (child.position || "static").toLowerCase()
		const display = (child.display || "block").toLowerCase()
		return display !== "none" && position !== "absolute" && position !== "fixed"
	})
}

function overlap(a0: number, a1: number, b0: number, b1: number): number {
	return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
}

function shareRow(a: ElementRect, b: ElementRect): boolean {
	const minH = Math.min(a.height, b.height)
	return (
		minH > 0 &&
		overlap(a.top, a.top + a.height, b.top, b.top + b.height) / minH >= ROW_OVERLAP_RATIO
	)
}

function shareColumn(a: ElementRect, b: ElementRect): boolean {
	const minW = Math.min(a.width, b.width)
	return (
		minW > 0 &&
		overlap(a.left, a.left + a.width, b.left, b.left + b.width) / minW >= ROW_OVERLAP_RATIO
	)
}

export function getGapHandleLayout(
	containerRect: ElementRect,
	childRects: GapChildRect[],
	display: string,
): GapHandleFrame[] {
	if (!isFlexOrGridDisplay(display)) return []
	const children = getInFlowChildRects(childRects)
	if (children.length < 2) return []

	const frames: GapHandleFrame[] = []
	for (const leftChild of children) {
		const rightChild = nearestAlongAxis(leftChild, children, "column")
		if (!rightChild) continue
		const gap = Math.max(0, rightChild.left - (leftChild.left + leftChild.width))
		const hit = GAP_HANDLE_MIN_HIT
		const centerX = leftChild.left + leftChild.width + gap / 2
		const top = Math.max(leftChild.top, rightChild.top)
		const bottom = Math.min(
			leftChild.top + leftChild.height,
			rightChild.top + rightChild.height,
		)
		const centerY = (top + bottom) / 2
		frames.push({
			id: `column:${children.indexOf(leftChild)}:${children.indexOf(rightChild)}`,
			axis: "column",
			left: centerX - containerRect.left - hit / 2,
			top: centerY - containerRect.top - hit / 2,
			width: hit,
			height: hit,
			cursor: "col-resize",
		})
	}

	for (const above of children) {
		const below = nearestAlongAxis(above, children, "row")
		if (!below) continue
		const gap = Math.max(0, below.top - (above.top + above.height))
		const hit = GAP_HANDLE_MIN_HIT
		const centerY = above.top + above.height + gap / 2
		const left = Math.max(above.left, below.left)
		const right = Math.min(above.left + above.width, below.left + below.width)
		const centerX = (left + right) / 2
		frames.push({
			id: `row:${children.indexOf(above)}:${children.indexOf(below)}`,
			axis: "row",
			left: centerX - containerRect.left - hit / 2,
			top: centerY - containerRect.top - hit / 2,
			width: hit,
			height: hit,
			cursor: "row-resize",
		})
	}

	return frames
}

function nearestAlongAxis(
	origin: ElementRect,
	children: ElementRect[],
	axis: GapAxis,
): ElementRect | null {
	let nearest: ElementRect | null = null
	for (const other of children) {
		if (other === origin) continue
		if (axis === "column") {
			if (!shareRow(origin, other)) continue
			if (other.left < origin.left + origin.width - 0.5) continue
			if (!nearest || other.left < nearest.left) nearest = other
			continue
		}
		if (!shareColumn(origin, other)) continue
		if (other.top < origin.top + origin.height - 0.5) continue
		if (!nearest || other.top < nearest.top) nearest = other
	}
	return nearest
}

/** Map iframe-space frames into the scaled selection box. */
export function mapGapHandlesToSelectionBox(
	frames: GapHandleFrame[],
	containerRect: Pick<ElementRect, "width" | "height">,
	scaleRatio: number,
): GapHandleFrame[] {
	const scale = scaleRatio > 0 ? scaleRatio : 1
	const boxWidth = containerRect.width * scale
	const boxHeight = containerRect.height * scale
	return frames.map((frame) => {
		const width = Math.max(8, frame.width * scale)
		const height = Math.max(8, frame.height * scale)
		return {
			...frame,
			left: Math.min(Math.max(0, frame.left * scale), Math.max(0, boxWidth - width)),
			top: Math.min(Math.max(0, frame.top * scale), Math.max(0, boxHeight - height)),
			width,
			height,
		}
	})
}

/** Shift later siblings so gutter ticks follow a live gap preview. */
export function applyGapPreviewToChildRects(
	children: GapChildRect[],
	axis: GapAxis,
	extraPx: number,
	linked = false,
): GapChildRect[] {
	if (extraPx === 0) return children
	const inFlow = getInFlowChildRects(children)
	return children.map((child) => {
		if (!inFlow.includes(child)) return child
		let { left, top } = child
		if (axis === "column" || linked) {
			const gutters = inFlow.filter(
				(other) => shareRow(child, other) && other.left < child.left - 0.5,
			).length
			left += extraPx * gutters
		}
		if (axis === "row" || linked) {
			const gutters = inFlow.filter(
				(other) => shareColumn(child, other) && other.top < child.top - 0.5,
			).length
			top += extraPx * gutters
		}
		return { ...child, left, top }
	})
}
