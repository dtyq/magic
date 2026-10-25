import { describe, expect, it, vi } from "vitest"
import { ElementTypeEnum } from "../../../document/types"
import type { Rect } from "../../ids"
import { CanvasViewportQueryCoordinator } from "../CanvasViewportQueryCoordinator"

function intersectsRect(left: Rect, right: Rect): boolean {
	return (
		left.x <= right.x + right.width &&
		left.x + left.width >= right.x &&
		left.y <= right.y + right.height &&
		left.y + left.height >= right.y
	)
}

function createCoordinator(
	boundsById: Map<string, Rect>,
	options?: {
		parentById?: Map<string, string>
		typeById?: Map<string, string>
	},
) {
	let geometryRevision = 0
	let viewportRect: Rect = { x: 0, y: 0, width: 100, height: 100 }
	let viewportScale = 1
	const queryElementIdsByExpandedRect = vi.fn((rect: Rect, padding: number) => {
		const queryRect = {
			x: rect.x - padding,
			y: rect.y - padding,
			width: rect.width + padding * 2,
			height: rect.height + padding * 2,
		}
		return Array.from(boundsById, ([elementId, bounds]) => ({ elementId, bounds }))
			.filter(({ bounds }) => intersectsRect(bounds, queryRect))
			.map(({ elementId }) => elementId)
	})
	const getElementBounds = vi.fn((elementId: string) => boundsById.get(elementId) ?? null)
	const canvas = {
		elementManager: {
			findParentIdForElement: (elementId: string) => options?.parentById?.get(elementId),
			getElementData: (elementId: string) =>
				boundsById.has(elementId)
					? {
							id: elementId,
							type: options?.typeById?.get(elementId) ?? ElementTypeEnum.Image,
						}
					: undefined,
		},
		geometryCacheManager: {
			getElementBounds,
			getRevision: () => geometryRevision,
			queryElementIdsByExpandedRect,
		},
		stage: {
			getAbsoluteTransform: () => ({
				copy: () => ({
					invert: () => ({
						point: (point: { x: number; y: number }) => ({
							x: viewportRect.x + (point.x / 100) * viewportRect.width,
							y: viewportRect.y + (point.y / 100) * viewportRect.height,
						}),
					}),
				}),
			}),
			height: () => 100,
			scaleX: () => viewportScale,
			width: () => 100,
		},
		viewportController: {
			getResolvedDefaultViewportPadding: () => ({
				bottom: 0,
				left: 0,
				right: 0,
				top: 0,
			}),
		},
	} as never

	return {
		coordinator: new CanvasViewportQueryCoordinator({ canvas }),
		getElementBounds,
		queryElementIdsByExpandedRect,
		setGeometryRevision: (revision: number) => {
			geometryRevision = revision
		},
		setViewport: (rect: Rect, scale = viewportScale) => {
			viewportRect = rect
			viewportScale = scale
		},
	}
}

