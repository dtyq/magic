export type TemplateCanvasDirection = "up" | "right" | "down" | "left"

export interface TemplateCanvasPoint {
	x: number
	y: number
}

export interface TemplateCanvasSize {
	height: number
	width: number
}

export interface TemplateCanvasSpan {
	columns: number
	rows: number
}

export interface TemplateCanvasItem<T> {
	index: number
	item: T
	grid: TemplateCanvasPoint
	position: TemplateCanvasPoint
	renderKey?: string
	size: TemplateCanvasSize
	span: TemplateCanvasSpan
}

export interface TemplateCanvasBounds {
	minX: number
	maxX: number
	minY: number
	maxY: number
}

/**
 * Where the whole-card highlight of an onboarding run sits, in the canvas's own coordinates. The
 * canvas publishes one for the card it has centred for the tour, and the layer renders it as the
 * `data-guide-anchor` marker that the tour measures — measuring the card itself would mean reading
 * a box that the canvas transform, the layout and the idle loop each keep moving.
 */
export interface TemplateCanvasGuideAnchor extends TemplateCanvasPoint, TemplateCanvasSize {}

export interface TemplateCanvasInsets {
	top: number
	right: number
	bottom: number
	left: number
}

export const SLIDES_TEMPLATE_CANVAS_CARD_WIDTH = 312
export const SLIDES_TEMPLATE_CANVAS_CARD_HEIGHT = 176
export const SLIDES_TEMPLATE_CANVAS_GAP_X = 14
export const SLIDES_TEMPLATE_CANVAS_GAP_Y = 8
export const SLIDES_TEMPLATE_CANVAS_DEFAULT_GRID_SPAN = 1
export const SLIDES_TEMPLATE_CANVAS_FEATURED_GRID_SPAN = 2
export const SLIDES_TEMPLATE_CANVAS_FEATURED_CARD_WIDTH =
	SLIDES_TEMPLATE_CANVAS_CARD_WIDTH * SLIDES_TEMPLATE_CANVAS_FEATURED_GRID_SPAN +
	SLIDES_TEMPLATE_CANVAS_GAP_X * (SLIDES_TEMPLATE_CANVAS_FEATURED_GRID_SPAN - 1)
export const SLIDES_TEMPLATE_CANVAS_FEATURED_CARD_HEIGHT =
	SLIDES_TEMPLATE_CANVAS_CARD_HEIGHT * SLIDES_TEMPLATE_CANVAS_FEATURED_GRID_SPAN +
	SLIDES_TEMPLATE_CANVAS_GAP_Y * (SLIDES_TEMPLATE_CANVAS_FEATURED_GRID_SPAN - 1)

export const SLIDES_TEMPLATE_CANVAS_DEFAULT_ITEM_SIZE: TemplateCanvasSize = {
	height: SLIDES_TEMPLATE_CANVAS_CARD_HEIGHT,
	width: SLIDES_TEMPLATE_CANVAS_CARD_WIDTH,
}

export const SLIDES_TEMPLATE_CANVAS_FEATURED_ITEM_SIZE: TemplateCanvasSize = {
	height: SLIDES_TEMPLATE_CANVAS_FEATURED_CARD_HEIGHT,
	width: SLIDES_TEMPLATE_CANVAS_FEATURED_CARD_WIDTH,
}

export const SLIDES_TEMPLATE_CANVAS_DEFAULT_ITEM_SPAN: TemplateCanvasSpan = {
	columns: SLIDES_TEMPLATE_CANVAS_DEFAULT_GRID_SPAN,
	rows: SLIDES_TEMPLATE_CANVAS_DEFAULT_GRID_SPAN,
}

export const SLIDES_TEMPLATE_CANVAS_FEATURED_ITEM_SPAN: TemplateCanvasSpan = {
	columns: SLIDES_TEMPLATE_CANVAS_FEATURED_GRID_SPAN,
	rows: SLIDES_TEMPLATE_CANVAS_FEATURED_GRID_SPAN,
}

