import { describe, expect, it } from "vitest"
import type { Rect } from "../../ids"
import { GeometryRTreeIndex, type GeometrySpatialIndexEntry } from "../GeometryRTreeIndex"

function intersects(left: Rect, right: Rect): boolean {
	return (
		left.x <= right.x + right.width &&
		left.x + left.width >= right.x &&
		left.y <= right.y + right.height &&
		left.y + left.height >= right.y
	)
}

function queryByScanning(entries: GeometrySpatialIndexEntry[], rect: Rect): string[] {
	return entries
		.filter((entry) => intersects(entry.bounds, rect))
		.map((entry) => entry.elementId)
		.sort()
}

describe("GeometryRTreeIndex", () => {
	it("matches brute-force queries for 10k elements including oversized geometry", () => {
		const entries: GeometrySpatialIndexEntry[] = []
		for (let index = 0; index < 10_000; index += 1) {
			entries.push({
				elementId: `element-${index}`,
				bounds:
					index % 500 === 0
						? {
								x: (index % 100) * 220 - 40_000,
								y: Math.floor(index / 100) * 180 - 40_000,
								width: 80_000,
								height: 80_000,
							}
						: {
								x: (index % 100) * 220,
								y: Math.floor(index / 100) * 180,
								width: 160,
								height: 120,
							},
			})
		}
		const queries: Rect[] = [
			{ x: 2_000, y: 2_000, width: 1_440, height: 900 },
			{ x: -250_000, y: -250_000, width: 500_000, height: 500_000 },
			{ x: 21_900, y: 17_900, width: 1, height: 1 },
			{ x: 1_000_000, y: 1_000_000, width: 100, height: 100 },
		]
		const index = new GeometryRTreeIndex()
		index.rebuild(entries)

		for (const query of queries) {
			expect(index.queryElementIds(query).sort()).toEqual(queryByScanning(entries, query))
		}
	})

	it("updates and removes entries without leaving stale geometry", () => {
		const index = new GeometryRTreeIndex()
		index.rebuild([
			{ elementId: "moving", bounds: { x: 0, y: 0, width: 100, height: 100 } },
			{ elementId: "stable", bounds: { x: 500, y: 500, width: 100, height: 100 } },
		])

		index.replaceMany([
			{ elementId: "moving", bounds: { x: 1_000, y: 1_000, width: 100, height: 100 } },
		])
		expect(index.queryElementIds({ x: 0, y: 0, width: 100, height: 100 })).toEqual([])
		expect(index.queryElementIds({ x: 1_000, y: 1_000, width: 100, height: 100 })).toEqual([
			"moving",
		])

		index.remove("moving")
		expect(index.queryElementIds({ x: 1_000, y: 1_000, width: 100, height: 100 })).toEqual([])
	})

	it("filters query results by the supplied element ids", () => {
		const index = new GeometryRTreeIndex()
		index.rebuild([
			{ elementId: "allowed", bounds: { x: 0, y: 0, width: 100, height: 100 } },
			{ elementId: "excluded", bounds: { x: 0, y: 0, width: 100, height: 100 } },
		])

		expect(
			index.queryElementIds({ x: 0, y: 0, width: 100, height: 100 }, new Set(["allowed"])),
		).toEqual(["allowed"])
	})
})