describe("CanvasViewportQueryCoordinator", () => {
	it("shares one snapshot for the same viewport generation", () => {
		const { coordinator, getElementBounds, queryElementIdsByExpandedRect } = createCoordinator(
			new Map([
				["visible", { x: 10, y: 10, width: 10, height: 10 }],
				["label", { x: 120, y: 0, width: 10, height: 10 }],
				["near", { x: 220, y: 0, width: 10, height: 10 }],
				["coverage-only", { x: 320, y: 0, width: 10, height: 10 }],
				["far", { x: 400, y: 0, width: 10, height: 10 }],
			]),
		)

		const first = coordinator.getSnapshot()
		const second = coordinator.getSnapshot()

		expect(second).toBe(first)
		expect(first.generation).toBe(1)
		expect(queryElementIdsByExpandedRect).toHaveBeenCalledTimes(1)
		expect(queryElementIdsByExpandedRect).toHaveBeenCalledWith(
			{ x: 0, y: 0, width: 100, height: 100 },
			250,
		)
		expect(getElementBounds).toHaveBeenCalledTimes(4)
		expect(first.nearRect).toEqual({ x: -200, y: -200, width: 500, height: 500 })
		expect(first.layoutRect).toEqual({ x: -50, y: -50, width: 200, height: 200 })
		expect(first.visibleElementIds).toEqual(new Set(["visible"]))
		expect(first.nearElementIds).toEqual(new Set(["label", "near"]))
		expect(first.layoutElementIds).toEqual(new Set(["visible", "label"]))
		expect(first.labelElementIds).toEqual(["visible", "label"])
	})

	it("reclassifies exact tiers without querying while the near rect stays covered", () => {
		const { coordinator, queryElementIdsByExpandedRect, setViewport } = createCoordinator(
			new Map([
				["left", { x: 10, y: 10, width: 10, height: 10 }],
				["right", { x: 320, y: 10, width: 10, height: 10 }],
			]),
		)
		coordinator.getSnapshot()

		setViewport({ x: 25, y: 0, width: 100, height: 100 })
		const moved = coordinator.getSnapshot()

		expect(moved.generation).toBe(2)
		expect(queryElementIdsByExpandedRect).toHaveBeenCalledTimes(1)
		expect(moved.visibleElementIds.size).toBe(0)
		expect(moved.nearElementIds).toEqual(new Set(["left", "right"]))
		expect(moved.layoutElementIds).toEqual(new Set(["left"]))
	})

	it("clips nested Frame descendants before sharing viewport candidates", () => {
		const parentById = new Map([
			["group", "outer-frame"],
			["inner-frame", "group"],
			["inside", "inner-frame"],
			["outside-inner-frame", "inner-frame"],
			["partially-clipped", "inner-frame"],
		])
		const typeById = new Map([
			["outer-frame", ElementTypeEnum.Frame],
			["group", ElementTypeEnum.Group],
			["inner-frame", ElementTypeEnum.Frame],
		])
		const { coordinator, queryElementIdsByExpandedRect, setViewport } = createCoordinator(
			new Map([
				["outer-frame", { x: 0, y: 0, width: 100, height: 100 }],
				["group", { x: 0, y: 0, width: 100, height: 100 }],
				["inner-frame", { x: 20, y: 20, width: 40, height: 40 }],
				["inside", { x: 30, y: 30, width: 10, height: 10 }],
				["outside-inner-frame", { x: 70, y: 30, width: 10, height: 10 }],
				["partially-clipped", { x: 55, y: 30, width: 20, height: 10 }],
			]),
			{ parentById, typeById },
		)

		const initial = coordinator.getSnapshot()

		expect(initial.visibleElementIds).toEqual(
			new Set(["outer-frame", "group", "inner-frame", "inside", "partially-clipped"]),
		)
		expect(initial.labelElementIds).not.toContain("outside-inner-frame")

		setViewport({ x: 65, y: 20, width: 20, height: 20 })
		const moved = coordinator.getSnapshot()

		expect(queryElementIdsByExpandedRect).toHaveBeenCalledTimes(1)
		expect(moved.visibleElementIds).toEqual(new Set(["outer-frame", "group"]))
		expect(moved.nearElementIds).not.toContain("outside-inner-frame")
	})

	it("rebuilds coverage after crossing its boundary or changing geometry", () => {
		const { coordinator, queryElementIdsByExpandedRect, setGeometryRevision, setViewport } =
			createCoordinator(new Map([["element", { x: 10, y: 10, width: 10, height: 10 }]]))
		coordinator.getSnapshot()

		setViewport({ x: 51, y: 0, width: 100, height: 100 })
		coordinator.getSnapshot()
		expect(queryElementIdsByExpandedRect).toHaveBeenCalledTimes(2)

		setGeometryRevision(1)
		coordinator.getSnapshot()
		expect(queryElementIdsByExpandedRect).toHaveBeenCalledTimes(3)
	})
})