export const SLIDES_TEMPLATE_CANVAS_STEP_X =
	SLIDES_TEMPLATE_CANVAS_CARD_WIDTH + SLIDES_TEMPLATE_CANVAS_GAP_X
export const SLIDES_TEMPLATE_CANVAS_STEP_Y =
	SLIDES_TEMPLATE_CANVAS_CARD_HEIGHT + SLIDES_TEMPLATE_CANVAS_GAP_Y
export const SLIDES_TEMPLATE_CANVAS_COLUMN_OFFSET_Y = SLIDES_TEMPLATE_CANVAS_CARD_HEIGHT / 2

function getTemplateCanvasColumnOffsetY(column: number) {
	// 相邻列错开半张普通卡片，避免规则网格形成过强的横向对齐线。
	return Math.abs(column) % 2 === 1 ? SLIDES_TEMPLATE_CANVAS_COLUMN_OFFSET_Y : 0
}

export function resolveTemplateCanvasGridPoint(index: number): TemplateCanvasPoint {
	if (index <= 0) return { x: 0, y: 0 }

	let ring = 1
	while (index >= Math.pow(ring * 2 + 1, 2)) {
		ring += 1
	}

	let offset = index - Math.pow((ring - 1) * 2 + 1, 2)

	for (let y = -ring; y <= ring; y += 1) {
		for (let x = -ring; x <= ring; x += 1) {
			if (Math.max(Math.abs(x), Math.abs(y)) !== ring) continue
			if (offset === 0) return { x, y }
			offset -= 1
		}
	}

	return { x: 0, y: 0 }
}

export function resolveTemplateCanvasGridIndex({ x, y }: TemplateCanvasPoint) {
	const ring = Math.max(Math.abs(x), Math.abs(y))
	if (ring === 0) return 0

	const baseIndex = Math.pow((ring - 1) * 2 + 1, 2)
	if (y === -ring) return baseIndex + x + ring
	if (y === ring) return baseIndex + 6 * ring - 1 + x + ring

	const rowOffset = y + ring - 1
	return baseIndex + 2 * ring + 1 + rowOffset * 2 + (x === -ring ? 0 : 1)
}

interface BuildTemplateCanvasItemsOptions<T> {
	getItemSize?: (item: T, index: number) => TemplateCanvasSize | undefined
	getItemSpan?: (item: T, index: number) => TemplateCanvasSpan | undefined
}

function normalizeTemplateCanvasSpan(span: TemplateCanvasSpan): TemplateCanvasSpan {
	const normalizeAxis = (value: number) => {
		return Math.max(1, Math.round(value))
	}

	return {
		columns: normalizeAxis(span.columns),
		rows: normalizeAxis(span.rows),
	}
}

function getTemplateCanvasOccupiedCells(
	grid: TemplateCanvasPoint,
	span: TemplateCanvasSpan,
): string[] {
	const cells: string[] = []

	for (let y = grid.y; y < grid.y + span.rows; y += 1) {
		for (let x = grid.x; x < grid.x + span.columns; x += 1) {
			cells.push(`${x}:${y}`)
		}
	}

	return cells
}

function getTemplateCanvasItemPosition(
	grid: TemplateCanvasPoint,
	span: TemplateCanvasSpan,
	alignedColumns: Set<number>,
): TemplateCanvasPoint {
	const columnOffsetY =
		span.columns === SLIDES_TEMPLATE_CANVAS_DEFAULT_GRID_SPAN && !alignedColumns.has(grid.x)
			? getTemplateCanvasColumnOffsetY(grid.x)
			: 0

	return {
		x: (grid.x + (span.columns - 1) / 2) * SLIDES_TEMPLATE_CANVAS_STEP_X,
		y: (grid.y + (span.rows - 1) / 2) * SLIDES_TEMPLATE_CANVAS_STEP_Y + columnOffsetY,
	}
}

