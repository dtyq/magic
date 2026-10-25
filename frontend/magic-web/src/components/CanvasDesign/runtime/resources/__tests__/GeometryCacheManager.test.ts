import { describe, expect, it, vi } from "vitest"
import { GeometryCacheManager } from "../../shared/geometry/GeometryCacheManager"
import type { Rect } from "../../shared/ids"

interface NestedGeometryElement {
	id: string
	parentId?: string
	bounds: Rect
	visible?: boolean
}

function createManager(
	boundsById: Map<string, { x: number; y: number; width: number; height: number }>,
) {
	const elementIds: string[] = []
	boundsById.forEach((_, id) => {
		elementIds.push(id)
	})
	const visibleIds = new Set(elementIds)
	return new GeometryCacheManager({
		canvas: {
			elementManager: {
				getAllElementIds: () => elementIds,
				isElementVisibleInDataTree: (id: string) => visibleIds.has(id),
				getElementInstance: (id: string) => ({
					getBoundingRect: () => boundsById.get(id) ?? null,
				}),
			},
		} as never,
	})
}

function createNestedManager(elements: NestedGeometryElement[]) {
	const elementsById = new Map(elements.map((element) => [element.id, element]))
	const getWorldBounds = (elementId: string): Rect | null => {
		const element = elementsById.get(elementId)
		if (!element) return null

		let x = element.bounds.x
		let y = element.bounds.y
		let parentId = element.parentId
		const visited = new Set([elementId])
		while (parentId) {
			if (visited.has(parentId)) return null
			visited.add(parentId)
			const parent = elementsById.get(parentId)
			if (!parent) return null
			x += parent.bounds.x
			y += parent.bounds.y
			parentId = parent.parentId
		}

		return { x, y, width: element.bounds.width, height: element.bounds.height }
	}
	const isElementVisibleInDataTree = (elementId: string): boolean => {
		let currentId: string | undefined = elementId
		const visited = new Set<string>()
		while (currentId) {
			if (visited.has(currentId)) return false
			visited.add(currentId)
			const element = elementsById.get(currentId)
			if (!element || element.visible === false) return false
			currentId = element.parentId
		}
		return true
	}
	const manager = new GeometryCacheManager({
		canvas: {
			elementManager: {
				getAllElementIds: () => Array.from(elementsById.keys()),
				isElementVisibleInDataTree,
				getElementInstance: (elementId: string) =>
					elementsById.has(elementId)
						? { getBoundingRect: () => getWorldBounds(elementId) }
						: undefined,
			},
		} as never,
	})

	return { elementsById, manager }
}

