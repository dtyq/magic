import { describe, expect, it } from "vitest"
import { ElementTypeEnum } from "../../../document/types"
import { arrangeNodes, getArrangementGap, type ArrangementNode } from "../arrangementLayout"

function node(id: string, overrides: Partial<ArrangementNode> = {}): ArrangementNode {
	return {
		id,
		type: ElementTypeEnum.Image,
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		locked: false,
		visible: true,
		originalIndex: 0,
		zIndex: 0,
		...overrides,
	}
}

describe("arrangeNodes", () => {
	it("uses stable compact-grid coordinates and non-overlapping variable sizes", () => {
		const result = arrangeNodes(
			[
				node("a", { width: 100, height: 20, x: 80, y: 40, originalIndex: 0 }),
				node("b", { width: 40, height: 80, x: 10, y: 30, originalIndex: 1 }),
				node("c", { width: 60, height: 30, x: 20, y: 100, originalIndex: 2 }),
			],
			{ mode: "compact-grid" },
		)

		expect(result.changed).toBe(true)
		expect(result.positions.get("b")).toEqual({ x: 10, y: 30 })
		expect(result.positions.get("a")).toEqual({ x: 94, y: 30 })
		expect(result.positions.get("c")).toEqual({ x: 10, y: 134 })
	})

	it("uses the fixed clamped gap rule", () => {
		expect(getArrangementGap([node("small", { width: 10, height: 10 })])).toBe(24)
		expect(getArrangementGap([node("large", { width: 500, height: 100 })])).toBe(80)
		expect(getArrangementGap([node("medium", { width: 100, height: 50 })])).toBe(24)
	})

	it("compresses cycles into one layer and reports isolated nodes", () => {
		const result = arrangeNodes(
			[
				node("a", { originalIndex: 0 }),
				node("b", { originalIndex: 1 }),
				node("c", { originalIndex: 2 }),
				node("isolated", { originalIndex: 3, type: ElementTypeEnum.Audio }),
			],
			{
				mode: "layered",
				connections: [
					{ sourceElementId: "a", targetElementId: "b" },
					{ sourceElementId: "b", targetElementId: "a" },
				],
			},
		)

		expect(result.cycleNodeCount).toBe(2)
		expect(result.isolatedNodeCount).toBe(2)
		expect(result.layerCount).toBe(1)
		expect(
			(result.positions.get("isolated")?.x ?? 0) > (result.positions.get("a")?.x ?? 0),
		).toBe(true)
	})

	it("smart mode selects type groups when there is no internal edge", () => {
		const result = arrangeNodes(
			[
				node("video", { type: ElementTypeEnum.Video, originalIndex: 0 }),
				node("image", { type: ElementTypeEnum.Image, originalIndex: 1 }),
			],
			{ mode: "smart" },
		)
		expect(result.layerCount).toBe(0)
		expect(result.isolatedNodeCount).toBe(0)
		expect(result.positions.get("image")?.x).toBe(0)
		expect(result.positions.get("video")?.y).toBeGreaterThan(
			result.positions.get("image")?.y ?? 0,
		)
	})

	it("smart mode selects layered layout when the scope has an internal edge", () => {
		const result = arrangeNodes(
			[
				node("source", { x: 200, originalIndex: 0 }),
				node("target", { x: 0, originalIndex: 1 }),
			],
			{
				mode: "smart",
				connections: [{ sourceElementId: "source", targetElementId: "target" }],
			},
		)

		expect(result.layerCount).toBe(2)
		expect(result.positions.get("source")?.x).toBeLessThan(
			result.positions.get("target")?.x ?? 0,
		)
	})

	it("sorts rows by descending height and columns by descending width", () => {
		const nodes = [
			node("second", { x: 100, y: 40, width: 80, height: 20, originalIndex: 1 }),
			node("first", { x: 20, y: 10, width: 40, height: 60, originalIndex: 0 }),
		]
		const row = arrangeNodes(nodes, { mode: "horizontal-row", gap: 24 })
		const column = arrangeNodes(nodes, { mode: "vertical-column", gap: 24 })

		expect(row.positions.get("first")?.x).toBeLessThan(row.positions.get("second")?.x ?? 0)
		expect((row.positions.get("first")?.y ?? 0) + 30).toBe(
			(row.positions.get("second")?.y ?? 0) + 10,
		)
		expect(column.positions.get("second")?.y).toBeLessThan(
			column.positions.get("first")?.y ?? 0,
		)
		expect((column.positions.get("first")?.x ?? 0) + 20).toBe(
			(column.positions.get("second")?.x ?? 0) + 40,
		)
	})

	it("centers a row and column against the selected container", () => {
		const nodes = [
			node("first", { width: 40, height: 20, originalIndex: 0 }),
			node("second", { width: 80, height: 60, originalIndex: 1 }),
		]
		const row = arrangeNodes(nodes, {
			mode: "horizontal-row",
			containerSize: { width: 400, height: 300 },
		})
		const column = arrangeNodes(nodes, {
			mode: "vertical-column",
			containerSize: { width: 400, height: 300 },
		})

		expect(row.positions.get("second")?.x).toBe(128)
		expect(row.positions.get("first")?.x).toBe(232)
		expect((row.positions.get("first")?.y ?? 0) + 10).toBe(150)
		expect((row.positions.get("second")?.y ?? 0) + 30).toBe(150)
		expect(column.positions.get("second")?.y).toBe(98)
		expect(column.positions.get("first")?.y).toBe(182)
		expect((column.positions.get("first")?.x ?? 0) + 20).toBe(200)
		expect((column.positions.get("second")?.x ?? 0) + 40).toBe(200)
	})

	it("keeps source order when the size key is equal", () => {
		const row = arrangeNodes(
			[
				node("second", { width: 80, height: 40, originalIndex: 1 }),
				node("first", { width: 40, height: 40, originalIndex: 0 }),
			],
			{ mode: "horizontal-row", gap: 24 },
		)
		const column = arrangeNodes(
			[
				node("second", { width: 40, height: 80, originalIndex: 1 }),
				node("first", { width: 40, height: 40, originalIndex: 0 }),
			],
			{ mode: "vertical-column", gap: 24 },
		)

		expect(row.positions.get("first")?.x).toBeLessThan(row.positions.get("second")?.x ?? 0)
		expect(column.positions.get("first")?.y).toBeLessThan(
			column.positions.get("second")?.y ?? 0,
		)
	})

	it("keeps a linear layout centred after the required container size is exceeded", () => {
		const nodes = [
			node("first", { width: 240, height: 80, originalIndex: 0 }),
			node("second", { width: 240, height: 80, originalIndex: 1 }),
		]
		const row = arrangeNodes(nodes, {
			mode: "horizontal-row",
			containerSize: { width: 300, height: 100 },
			gap: 24,
		})
		const rowMinX = Math.min(...nodes.map((item) => row.positions.get(item.id)?.x ?? 0))
		const rowMaxX = Math.max(
			...nodes.map((item) => (row.positions.get(item.id)?.x ?? 0) + item.width),
		)
		const rowMinY = Math.min(...nodes.map((item) => row.positions.get(item.id)?.y ?? 0))
		const rowMaxY = Math.max(
			...nodes.map((item) => (row.positions.get(item.id)?.y ?? 0) + item.height),
		)
		expect(rowMinX).toBeGreaterThan(0)
		expect(rowMaxX - rowMinX).toBe(504)
		expect(rowMinY).toBeGreaterThan(0)
		expect(rowMaxY - rowMinY).toBe(80)

		const column = arrangeNodes(nodes, {
			mode: "vertical-column",
			containerSize: { width: 100, height: 300 },
			gap: 24,
		})
		const columnMinX = Math.min(...nodes.map((item) => column.positions.get(item.id)?.x ?? 0))
		const columnMaxX = Math.max(
			...nodes.map((item) => (column.positions.get(item.id)?.x ?? 0) + item.width),
		)
		const columnMinY = Math.min(...nodes.map((item) => column.positions.get(item.id)?.y ?? 0))
		const columnMaxY = Math.max(
			...nodes.map((item) => (column.positions.get(item.id)?.y ?? 0) + item.height),
		)
		expect(columnMinX).toBeGreaterThan(0)
		expect(columnMaxX - columnMinX).toBe(240)
		expect(columnMinY).toBeGreaterThan(0)
		expect(columnMaxY - columnMinY).toBe(184)
	})

	it("uses the documented type order and keeps hidden nodes in the layout", () => {
		const result = arrangeNodes(
			[
				node("other", { type: ElementTypeEnum.Text, originalIndex: 0 }),
				node("merged", { type: ElementTypeEnum.VideoEdit, originalIndex: 1 }),
				node("hidden-image", {
					type: ElementTypeEnum.Image,
					visible: false,
					originalIndex: 2,
				}),
				node("storyboard", { type: ElementTypeEnum.Storyboard, originalIndex: 3 }),
				node("video", { type: ElementTypeEnum.Video, originalIndex: 4 }),
				node("audio", { type: ElementTypeEnum.Audio, originalIndex: 5 }),
			],
			{ mode: "type-group", gap: 24 },
		)

		const ys = ["hidden-image", "storyboard", "video", "audio", "merged", "other"].map(
			(id) => result.positions.get(id)?.y ?? -1,
		)
		expect(ys).toEqual([...ys].sort((left, right) => left - right))
		expect(result.positions.has("hidden-image")).toBe(true)
	})

	it("assigns longest-path layers across disconnected DAG components", () => {
		const result = arrangeNodes(
			[
				node("a", { originalIndex: 0 }),
				node("b", { originalIndex: 1 }),
				node("c", { originalIndex: 2 }),
				node("d", { originalIndex: 3 }),
				node("e", { originalIndex: 4 }),
			],
			{
				mode: "layered",
				connections: [
					{ sourceElementId: "a", targetElementId: "b" },
					{ sourceElementId: "b", targetElementId: "c" },
					{ sourceElementId: "d", targetElementId: "e" },
				],
			},
		)

		expect(result.layerCount).toBe(3)
		expect(result.positions.get("a")?.x).toBe(result.positions.get("d")?.x)
		expect(result.positions.get("b")?.x).toBe(result.positions.get("e")?.x)
		expect(result.positions.get("c")?.x).toBeGreaterThan(result.positions.get("b")?.x ?? 0)
	})

	it("keeps the configured vertical gap between separate components in one layer", () => {
		const result = arrangeNodes(
			[
				node("first", { height: 20, originalIndex: 0 }),
				node("second", { height: 40, originalIndex: 1 }),
				node("first-target", { x: 200, originalIndex: 2 }),
				node("second-target", { x: 200, originalIndex: 3 }),
			],
			{
				mode: "layered",
				gap: 24,
				connections: [
					{ sourceElementId: "first", targetElementId: "first-target" },
					{ sourceElementId: "second", targetElementId: "second-target" },
				],
			},
		)

		const firstY = result.positions.get("first")?.y ?? 0
		const secondY = result.positions.get("second")?.y ?? 0
		const firstTargetY = result.positions.get("first-target")?.y ?? 0
		const secondTargetY = result.positions.get("second-target")?.y ?? 0
		// Centre correction may translate the complete graph to keep the first
		// layer inside the local coordinate space, but it must preserve each
		// layer's original spacing.
		expect(secondY - firstY).toBe(44)
		expect(secondTargetY - firstTargetY).toBe(74)
		expect(Math.min(firstY, firstTargetY)).toBe(0)
	})

	it("orders disconnected components in a shared layer by stable canvas position", () => {
		const result = arrangeNodes(
			[
				node("lower", { x: 0, y: 200, originalIndex: 0 }),
				node("upper", { x: 0, y: 20, originalIndex: 1 }),
				node("lower-target", { x: 200, y: 200, originalIndex: 2 }),
				node("upper-target", { x: 200, y: 20, originalIndex: 3 }),
			],
			{
				mode: "layered",
				connections: [
					{ sourceElementId: "lower", targetElementId: "lower-target" },
					{ sourceElementId: "upper", targetElementId: "upper-target" },
				],
			},
		)

		expect(result.positions.get("upper")?.y).toBeLessThan(result.positions.get("lower")?.y ?? 0)
		expect(result.positions.get("upper-target")?.y).toBeLessThan(
			result.positions.get("lower-target")?.y ?? 0,
		)
	})

	it("centers different-width nodes within the same layer column", () => {
		const result = arrangeNodes(
			[
				node("source", { width: 120, height: 40, originalIndex: 0 }),
				node("narrow", { width: 40, height: 40, originalIndex: 1 }),
				node("wide", { width: 80, height: 40, originalIndex: 2 }),
			],
			{
				mode: "layered",
				connections: [
					{ sourceElementId: "source", targetElementId: "narrow" },
					{ sourceElementId: "source", targetElementId: "wide" },
				],
			},
		)

		const narrow = result.positions.get("narrow")
		const wide = result.positions.get("wide")
		expect((narrow?.x ?? 0) + 20).toBe((wide?.x ?? 0) + 40)
	})

	it("aligns fan-in endpoints with the average upstream centre", () => {
		const result = arrangeNodes(
			[
				node("source-a", { y: 0, originalIndex: 0 }),
				node("source-b", { y: 300, originalIndex: 1 }),
				node("target", { y: 120, originalIndex: 2 }),
			],
			{
				mode: "layered",
				connections: [
					{ sourceElementId: "source-a", targetElementId: "target" },
					{ sourceElementId: "source-b", targetElementId: "target" },
				],
			},
		)

		const sourceACenter = (result.positions.get("source-a")?.y ?? 0) + 25
		const sourceBCenter = (result.positions.get("source-b")?.y ?? 0) + 25
		const targetCenter = (result.positions.get("target")?.y ?? 0) + 25
		expect(targetCenter).toBeCloseTo((sourceACenter + sourceBCenter) / 2)
	})

	it("does not move locked nodes and is a no-op with fewer than two movable nodes", () => {
		const locked = node("locked", { locked: true, x: 300, y: 400 })
		const result = arrangeNodes([locked, node("movable", { x: 20, y: 30, originalIndex: 1 })], {
			mode: "horizontal-row",
		})
		expect(result.changed).toBe(false)
		expect(result.skippedLockedCount).toBe(1)
		expect(result.positions.get("locked")).toBeUndefined()
		expect(result.positions.get("movable")).toEqual({ x: 20, y: 30 })
	})

	it("does not use locked nodes as the movable layout origin", () => {
		const result = arrangeNodes(
			[
				node("locked", { locked: true, x: -1000, y: -1000 }),
				node("a", { x: 20, y: 30, originalIndex: 0 }),
				node("b", { x: 200, y: 30, originalIndex: 1 }),
			],
			{ mode: "horizontal-row" },
		)

		expect(result.positions.get("a")?.x).toBe(20)
		expect(result.positions.get("locked")).toBeUndefined()
	})
})