function findAvailableTemplateCanvasGridPoint(
	occupiedCells: Set<string>,
	span: TemplateCanvasSpan,
) {
	for (let candidateIndex = 0; ; candidateIndex += 1) {
		const grid = resolveTemplateCanvasGridPoint(candidateIndex)
		const cells = getTemplateCanvasOccupiedCells(grid, span)
		if (cells.some((cell) => occupiedCells.has(cell))) continue

		return { cells, grid }
	}
}

export function buildTemplateCanvasItems<T>(
	items: T[],
	{ getItemSize, getItemSpan }: BuildTemplateCanvasItemsOptions<T> = {},
): TemplateCanvasItem<T>[] {
	const occupiedCells = new Set<string>()
	const canvasItems: Array<TemplateCanvasItem<T>> = []

	items.forEach((item, index) => {
		const span = normalizeTemplateCanvasSpan(
			getItemSpan?.(item, index) ?? SLIDES_TEMPLATE_CANVAS_DEFAULT_ITEM_SPAN,
		)
		const size = getItemSize?.(item, index) ?? SLIDES_TEMPLATE_CANVAS_DEFAULT_ITEM_SIZE
		const { cells, grid } = findAvailableTemplateCanvasGridPoint(occupiedCells, span)
		cells.forEach((cell) => occupiedCells.add(cell))

		canvasItems.push({
			index,
			item,
			grid,
			position: { x: 0, y: 0 },
			size,
			span,
		})
	})

	const alignedColumns = new Set<number>()
	canvasItems.forEach(({ grid, span }) => {
		if (span.columns <= SLIDES_TEMPLATE_CANVAS_DEFAULT_GRID_SPAN) return
		// 精选模板横跨的列统一使用基础相位，避免同列卡片在精选模板上下产生半卡片空洞。
		for (let column = grid.x; column < grid.x + span.columns; column += 1) {
			alignedColumns.add(column)
		}
	})
	const positionedItems = canvasItems.map((canvasItem) => ({
		...canvasItem,
		position: getTemplateCanvasItemPosition(canvasItem.grid, canvasItem.span, alignedColumns),
	}))
	const origin = positionedItems[0]?.position ?? { x: 0, y: 0 }

	return positionedItems.map((canvasItem) => ({
		...canvasItem,
		position: {
			x: canvasItem.position.x - origin.x,
			y: canvasItem.position.y - origin.y,
		},
	}))
}

export function getTemplateCanvasBounds<T>(
	items: Array<TemplateCanvasItem<T>>,
): TemplateCanvasBounds {
	if (!items.length) {
		return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
	}

	return items.reduce<TemplateCanvasBounds>(
		(bounds, item) => {
			const halfWidth = item.size.width / 2
			const halfHeight = item.size.height / 2

			return {
				minX: Math.min(bounds.minX, item.position.x - halfWidth),
				maxX: Math.max(bounds.maxX, item.position.x + halfWidth),
				minY: Math.min(bounds.minY, item.position.y - halfHeight),
				maxY: Math.max(bounds.maxY, item.position.y + halfHeight),
			}
		},
		{
			minX: Number.POSITIVE_INFINITY,
			maxX: Number.NEGATIVE_INFINITY,
			minY: Number.POSITIVE_INFINITY,
			maxY: Number.NEGATIVE_INFINITY,
		},
	)
}

interface ShouldRequestMoreTemplatesInput {
	bounds: TemplateCanvasBounds
	direction: TemplateCanvasDirection
	hasMore: boolean
	isLoading: boolean
	isLoadingMore: boolean
	isRefreshing: boolean
	offset: TemplateCanvasPoint
	scale?: number
	threshold: number
	viewportHeight: number
	viewportWidth: number
}

interface ConstrainTemplateCanvasOffsetInput {
	bounds: TemplateCanvasBounds
	insets?: Partial<TemplateCanvasInsets>
	offset: TemplateCanvasPoint
	padding: number
	scale?: number
	smallContentVerticalAlignment?: "center" | "start"
	viewportHeight: number
	viewportWidth: number
}

