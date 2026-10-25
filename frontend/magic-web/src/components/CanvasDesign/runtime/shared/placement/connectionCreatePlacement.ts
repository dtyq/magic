import type { Canvas } from "../../core/Canvas"
import type { Rect } from "../ids"
import {
	CREATE_ELEMENT_GAP_MIN_CANVAS_PX,
	resolveConnectionCreateGapForElement,
	type ConnectionCreateOriginSide,
} from "./connectionCreateGap"

export {
	CREATE_ELEMENT_GAP_MIN_CANVAS_PX,
	clampCreateElementGap,
	getConnectionMenuTriggerAxisSize,
	resolveConnectionCreateGapForElement,
	type ConnectionCreateOriginSide,
} from "./connectionCreateGap"

export type ConnectionCreateSource = "handle" | "drag-empty"

export interface ConnectionCreatePlacementContext {
	originSide?: ConnectionCreateOriginSide
	canvasX: number
	canvasY: number
	source: ConnectionCreateSource
}

export const CONNECTION_CREATE_NODE_SPACING = 120
const CONNECTION_CREATE_MAX_ROW_INDEX = 8
const CONNECTION_CREATE_MAX_COLUMNS = 8

interface NonOverlappingConnectionCreatePlacementOptions {
	obstacleRects?: Rect[]
	nodeSpacing?: number
	maxRowIndex?: number
	maxColumns?: number
}

interface ConnectedConnectionCreatePlacementOptions extends NonOverlappingConnectionCreatePlacementOptions {
	siblingRects?: Rect[]
}

interface VerticalInterval {
	start: number
	end: number
}

export function resolveConnectionCreateAnchorPoint(
	context: ConnectionCreatePlacementContext,
	gap: number,
): { x: number; y: number } {
	if (context.source === "drag-empty") {
		return {
			x: context.canvasX,
			y: context.canvasY,
		}
	}

	const direction = context.originSide === "left" ? -1 : 1
	return {
		x: context.canvasX + gap * direction,
		y: context.canvasY,
	}
}

export function resolveConnectionCreateCenterPoint(
	context: ConnectionCreatePlacementContext,
	size: { width: number; height: number },
	gap: number,
): { x: number; y: number } {
	const anchor = resolveConnectionCreateAnchorPoint(context, gap)
	const direction = context.originSide === "left" ? -1 : 1
	return {
		x: anchor.x + (size.width / 2) * direction,
		y: anchor.y,
	}
}

export function resolveConnectionCreateTopLeftPoint(
	context: ConnectionCreatePlacementContext,
	size: { width: number; height: number },
	gap: number,
): { x: number; y: number } {
	const anchor = resolveConnectionCreateAnchorPoint(context, gap)
	return {
		x: context.originSide === "left" ? anchor.x - size.width : anchor.x,
		y: anchor.y - size.height / 2,
	}
}

export function resolveConnectionCreateContextWithOriginRect(
	context: ConnectionCreatePlacementContext,
	originRect: Rect | null | undefined,
): ConnectionCreatePlacementContext {
	if (context.source !== "handle" || !context.originSide || !isValidRect(originRect)) {
		return context
	}

	return {
		...context,
		canvasX: context.originSide === "right" ? originRect.x + originRect.width : originRect.x,
		canvasY: originRect.y + originRect.height / 2,
	}
}

export function resolveNonOverlappingConnectionCreateTopLeftPoint(
	context: ConnectionCreatePlacementContext,
	size: { width: number; height: number },
	gap: number,
	options: NonOverlappingConnectionCreatePlacementOptions = {},
): { x: number; y: number } {
	const basePoint = resolveConnectionCreateTopLeftPoint(context, size, gap)
	const obstacleRects = options.obstacleRects ?? []
	if (obstacleRects.length === 0) {
		return basePoint
	}

	const nodeSpacing = options.nodeSpacing ?? CONNECTION_CREATE_NODE_SPACING
	const maxRowIndex = options.maxRowIndex ?? CONNECTION_CREATE_MAX_ROW_INDEX
	const maxColumns = options.maxColumns ?? CONNECTION_CREATE_MAX_COLUMNS
	const direction = context.originSide === "left" ? -1 : 1
	const horizontalStep = Math.max(size.width + nodeSpacing, 1)
	const verticalStep = Math.max(size.height + nodeSpacing, 1)

	for (let columnIndex = 0; columnIndex <= maxColumns; columnIndex += 1) {
		for (const rowIndex of buildMindMapRowSearchOrder(maxRowIndex)) {
			const point = {
				x: basePoint.x + columnIndex * horizontalStep * direction,
				y: basePoint.y + rowIndex * verticalStep,
			}
			const candidateRect = createRectFromTopLeft(point, size)
			if (!hasRectCollision(candidateRect, obstacleRects, nodeSpacing)) {
				return point
			}
		}
	}

	return basePoint
}

