import type { LayerElement } from "../types"
import type { Rect } from "./utils"

/**
 * 与后端 `backend/.../constants.py` 中 `DEFAULT_ELEMENT_SPACING` 一致。
 * Agent / `BaseGenerateCanvasElements._prepare_placeholders` 新建占位符时使用。
 */
export const AGENT_PLACEHOLDER_ELEMENT_SPACING = 200

/**
 * 与后端 `BaseGenerateCanvasElements._max_elements_per_row` 默认一致（子类可覆盖为其它值；前端固定 6）。
 */
export const AGENT_PLACEHOLDER_MAX_PER_ROW = 6

/** 判定「最后一行」时，与最大 `y` 的容差（像素），与后端一致 */
const LAST_ROW_Y_TOLERANCE_PX = 1

/** 在当前 viewport 附近向外搜索空位的圈数 */
export const DEFAULT_VIEWPORT_SEARCH_RINGS = 4

/**
 * 将顶层元素的逻辑框转为轴对齐包围盒（与画布绝对坐标一致；顶层无父时即 absolute_x/y）。
 */
export function layerElementToObstacleRect(element: LayerElement): Rect | null {
	if (!element.width || !element.height) return null
	const w = element.width * (element.scaleX || 1)
	const h = element.height * (element.scaleY || 1)
	return {
		x: element.x || 0,
		y: element.y || 0,
		width: w,
		height: h,
	}
}

export function collectObstacleRects(
	elements: LayerElement[],
	shouldInclude: (element: LayerElement) => boolean,
): Rect[] {
	const rects: Rect[] = []
	for (const el of elements) {
		if (!shouldInclude(el)) continue
		const r = layerElementToObstacleRect(el)
		if (r) rects.push(r)
	}
	return rects
}

function createRect(x: number, y: number, width: number, height: number): Rect {
	return { x, y, width, height }
}

function createRectFromCenter(
	center: { x: number; y: number },
	width: number,
	height: number,
): Rect {
	return createRect(center.x - width / 2, center.y - height / 2, width, height)
}

function isOverlappingWithSpacing(candidate: Rect, obstacle: Rect, spacing: number): boolean {
	return (
		candidate.x < obstacle.x + obstacle.width + spacing &&
		candidate.x + candidate.width > obstacle.x - spacing &&
		candidate.y < obstacle.y + obstacle.height + spacing &&
		candidate.y + candidate.height > obstacle.y - spacing
	)
}

function isRectInsideViewport(rect: Rect, viewportRect: Rect): boolean {
	return (
		rect.x >= viewportRect.x &&
		rect.y >= viewportRect.y &&
		rect.x + rect.width <= viewportRect.x + viewportRect.width &&
		rect.y + rect.height <= viewportRect.y + viewportRect.height
	)
}

function buildSpiralOffsets(maxSearchRings: number): Array<{ dx: number; dy: number }> {
	const offsets: Array<{ dx: number; dy: number }> = [{ dx: 0, dy: 0 }]
	if (maxSearchRings <= 0) return offsets

	let currentX = 0
	let currentY = 0
	let stepLength = 1
	const directions = [
		{ dx: 1, dy: 0 },
		{ dx: 0, dy: 1 },
		{ dx: -1, dy: 0 },
		{ dx: 0, dy: -1 },
	]

	while (Math.max(Math.abs(currentX), Math.abs(currentY)) < maxSearchRings) {
		for (let directionIndex = 0; directionIndex < directions.length; directionIndex++) {
			const direction = directions[directionIndex]
			for (let step = 0; step < stepLength; step++) {
				currentX += direction.dx
				currentY += direction.dy
				if (Math.max(Math.abs(currentX), Math.abs(currentY)) <= maxSearchRings) {
					offsets.push({ dx: currentX, dy: currentY })
				}
			}

			if (directionIndex % 2 === 1) {
				stepLength += 1
			}
		}
	}

	return offsets
}

/**
 * 计算下一个图片/视频占位符左上角，算法对齐后端 `_prepare_placeholders`（单行向右延伸 / 满行换行）。
 *
 * - 空画布：`(0, 0)`
 * - 非空：取全局最大 `y` 定义「最后一行」；若该行元素数 `< maxPerRow`，放在该行最右元素右侧 + spacing；否则新行从 `x=0`、`y = 全局最大底边 + spacing` 开始。
 */
export function findNextImageVideoPlaceholderPosition(
	obstacles: Rect[],
	options?: {
		spacing?: number
		maxPerRow?: number
	},
): { x: number; y: number } {
	const spacing = options?.spacing ?? AGENT_PLACEHOLDER_ELEMENT_SPACING
	const maxPerRow = options?.maxPerRow ?? AGENT_PLACEHOLDER_MAX_PER_ROW

	if (obstacles.length === 0) {
		return { x: 0, y: 0 }
	}

	let maxY = -Infinity
	for (const o of obstacles) {
		maxY = Math.max(maxY, o.y)
	}

	const lastRow = obstacles.filter((o) => Math.abs(o.y - maxY) < LAST_ROW_Y_TOLERANCE_PX)

	let startX: number
	let startY: number

	if (lastRow.length < maxPerRow) {
		let rightmost = lastRow[0]
		for (let i = 1; i < lastRow.length; i++) {
			const o = lastRow[i]
			if (o.x > rightmost.x) {
				rightmost = o
			}
		}
		startX = rightmost.x + rightmost.width + spacing
		startY = maxY
	} else {
		let maxBottom = -Infinity
		for (const o of obstacles) {
			maxBottom = Math.max(maxBottom, o.y + o.height)
		}
		startX = 0
		startY = maxBottom + spacing
	}

	return { x: startX, y: startY }
}

/**
 * 优先在当前 viewport 附近寻找图片/视频占位符位置；找不到时回退到全局末行布局。
 */
export function findNextImageVideoPlaceholderPositionNearViewport(
	obstacles: Rect[],
	options: {
		elementWidth: number
		elementHeight: number
		viewportRect: Rect
		anchor?: { x: number; y: number }
		spacing?: number
		maxPerRow?: number
		maxSearchRings?: number
	},
): { x: number; y: number } {
	const spacing = options.spacing ?? AGENT_PLACEHOLDER_ELEMENT_SPACING
	const anchor = options.anchor ?? {
		x: options.viewportRect.x + options.viewportRect.width / 2,
		y: options.viewportRect.y + options.viewportRect.height / 2,
	}
	const candidateOffsets = buildSpiralOffsets(
		options.maxSearchRings ?? DEFAULT_VIEWPORT_SEARCH_RINGS,
	)
	const stepX = options.elementWidth + spacing
	const stepY = options.elementHeight + spacing

	const resolveCandidate = (requireInsideViewport: boolean): { x: number; y: number } | null => {
		for (const offset of candidateOffsets) {
			const candidateRect = createRectFromCenter(
				{
					x: anchor.x + offset.dx * stepX,
					y: anchor.y + offset.dy * stepY,
				},
				options.elementWidth,
				options.elementHeight,
			)

			if (
				requireInsideViewport &&
				!isRectInsideViewport(candidateRect, options.viewportRect)
			) {
				continue
			}

			const hasOverlap = obstacles.some((obstacle) =>
				isOverlappingWithSpacing(candidateRect, obstacle, spacing),
			)
			if (!hasOverlap) {
				return { x: candidateRect.x, y: candidateRect.y }
			}
		}

		return null
	}

	return (
		resolveCandidate(true) ||
		resolveCandidate(false) ||
		findNextImageVideoPlaceholderPosition(obstacles, {
			spacing,
			maxPerRow: options.maxPerRow,
		})
	)
}
