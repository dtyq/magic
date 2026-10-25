import type { FrameElement, LayerElement } from "../../document/types"
import { FrameElement as FrameElementClass } from "../../elements/frame/FrameElement"
import { normalizeFrameCreationSize } from "../../shared/normalize/normalizeUtils"

export const FRAME_CONTENT_PADDING_RATIO = 0.08
export const FRAME_CONTENT_VERTICAL_GAP = 50

export interface FrameContentLayout {
	padding: number
	width: number
	height: number
}

export interface FrameChildrenBounds {
	minX: number
	maxX: number
	minY: number
	maxY: number
	width: number
	height: number
	padding: number
}

export interface FrameChildrenBoundsOptions {
	/** Preserve an already sufficient container size; only grow when required. */
	existingWidth?: number
	existingHeight?: number
}

interface ContentFrameSize {
	width: number
	height: number
}

interface CreateContentFrameDataOptions extends ContentFrameSize {
	id: string
	x: number
	y: number
	zIndex: number
	name?: string
	children?: LayerElement[]
	padding?: number
}

/** 画框四周 padding 默认取内容短边的 8%。 */
export function resolveFrameContentLayout(
	size: ContentFrameSize,
	options: { padding?: number } = {},
): FrameContentLayout {
	const contentWidth = Math.max(0, size.width)
	const contentHeight = Math.max(0, size.height)
	const contentShortEdge = Math.min(contentWidth, contentHeight)
	const padding = Math.max(0, options.padding ?? contentShortEdge * FRAME_CONTENT_PADDING_RATIO)
	const frameSize = normalizeFrameCreationSize(
		contentWidth + padding * 2,
		contentHeight + padding * 2,
	)

	return {
		padding,
		...frameSize,
	}
}

/**
 * Recomputes a container's local size without moving its top-left origin.
 * Children created by Canvas are normally already inside the positive local quadrant;
 * the max-with-right-edge fallback preserves the fixed origin and prevents an existing
 * positive offset from being lost when the union is converted back to container size.
 */
export function resolveFrameChildrenBounds(
	children: readonly Pick<LayerElement, "x" | "y" | "width" | "height">[],
	options: FrameChildrenBoundsOptions = {},
): FrameChildrenBounds | null {
	if (children.length === 0) return null

	const bounds = children.reduce(
		(result, child) => {
			const x = Number.isFinite(child.x) ? (child.x as number) : 0
			const y = Number.isFinite(child.y) ? (child.y as number) : 0
			const width = Math.max(0, Number.isFinite(child.width) ? (child.width as number) : 0)
			const height = Math.max(0, Number.isFinite(child.height) ? (child.height as number) : 0)
			return {
				minX: Math.min(result.minX, x),
				maxX: Math.max(result.maxX, x + width),
				minY: Math.min(result.minY, y),
				maxY: Math.max(result.maxY, y + height),
			}
		},
		{ minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
	)
	const contentWidth = Math.max(0, bounds.maxX - bounds.minX)
	const contentHeight = Math.max(0, bounds.maxY - bounds.minY)
	const { padding } = resolveFrameContentLayout({
		width: contentWidth,
		height: contentHeight,
	})
	const normalizedSize = normalizeFrameCreationSize(
		Math.max(0, bounds.maxX + padding, contentWidth + padding * 2),
		Math.max(0, bounds.maxY + padding, contentHeight + padding * 2),
	)
	const existingWidth = Number.isFinite(options.existingWidth)
		? Math.max(0, options.existingWidth as number)
		: 0
	const existingHeight = Number.isFinite(options.existingHeight)
		? Math.max(0, options.existingHeight as number)
		: 0

	return {
		...bounds,
		width: Math.max(existingWidth, normalizedSize.width),
		height: Math.max(existingHeight, normalizedSize.height),
		padding,
	}
}

/** 统一创建“包裹内容”的画框数据；调用方负责创建元素和处理事务。 */
export function createContentFrameData(options: CreateContentFrameDataOptions): {
	frameData: FrameElement
	layout: FrameContentLayout
} {
	const layout = resolveFrameContentLayout(options, { padding: options.padding })
	const frameData: FrameElement = {
		...FrameElementClass.createElementData(
			options.id,
			options.x,
			options.y,
			layout.width,
			layout.height,
			options.zIndex,
		),
		...(options.name ? { name: options.name } : {}),
		...(options.children ? { children: options.children } : {}),
	}

	return { frameData, layout }
}

/** 纵向堆叠子元素时，计算指定索引相对内容区顶部的偏移。 */
export function getVerticalFrameContentOffset(heights: number[], index: number): number {
	return heights
		.slice(0, index)
		.reduce((total, height) => total + height + FRAME_CONTENT_VERTICAL_GAP, 0)
}

/** 纵向堆叠子元素所需的内容区高度，不含 Frame padding。 */
export function getVerticalFrameContentHeight(heights: number[]): number {
	return (
		heights.reduce((total, height) => total + height, 0) +
		Math.max(0, heights.length - 1) * FRAME_CONTENT_VERTICAL_GAP
	)
}