export function resolveNonOverlappingConnectionCreateCenterPoint(
	context: ConnectionCreatePlacementContext,
	size: { width: number; height: number },
	gap: number,
	options: NonOverlappingConnectionCreatePlacementOptions = {},
): { x: number; y: number } {
	const point = resolveNonOverlappingConnectionCreateTopLeftPoint(context, size, gap, options)
	return {
		x: point.x + size.width / 2,
		y: point.y + size.height / 2,
	}
}

export function resolveConnectedElementCreateTopLeftPoint(
	context: ConnectionCreatePlacementContext,
	size: { width: number; height: number },
	gap: number,
	options: ConnectedConnectionCreatePlacementOptions = {},
): { x: number; y: number } {
	const basePoint = resolveConnectionCreateTopLeftPoint(context, size, gap)
	const obstacleRects = normalizeRects(options.obstacleRects)
	const siblingRects = normalizeRects(options.siblingRects)
	if (obstacleRects.length === 0 && siblingRects.length === 0) {
		return basePoint
	}

	const nodeSpacing = options.nodeSpacing ?? CONNECTION_CREATE_NODE_SPACING
	const blockingRects = [...siblingRects, ...obstacleRects]
	const slot = resolveBestConnectedVerticalSlot({
		x: basePoint.x,
		size,
		baseTopY: basePoint.y,
		anchorCenterY: context.canvasY,
		obstacleRects: blockingRects,
		nodeSpacing,
	})

	return {
		x: basePoint.x,
		y: slot?.y ?? basePoint.y,
	}
}

export function resolveConnectedElementCreateCenterPoint(
	context: ConnectionCreatePlacementContext,
	size: { width: number; height: number },
	gap: number,
	options: ConnectedConnectionCreatePlacementOptions = {},
): { x: number; y: number } {
	const point = resolveConnectedElementCreateTopLeftPoint(context, size, gap, options)
	return {
		x: point.x + size.width / 2,
		y: point.y + size.height / 2,
	}
}

export function collectConnectionCreateObstacleRects(
	canvas: Canvas,
	options: { excludeElementIds?: Iterable<string> } = {},
): Rect[] {
	const excludeIds = new Set(options.excludeElementIds ?? [])
	return canvas.elementManager
		.getAllElementIds()
		.filter((elementId) => {
			return (
				!excludeIds.has(elementId) &&
				canvas.elementManager.isElementVisibleInDataTree(elementId)
			)
		})
		.map((elementId) => canvas.geometryCacheManager.getElementBounds(elementId))
		.filter((rect): rect is Rect => isValidRect(rect))
}

export function collectConnectedElementSiblingRects(
	canvas: Canvas,
	options: {
		originElementId: string
		originSide: ConnectionCreateOriginSide
		excludeElementIds?: Iterable<string>
	},
): Rect[] {
	const excludeIds = new Set(options.excludeElementIds ?? [])
	const siblingElementIds = collectConnectedSiblingElementIds(canvas, options)
	const elementManager = canvas.elementManager as Canvas["elementManager"] & {
		isElementVisibleInDataTree?: (elementId: string) => boolean
	}

	return siblingElementIds
		.filter((elementId) => {
			return (
				!excludeIds.has(elementId) &&
				(elementManager.isElementVisibleInDataTree?.(elementId) ?? true)
			)
		})
		.map((elementId) => canvas.geometryCacheManager.getElementBounds(elementId))
		.filter((rect): rect is Rect => isValidRect(rect))
}

function buildMindMapRowSearchOrder(maxRowIndex: number): number[] {
	const order = [0]
	for (let index = 1; index <= maxRowIndex; index += 1) {
		order.push(index, -index)
	}
	return order
}

function resolveBestConnectedVerticalSlot(options: {
	x: number
	size: { width: number; height: number }
	baseTopY: number
	anchorCenterY: number
	obstacleRects: Rect[]
	nodeSpacing: number
}): { y: number; distance: number } | null {
	const intervals = buildBlockingVerticalIntervals(options)
	if (intervals.length === 0) {
		return {
			y: options.baseTopY,
			distance: Math.abs(options.baseTopY + options.size.height / 2 - options.anchorCenterY),
		}
	}

	const candidates = buildConnectedVerticalCandidates(
		intervals,
		options.baseTopY,
		options.size.height,
		options.anchorCenterY,
	)
	const validCandidates = candidates.filter((candidate) =>
		isVerticalCandidateClear(candidate, options.size.height, intervals),
	)
	if (validCandidates.length === 0) return null

	validCandidates.sort((a, b) =>
		compareConnectedVerticalCandidates(a, b, options.size.height, options.anchorCenterY),
	)
	const y = validCandidates[0]
	return {
		y,
		distance: Math.abs(y + options.size.height / 2 - options.anchorCenterY),
	}
}

