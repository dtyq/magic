import { describe, expect, it } from "vitest"
import type { Canvas } from "../../../../runtime/core/Canvas"
import type { Rect } from "../../../../runtime/shared/ids"
import {
	CONNECTION_CREATE_NODE_SPACING,
	collectConnectedElementSiblingRects,
	resolveConnectionCreateContextWithOriginRect,
	resolveConnectionCreateCenterPoint,
	resolveConnectionCreateTopLeftPoint,
	resolveConnectedElementCreateTopLeftPoint,
	resolveNonOverlappingConnectionCreateTopLeftPoint,
	type ConnectionCreatePlacementContext,
} from "../../../../runtime/shared/placement/connectionCreatePlacement"

describe("connectionCreatePlacement", () => {
	const rightHandleContext: ConnectionCreatePlacementContext = {
		originSide: "right",
		source: "handle",
		canvasX: 900,
		canvasY: 500,
	}
	const leftHandleContext: ConnectionCreatePlacementContext = {
		originSide: "left",
		source: "handle",
		canvasX: 100,
		canvasY: 500,
	}
	const size = { width: 300, height: 100 }
	const gap = 1024

	it("places handle-created nodes outside the source element on both sides", () => {
		expect(resolveConnectionCreateTopLeftPoint(rightHandleContext, size, gap)).toEqual({
			x: 1924,
			y: 450,
		})
		expect(resolveConnectionCreateTopLeftPoint(leftHandleContext, size, gap)).toEqual({
			x: -1224,
			y: 450,
		})
		expect(resolveConnectionCreateCenterPoint(leftHandleContext, size, gap)).toEqual({
			x: -1074,
			y: 500,
		})
	})

	it("keeps the original placement when there is no collision", () => {
		expect(
			resolveNonOverlappingConnectionCreateTopLeftPoint(rightHandleContext, size, gap),
		).toEqual(resolveConnectionCreateTopLeftPoint(rightHandleContext, size, gap))
	})

	it("places the next right-side node below the colliding position", () => {
		const basePoint = resolveConnectionCreateTopLeftPoint(rightHandleContext, size, gap)
		const obstacleRects: Rect[] = [{ ...basePoint, ...size }]

		expect(
			resolveNonOverlappingConnectionCreateTopLeftPoint(rightHandleContext, size, gap, {
				obstacleRects,
			}),
		).toEqual({
			x: basePoint.x,
			y: basePoint.y + size.height + CONNECTION_CREATE_NODE_SPACING,
		})
	})

	it("opens a new column outward when nearby rows are occupied", () => {
		const basePoint = resolveConnectionCreateTopLeftPoint(leftHandleContext, size, gap)
		const nodeSpacing = 20
		const verticalStep = size.height + nodeSpacing
		const horizontalStep = size.width + nodeSpacing
		const obstacleRects: Rect[] = [
			{ x: basePoint.x, y: basePoint.y, ...size },
			{ x: basePoint.x, y: basePoint.y + verticalStep, ...size },
			{ x: basePoint.x, y: basePoint.y - verticalStep, ...size },
		]

		expect(
			resolveNonOverlappingConnectionCreateTopLeftPoint(leftHandleContext, size, gap, {
				obstacleRects,
				nodeSpacing,
				maxRowIndex: 1,
				maxColumns: 2,
			}),
		).toEqual({
			x: basePoint.x - horizontalStep,
			y: basePoint.y,
		})
	})

	it("keeps connected children in the same column when the center slot is occupied", () => {
		const basePoint = resolveConnectionCreateTopLeftPoint(rightHandleContext, size, gap)
		const obstacleRects: Rect[] = [{ ...basePoint, ...size }]

		expect(
			resolveConnectedElementCreateTopLeftPoint(rightHandleContext, size, gap, {
				obstacleRects,
			}),
		).toEqual({
			x: basePoint.x,
			y: basePoint.y + size.height + CONNECTION_CREATE_NODE_SPACING,
		})
	})

	it("balances connected children around the handle while preserving the column x", () => {
		const basePoint = resolveConnectionCreateTopLeftPoint(rightHandleContext, size, gap)
		const verticalStep = size.height + CONNECTION_CREATE_NODE_SPACING
		const obstacleRects: Rect[] = [
			{ ...basePoint, ...size },
			{ x: basePoint.x, y: basePoint.y + verticalStep, ...size },
		]

		expect(
			resolveConnectedElementCreateTopLeftPoint(rightHandleContext, size, gap, {
				obstacleRects,
			}),
		).toEqual({
			x: basePoint.x,
			y: basePoint.y - verticalStep,
		})
	})

	it("uses edge spacing for connected children with different existing heights", () => {
		const basePoint = resolveConnectionCreateTopLeftPoint(rightHandleContext, size, gap)
		const existingRect: Rect = {
			x: basePoint.x,
			y: basePoint.y - 50,
			width: 300,
			height: 200,
		}

		expect(
			resolveConnectedElementCreateTopLeftPoint(rightHandleContext, size, gap, {
				obstacleRects: [existingRect],
			}),
		).toEqual({
			x: basePoint.x,
			y: existingRect.y + existingRect.height + CONNECTION_CREATE_NODE_SPACING,
		})
	})

	it("does not open a new x column for connected children by default", () => {
		const basePoint = resolveConnectionCreateTopLeftPoint(leftHandleContext, size, gap)
		const nodeSpacing = 20
		const verticalStep = size.height + nodeSpacing
		const obstacleRects: Rect[] = [
			{ x: basePoint.x, y: basePoint.y, ...size },
			{ x: basePoint.x, y: basePoint.y + verticalStep, ...size },
			{ x: basePoint.x, y: basePoint.y - verticalStep, ...size },
		]

		expect(
			resolveConnectedElementCreateTopLeftPoint(leftHandleContext, size, gap, {
				obstacleRects,
				nodeSpacing,
				maxRowIndex: 1,
			}).x,
		).toBe(basePoint.x)
	})

	it("locks connected children to the base x even when extra columns are allowed", () => {
		const basePoint = resolveConnectionCreateTopLeftPoint(rightHandleContext, size, gap)
		const nodeSpacing = 20
		const verticalStep = size.height + nodeSpacing
		const obstacleRects: Rect[] = [
			{ x: basePoint.x, y: basePoint.y, ...size },
			{ x: basePoint.x, y: basePoint.y + verticalStep, ...size },
			{ x: basePoint.x, y: basePoint.y - verticalStep, ...size },
		]

		expect(
			resolveConnectedElementCreateTopLeftPoint(rightHandleContext, size, gap, {
				obstacleRects,
				nodeSpacing,
				maxColumns: 4,
			}).x,
		).toBe(basePoint.x)
	})

	it("normalizes handle source placement to the origin element edge center", () => {
		const pointerContext: ConnectionCreatePlacementContext = {
			originSide: "right",
			source: "handle",
			canvasX: 932,
			canvasY: 487,
		}

		expect(
			resolveConnectionCreateContextWithOriginRect(pointerContext, {
				x: 100,
				y: 200,
				width: 800,
				height: 600,
			}),
		).toEqual({
			originSide: "right",
			source: "handle",
			canvasX: 900,
			canvasY: 500,
		})
	})

	it("keeps drag-empty placement at the released canvas point", () => {
		const releaseContext: ConnectionCreatePlacementContext = {
			originSide: "right",
			source: "drag-empty",
			canvasX: 1320,
			canvasY: 780,
		}

		expect(
			resolveConnectionCreateContextWithOriginRect(releaseContext, {
				x: 100,
				y: 200,
				width: 800,
				height: 600,
			}),
		).toBe(releaseContext)
	})

	it("collects connected sibling rects from directional connections", () => {
		const boundsById = new Map<string, Rect>([
			["target-1", { x: 10, y: 20, width: 30, height: 40 }],
			["source-1", { x: -40, y: 20, width: 30, height: 40 }],
		])
		const canvas = {
			connectionManager: {
				getDownstreamConnections: () => [
					{ id: "c1", sourceElementId: "origin", targetElementId: "target-1" },
				],
				getUpstreamConnections: () => [
					{ id: "c2", sourceElementId: "source-1", targetElementId: "origin" },
				],
			},
			elementManager: {
				isElementVisibleInDataTree: (elementId: string) => boundsById.has(elementId),
			},
			geometryCacheManager: {
				getElementBounds: (elementId: string) => boundsById.get(elementId) ?? null,
			},
		} as unknown as Canvas

		expect(
			collectConnectedElementSiblingRects(canvas, {
				originElementId: "origin",
				originSide: "right",
			}),
		).toEqual([{ x: 10, y: 20, width: 30, height: 40 }])
		expect(
			collectConnectedElementSiblingRects(canvas, {
				originElementId: "origin",
				originSide: "left",
			}),
		).toEqual([{ x: -40, y: 20, width: 30, height: 40 }])
	})
})
