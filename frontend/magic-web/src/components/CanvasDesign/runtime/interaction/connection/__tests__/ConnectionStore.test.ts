import { describe, expect, it } from "vitest"
import type { CanvasConnection } from "../../../document/types"
import { ConnectionStore } from "../ConnectionStore"

describe("ConnectionStore", () => {
	it("loads connections, keeps indexes, and exports cloned data", () => {
		const store = new ConnectionStore()

		store.load([
			{ id: "a", sourceElementId: "source", targetElementId: "target" },
			{ id: "b", sourceElementId: "target", targetElementId: "other" },
		])

		expect(store.hasConnectionId("a")).toBe(true)
		expect(store.hasConnection("source", "target")).toBe(true)
		expect(store.hasReverseConnection("target", "source")).toBe(true)
		expect(store.hasAnyConnectionBetween("target", "source")).toBe(true)
		expect(store.getUpstreamConnections("target").map((item) => item.id)).toEqual(["a"])
		expect(store.getDownstreamConnections("target").map((item) => item.id)).toEqual(["b"])
		expect(store.getConnectionIdsByElementId("target")).toEqual(["a", "b"])

		const exported = store.getConnections()
		exported[0].sourceElementId = "changed"
		expect(store.getConnections()[0]).toEqual({
			id: "a",
			sourceElementId: "source",
			targetElementId: "target",
		})
	})

	it("rejects duplicate ids, duplicate pairs, reverse pairs, and self connections", () => {
		const store = new ConnectionStore()

		store.load([
			{ id: "a", sourceElementId: "source", targetElementId: "target" },
			{ id: "a", sourceElementId: "target", targetElementId: "other" },
			{ id: "b", sourceElementId: "source", targetElementId: "target" },
			{ id: "c", sourceElementId: "target", targetElementId: "source" },
			{ id: "self", sourceElementId: "source", targetElementId: "source" },
		])

		expect(store.getConnections()).toEqual([
			{ id: "a", sourceElementId: "source", targetElementId: "target" },
		])
		expect(store.add({ id: "d", sourceElementId: "target", targetElementId: "source" })).toBe(
			false,
		)
		expect(store.add({ id: "e", sourceElementId: "target", targetElementId: "other" })).toBe(
			true,
		)
		expect(store.getConnectionIds()).toEqual(["a", "e"])
	})

	it("removes by id and by endpoint element while keeping indexes in sync", () => {
		const store = new ConnectionStore()

		store.load([
			{ id: "a", sourceElementId: "source", targetElementId: "target" },
			{ id: "b", sourceElementId: "target", targetElementId: "other" },
			{ id: "c", sourceElementId: "source", targetElementId: "other" },
		])

		expect(store.removeConnections(["missing", "c"])).toEqual(["c"])
		expect(store.hasConnection("source", "other")).toBe(false)
		expect(store.getConnectionIds()).toEqual(["a", "b"])

		expect(store.removeConnectionsByElementId("target")).toEqual(["a", "b"])
		expect(store.isEmpty()).toBe(true)
		expect(store.hasConnection("source", "target")).toBe(false)
		expect(store.getUpstreamConnections("target")).toEqual([])
		expect(store.getDownstreamConnections("target")).toEqual([])
	})

	it("keeps only the connection DSL fields and removes the connection normally", () => {
		const store = new ConnectionStore()
		store.load([
			{
				id: "with-extra-field",
				sourceElementId: "source",
				targetElementId: "target",
				unsupportedField: true,
			} as CanvasConnection & { unsupportedField: true },
			{ id: "normal", sourceElementId: "source", targetElementId: "other" },
		])

		expect(store.getConnections()[0]).toEqual({
			id: "with-extra-field",
			sourceElementId: "source",
			targetElementId: "target",
		})
		expect(store.removeConnections(["with-extra-field", "normal"])).toEqual([
			"with-extra-field",
			"normal",
		])
		expect(store.getConnections()).toEqual([])
	})
})
