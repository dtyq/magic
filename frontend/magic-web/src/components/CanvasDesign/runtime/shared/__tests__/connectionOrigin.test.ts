import { describe, expect, it } from "vitest"
import {
	areConnectionOriginsEqual,
	cloneConnectionOrigin,
	type ConnectionOrigin,
} from "../connectionOrigin"

describe("connectionOrigin", () => {
	it("clones mutable selection fields", () => {
		const origin: ConnectionOrigin = {
			kind: "selection",
			elementIds: ["a", "b"],
			side: "right",
			boundingRect: { x: 10, y: 20, width: 300, height: 160 },
			selectionRevision: "a\u0000b",
		}

		const cloned = cloneConnectionOrigin(origin)
		expect(cloned).toEqual(origin)
		if (cloned.kind !== "selection") throw new Error("Expected selection origin")
		expect(cloned.elementIds).not.toBe(origin.elementIds)
		expect(cloned.boundingRect).not.toBe(origin.boundingRect)
	})

	it("compares the complete selection origin", () => {
		const origin: ConnectionOrigin = {
			kind: "selection",
			elementIds: ["a", "b"],
			side: "right",
			boundingRect: { x: 10, y: 20, width: 300, height: 160 },
			selectionRevision: "a\u0000b",
		}

		expect(areConnectionOriginsEqual(origin, cloneConnectionOrigin(origin))).toBe(true)
		expect(
			areConnectionOriginsEqual(origin, {
				...origin,
				boundingRect: { ...origin.boundingRect, x: 11 },
			}),
		).toBe(false)
		expect(areConnectionOriginsEqual(origin, { ...origin, side: "left" })).toBe(false)
	})
})