function buildBlockingVerticalIntervals(options: {
	x: number
	size: { width: number; height: number }
	obstacleRects: Rect[]
	nodeSpacing: number
}): VerticalInterval[] {
	const intervals = options.obstacleRects
		.filter((rect) =>
			rectHorizontallyOverlapsWithSpacing(
				options.x,
				options.size.width,
				rect,
				options.nodeSpacing,
			),
		)
		.map((rect) => ({
			start: rect.y - options.nodeSpacing,
			end: rect.y + rect.height + options.nodeSpacing,
		}))
		.filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end))
		.sort((a, b) => a.start - b.start)

	return mergeVerticalIntervals(intervals)
}

function buildConnectedVerticalCandidates(
	intervals: VerticalInterval[],
	baseTopY: number,
	height: number,
	anchorCenterY: number,
): number[] {
	const candidates = new Set<number>()
	const addCandidate = (value: number) => {
		if (Number.isFinite(value)) candidates.add(value)
	}
	addCandidate(baseTopY)

	for (const interval of intervals) {
		addCandidate(interval.end)
		addCandidate(interval.start - height)
	}

	for (let index = 0; index < intervals.length - 1; index += 1) {
		const current = intervals[index]
		const next = intervals[index + 1]
		if (next.start - current.end < height) continue
		addCandidate(clamp(anchorCenterY - height / 2, current.end, next.start - height))
	}

	return Array.from(candidates)
}

function compareConnectedVerticalCandidates(
	a: number,
	b: number,
	height: number,
	anchorCenterY: number,
): number {
	const aCenter = a + height / 2
	const bCenter = b + height / 2
	const distanceDiff = Math.abs(aCenter - anchorCenterY) - Math.abs(bCenter - anchorCenterY)
	if (Math.abs(distanceDiff) > 0.001) return distanceDiff

	const aBelow = aCenter >= anchorCenterY
	const bBelow = bCenter >= anchorCenterY
	if (aBelow !== bBelow) return aBelow ? -1 : 1

	return a - b
}

function isVerticalCandidateClear(
	y: number,
	height: number,
	intervals: VerticalInterval[],
): boolean {
	const bottom = y + height
	return intervals.every((interval) => bottom <= interval.start || y >= interval.end)
}

function mergeVerticalIntervals(intervals: VerticalInterval[]): VerticalInterval[] {
	const merged: VerticalInterval[] = []
	for (const interval of intervals) {
		const current = merged[merged.length - 1]
		if (!current || interval.start > current.end) {
			merged.push({ ...interval })
			continue
		}

		current.end = Math.max(current.end, interval.end)
	}
	return merged
}

function createRectFromTopLeft(
	point: { x: number; y: number },
	size: { width: number; height: number },
): Rect {
	return {
		x: point.x,
		y: point.y,
		width: size.width,
		height: size.height,
	}
}

function hasRectCollision(candidate: Rect, obstacles: Rect[], spacing: number): boolean {
	return obstacles.some((obstacle) => rectsOverlapWithSpacing(candidate, obstacle, spacing))
}

function rectsOverlapWithSpacing(a: Rect, b: Rect, spacing: number): boolean {
	return (
		a.x < b.x + b.width + spacing &&
		a.x + a.width > b.x - spacing &&
		a.y < b.y + b.height + spacing &&
		a.y + a.height > b.y - spacing
	)
}

function rectHorizontallyOverlapsWithSpacing(
	x: number,
	width: number,
	rect: Rect,
	spacing: number,
): boolean {
	return x < rect.x + rect.width + spacing && x + width > rect.x - spacing
}

function normalizeRects(rects: Rect[] | undefined): Rect[] {
	return (rects ?? []).filter((rect): rect is Rect => isValidRect(rect))
}

function isValidRect(rect: Rect | null | undefined): rect is Rect {
	return (
		!!rect &&
		Number.isFinite(rect.x) &&
		Number.isFinite(rect.y) &&
		Number.isFinite(rect.width) &&
		Number.isFinite(rect.height) &&
		rect.width > 0 &&
		rect.height > 0
	)
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value))
}

function collectConnectedSiblingElementIds(
	canvas: Canvas,
	options: {
		originElementId: string
		originSide: ConnectionCreateOriginSide
	},
): string[] {
	const manager = canvas.connectionManager as unknown as {
		getDownstreamConnections?: (elementId: string) => Array<{
			sourceElementId: string
			targetElementId: string
		}>
		getUpstreamConnections?: (elementId: string) => Array<{
			sourceElementId: string
			targetElementId: string
		}>
		getConnections?: () => Array<{
			sourceElementId: string
			targetElementId: string
		}>
	}
	const allConnections = manager.getConnections?.() ?? []
	if (options.originSide === "right") {
		const downstream =
			manager.getDownstreamConnections?.(options.originElementId) ??
			allConnections.filter(
				(connection) => connection.sourceElementId === options.originElementId,
			)
		return downstream.map((connection) => connection.targetElementId)
	}

	const upstream =
		manager.getUpstreamConnections?.(options.originElementId) ??
		allConnections.filter(
			(connection) => connection.targetElementId === options.originElementId,
		)
	return upstream.map((connection) => connection.sourceElementId)
}