function clampAxisOffset({
	endInset = 0,
	maxWorld,
	minWorld,
	padding,
	smallContentAlignment = "center",
	startInset = 0,
	viewportSize,
	currentOffset,
}: {
	currentOffset: number
	endInset?: number
	maxWorld: number
	minWorld: number
	padding: number
	smallContentAlignment?: "center" | "start"
	startInset?: number
	viewportSize: number
}) {
	const minOffset = -maxWorld - padding + viewportSize / 2 - endInset
	const maxOffset = -minWorld + padding - viewportSize / 2 + startInset

	if (minOffset > maxOffset) {
		// 视口比内容还大时，minOffset（底部对齐锚）> maxOffset（顶部对齐锚）。
		// 顶部对齐语义下，允许内容在 maxOffset..minOffset 之间拖动，保留合理的可视区拖拽余量，
		// 而不是把偏移量压成单点；拖出区间则夹紧到最近的边界并稳定重置回顶部锚点。
		if (smallContentAlignment === "start") {
			return Math.min(Math.max(currentOffset, maxOffset), minOffset)
		}
		const centeredOffset = -(minWorld + maxWorld) / 2 + (startInset - endInset) / 2
		return Math.min(Math.max(currentOffset, centeredOffset - padding), centeredOffset + padding)
	}

	return Math.min(Math.max(currentOffset, minOffset), maxOffset)
}

export function constrainTemplateCanvasOffset({
	bounds,
	insets,
	offset,
	padding,
	scale = 1,
	smallContentVerticalAlignment = "center",
	viewportHeight,
	viewportWidth,
}: ConstrainTemplateCanvasOffsetInput): TemplateCanvasPoint {
	if (viewportWidth <= 0 || viewportHeight <= 0) return offset
	const normalizedScale = Math.max(scale, 0.01)
	const normalizedInsets = {
		top: Math.min(Math.max(insets?.top ?? 0, 0), viewportHeight),
		right: Math.min(Math.max(insets?.right ?? 0, 0), viewportWidth),
		bottom: Math.min(Math.max(insets?.bottom ?? 0, 0), viewportHeight),
		left: Math.min(Math.max(insets?.left ?? 0, 0), viewportWidth),
	}

	return {
		x: clampAxisOffset({
			currentOffset: offset.x,
			endInset: normalizedInsets.right,
			maxWorld: bounds.maxX * normalizedScale,
			minWorld: bounds.minX * normalizedScale,
			padding,
			startInset: normalizedInsets.left,
			viewportSize: viewportWidth,
		}),
		y: clampAxisOffset({
			currentOffset: offset.y,
			endInset: normalizedInsets.bottom,
			maxWorld: bounds.maxY * normalizedScale,
			minWorld: bounds.minY * normalizedScale,
			padding,
			smallContentAlignment: smallContentVerticalAlignment,
			startInset: normalizedInsets.top,
			viewportSize: viewportHeight,
		}),
	}
}

export function shouldRequestMoreTemplates({
	bounds,
	direction,
	hasMore,
	isLoading,
	isLoadingMore,
	isRefreshing,
	offset,
	scale = 1,
	threshold,
	viewportHeight,
	viewportWidth,
}: ShouldRequestMoreTemplatesInput): boolean {
	if (!hasMore || isLoading || isLoadingMore || isRefreshing) return false
	const normalizedScale = Math.max(scale, 0.01)

	const visibleLeft = (-offset.x - viewportWidth / 2) / normalizedScale
	const visibleRight = (-offset.x + viewportWidth / 2) / normalizedScale
	const visibleTop = (-offset.y - viewportHeight / 2) / normalizedScale
	const visibleBottom = (-offset.y + viewportHeight / 2) / normalizedScale
	const normalizedThreshold = threshold / normalizedScale

	if (direction === "left") return visibleLeft - bounds.minX <= normalizedThreshold
	if (direction === "right") return bounds.maxX - visibleRight <= normalizedThreshold
	if (direction === "up") return visibleTop - bounds.minY <= normalizedThreshold
	return bounds.maxY - visibleBottom <= normalizedThreshold
}