describe("GeometryCacheManager", () => {
	it("returns elements that only expose a small corner in the viewport", () => {
		const manager = createManager(
			new Map([
				["corner", { x: 99, y: 99, width: 20, height: 20 }],
				["outside", { x: 121, y: 121, width: 20, height: 20 }],
			]),
		)

		const ids = manager.queryElementIdsByExpandedRect(
			{ x: 0, y: 0, width: 100, height: 100 },
			0,
		)

		expect(ids).toContain("corner")
		expect(ids).not.toContain("outside")
	})

	it("keeps indexed viewport queries cheap for large element sets", () => {
		const boundsById = new Map<
			string,
			{ x: number; y: number; width: number; height: number }
		>()
		for (let index = 0; index < 10_000; index += 1) {
			boundsById.set(`element-${index}`, {
				x: (index % 100) * 220,
				y: Math.floor(index / 100) * 180,
				width: 160,
				height: 120,
			})
		}
		const manager = createManager(boundsById)

		const startedAt = performance.now()
		const ids = manager.queryElementIdsByExpandedRect(
			{ x: 2_000, y: 2_000, width: 1_440, height: 900 },
			0,
		)
		const durationMs = performance.now() - startedAt

		expect(ids.length).toBeGreaterThan(0)
		expect(ids.length).toBeLessThan(200)
		expect(durationMs).toBeLessThan(500)
	})

	it("restricts spatial queries to the provided candidate ids", () => {
		const manager = createManager(
			new Map([
				["allowed", { x: 0, y: 0, width: 100, height: 100 }],
				["excluded", { x: 20, y: 20, width: 100, height: 100 }],
			]),
		)

		const ids = manager.queryElementIdsByExpandedRect(
			{ x: 0, y: 0, width: 200, height: 200 },
			0,
			{ elementIds: ["allowed"] },
		)

		expect(ids).toEqual(["allowed"])
	})

	it("reuses a candidate Set without copying it before an indexed query", () => {
		const boundsById = new Map<
			string,
			{ x: number; y: number; width: number; height: number }
		>()
		for (let index = 0; index < 40; index += 1) {
			boundsById.set(`element-${index}`, { x: index, y: index, width: 100, height: 100 })
		}
		const manager = createManager(boundsById)
		const allowedIds = new Set(Array.from(boundsById.keys()).slice(0, 33))
		const iteratorSpy = vi.spyOn(allowedIds, Symbol.iterator)

		const ids = manager.queryElementIdsByExpandedRect(
			{ x: 0, y: 0, width: 200, height: 200 },
			0,
			{ elementIds: allowedIds },
		)

		expect(ids).toHaveLength(33)
		expect(iteratorSpy).not.toHaveBeenCalled()
	})

	it("directly scans a small candidate set without building the full index", () => {
		const boundsById = new Map([
			["allowed", { x: 0, y: 0, width: 100, height: 100 }],
			["far", { x: 1_000_000, y: 1_000_000, width: 100, height: 100 }],
		])
		const elementIds = Array.from(boundsById.keys())
		let getAllElementIdsCount = 0
		const manager = new GeometryCacheManager({
			canvas: {
				elementManager: {
					getAllElementIds: () => {
						getAllElementIdsCount += 1
						return elementIds
					},
					isElementVisibleInDataTree: (id: string) => boundsById.has(id),
					getElementInstance: (id: string) => ({
						getBoundingRect: () => boundsById.get(id) ?? null,
					}),
				},
			} as never,
		})

		const ids = manager.queryElementIdsByExpandedRect(
			{ x: -500_000, y: -500_000, width: 1_000_000, height: 1_000_000 },
			0,
			{ elementIds: ["allowed"] },
		)

		expect(ids).toEqual(["allowed"])
		expect(getAllElementIdsCount).toBe(0)
	})

	it("keeps data-tree visibility filtering on the direct scan path", () => {
		const boundsById = new Map([
			["visible", { x: 0, y: 0, width: 100, height: 100 }],
			["hidden", { x: 10, y: 10, width: 100, height: 100 }],
		])
		const visibleIds = new Set(["visible"])
		const manager = new GeometryCacheManager({
			canvas: {
				elementManager: {
					getAllElementIds: () => Array.from(boundsById.keys()),
					isElementVisibleInDataTree: (id: string) => visibleIds.has(id),
					getElementInstance: (id: string) => ({
						getBoundingRect: () => boundsById.get(id) ?? null,
					}),
				},
			} as never,
		})

		const ids = manager.queryElementIdsByExpandedRect(
			{ x: -500_000, y: -500_000, width: 1_000_000, height: 1_000_000 },
			0,
			{ elementIds: ["visible", "hidden"] },
		)

		expect(ids).toEqual(["visible"])
	})

	it("reuses the R-tree for repeated extremely large unfiltered queries", () => {
		const boundsById = new Map([
			["visible", { x: 0, y: 0, width: 100, height: 100 }],
			["hidden", { x: 10, y: 10, width: 100, height: 100 }],
		])
		const elementIds = Array.from(boundsById.keys())
		const getAllElementIds = vi.fn(() => elementIds)
		const manager = new GeometryCacheManager({
			canvas: {
				elementManager: {
					getAllElementIds,
					getElementCount: () => elementIds.length,
					isElementVisibleInDataTree: (id: string) => id === "visible",
					getElementInstance: (id: string) => ({
						getBoundingRect: () => boundsById.get(id) ?? null,
					}),
				},
			} as never,
		})

		expect(
			manager.queryElementIdsByExpandedRect(
				{ x: -500_000, y: -500_000, width: 1_000_000, height: 1_000_000 },
				0,
			),
		).toEqual(["visible"])
		expect(getAllElementIds).toHaveBeenCalledTimes(1)

		manager.queryElementIdsByExpandedRect({ x: 0, y: 0, width: 200, height: 200 }, 0)
		expect(getAllElementIds).toHaveBeenCalledTimes(1)
	})

	it("indexes an oversized element once and finds it across its full bounds", () => {
		const manager = createManager(
			new Map([
				["oversized", { x: -100_000, y: -100_000, width: 200_000, height: 200_000 }],
				["outside", { x: 300_000, y: 300_000, width: 100, height: 100 }],
			]),
		)

		expect(
			manager.queryElementIdsByExpandedRect(
				{ x: 99_900, y: 99_900, width: 100, height: 100 },
				0,
			),
		).toEqual(["oversized"])
	})

	it("advances the geometry revision once per invalidation batch", () => {
		const manager = createManager(
			new Map([["element", { x: 0, y: 0, width: 100, height: 100 }]]),
		)

		expect(manager.getRevision()).toBe(0)
		manager.invalidateElement("element")
		expect(manager.getRevision()).toBe(1)
		manager.invalidateElements([])
		expect(manager.getRevision()).toBe(1)
		manager.invalidateElements(["element"])
		expect(manager.getRevision()).toBe(2)
		manager.invalidateAll()
		expect(manager.getRevision()).toBe(3)
	})

	it("updates R-tree entries incrementally after an element moves", () => {
		const boundsById = new Map([
			["moving", { x: 0, y: 0, width: 100, height: 100 }],
			["stable", { x: 4_000, y: 4_000, width: 100, height: 100 }],
		])
		const elementIds = Array.from(boundsById.keys())
		const visibleIds = new Set(elementIds)
		let getAllElementIdsCount = 0
		const manager = new GeometryCacheManager({
			canvas: {
				elementManager: {
					getAllElementIds: () => {
						getAllElementIdsCount += 1
						return elementIds
					},
					isElementVisibleInDataTree: (id: string) => visibleIds.has(id),
					getElementInstance: (id: string) => ({
						getBoundingRect: () => boundsById.get(id) ?? null,
					}),
				},
			} as never,
		})

		expect(
			manager.queryElementIdsByExpandedRect({ x: 0, y: 0, width: 200, height: 200 }, 0),
		).toContain("moving")
		expect(getAllElementIdsCount).toBe(1)

		boundsById.set("moving", { x: 8_000, y: 8_000, width: 100, height: 100 })
		manager.invalidateElement("moving")

		expect(
			manager.queryElementIdsByExpandedRect({ x: 0, y: 0, width: 200, height: 200 }, 0),
		).not.toContain("moving")
		expect(
			manager.queryElementIdsByExpandedRect(
				{ x: 8_000, y: 8_000, width: 200, height: 200 },
				0,
			),
		).toContain("moving")
		expect(getAllElementIdsCount).toBe(1)
	})

	it("removes hidden and deleted elements from an initialized index", () => {
		const boundsById = new Map([
			["hidden", { x: 0, y: 0, width: 100, height: 100 }],
			["deleted", { x: 20, y: 20, width: 100, height: 100 }],
		])
		const elementIds = Array.from(boundsById.keys())
		const visibleIds = new Set(elementIds)
		const manager = new GeometryCacheManager({
			canvas: {
				elementManager: {
					getAllElementIds: () => elementIds,
					isElementVisibleInDataTree: (id: string) => visibleIds.has(id),
					getElementInstance: (id: string) => {
						const bounds = boundsById.get(id)
						return bounds ? { getBoundingRect: () => bounds } : undefined
					},
				},
			} as never,
		})
		const queryRect = { x: 0, y: 0, width: 200, height: 200 }

		expect(manager.queryElementIdsByExpandedRect(queryRect, 0).sort()).toEqual([
			"deleted",
			"hidden",
		])

		visibleIds.delete("hidden")
		manager.invalidateElement("hidden")
		boundsById.delete("deleted")
		visibleIds.delete("deleted")
		elementIds.splice(elementIds.indexOf("deleted"), 1)
		manager.invalidateElement("deleted")

		expect(manager.queryElementIdsByExpandedRect(queryRect, 0)).toEqual([])
	})

	it("updates a batch of moved elements without rebuilding the index", () => {
		const boundsById = new Map([
			["first", { x: 0, y: 0, width: 100, height: 100 }],
			["second", { x: 200, y: 200, width: 100, height: 100 }],
		])
		const elementIds = Array.from(boundsById.keys())
		const getAllElementIds = vi.fn(() => elementIds)
		const manager = new GeometryCacheManager({
			canvas: {
				elementManager: {
					getAllElementIds,
					isElementVisibleInDataTree: (id: string) => boundsById.has(id),
					getElementInstance: (id: string) => ({
						getBoundingRect: () => boundsById.get(id) ?? null,
					}),
				},
			} as never,
		})

		manager.queryElementIdsByExpandedRect({ x: 0, y: 0, width: 400, height: 400 }, 0)
		boundsById.set("first", { x: 1_000, y: 1_000, width: 100, height: 100 })
		boundsById.set("second", { x: 1_200, y: 1_200, width: 100, height: 100 })
		manager.invalidateElements(new Set(["first", "second"]))

		expect(
			manager.queryElementIdsByExpandedRect({ x: 0, y: 0, width: 400, height: 400 }, 0),
		).toEqual([])
		expect(
			manager
				.queryElementIdsByExpandedRect({ x: 900, y: 900, width: 500, height: 500 }, 0)
				.sort(),
		).toEqual(["first", "second"])
		expect(getAllElementIds).toHaveBeenCalledTimes(1)
	})

	it("coalesces repeated invalidations until the next indexed query", () => {
		const boundsById = new Map([
			["moving", { x: 0, y: 0, width: 100, height: 100 }],
			["stable", { x: 2_000, y: 2_000, width: 100, height: 100 }],
		])
		const getBoundingRect = vi.fn((id: string) => boundsById.get(id) ?? null)
		const manager = new GeometryCacheManager({
			canvas: {
				elementManager: {
					getAllElementIds: () => Array.from(boundsById.keys()),
					isElementVisibleInDataTree: (id: string) => boundsById.has(id),
					getElementInstance: (id: string) => ({
						getBoundingRect: () => getBoundingRect(id),
					}),
				},
			} as never,
		})

		manager.queryElementIdsByExpandedRect({ x: 0, y: 0, width: 200, height: 200 }, 0)
		expect(getBoundingRect).toHaveBeenCalledTimes(2)

		boundsById.set("moving", { x: 500, y: 500, width: 100, height: 100 })
		manager.invalidateElement("moving")
		boundsById.set("moving", { x: 1_000, y: 1_000, width: 100, height: 100 })
		manager.invalidateElement("moving")
		expect(getBoundingRect).toHaveBeenCalledTimes(2)

		expect(
			manager.queryElementIdsByExpandedRect({ x: 900, y: 900, width: 300, height: 300 }, 0),
		).toEqual(["moving"])
		expect(getBoundingRect).toHaveBeenCalledTimes(3)
	})

	it("refreshes nested descendants after their parent container moves", () => {
		const { elementsById, manager } = createNestedManager([
			{ id: "frame", bounds: { x: 1_000, y: 2_000, width: 600, height: 500 } },
			{
				id: "group",
				parentId: "frame",
				bounds: { x: 50, y: 60, width: 300, height: 240 },
			},
			{
				id: "image",
				parentId: "group",
				bounds: { x: 10, y: 20, width: 100, height: 80 },
			},
		])
		const previousRect = { x: 1_055, y: 2_075, width: 120, height: 100 }

		expect(manager.queryElementIdsByExpandedRect(previousRect, 0)).toContain("image")

		const frame = elementsById.get("frame")
		if (!frame) throw new Error("missing frame fixture")
		frame.bounds = { ...frame.bounds, x: 5_000, y: 6_000 }
		manager.invalidateElements(new Set(["frame", "group", "image"]))

		expect(manager.queryElementIdsByExpandedRect(previousRect, 0)).not.toContain("image")
		expect(
			manager.queryElementIdsByExpandedRect(
				{ x: 5_055, y: 6_075, width: 120, height: 100 },
				0,
			),
		).toContain("image")
	})

	it("removes a nested subtree when an ancestor container becomes hidden", () => {
		const { elementsById, manager } = createNestedManager([
			{ id: "frame", bounds: { x: 100, y: 200, width: 600, height: 500 } },
			{
				id: "group",
				parentId: "frame",
				bounds: { x: 50, y: 60, width: 300, height: 240 },
			},
			{
				id: "video",
				parentId: "group",
				bounds: { x: 10, y: 20, width: 100, height: 80 },
			},
		])
		const queryRect = { x: 155, y: 275, width: 120, height: 100 }

		expect(manager.queryElementIdsByExpandedRect(queryRect, 0)).toContain("video")

		const frame = elementsById.get("frame")
		if (!frame) throw new Error("missing frame fixture")
		frame.visible = false
		manager.invalidateElements(new Set(["frame", "group", "video"]))

		expect(manager.queryElementIdsByExpandedRect(queryRect, 0)).toEqual([])
	})
})
