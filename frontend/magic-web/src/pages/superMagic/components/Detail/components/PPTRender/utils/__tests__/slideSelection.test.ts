import { describe, expect, it } from "vitest"
import { moveSelectedToGap, selectSlideRange } from "../slideSelection"

describe("slide identity selection", () => {
	it("selects the current range after reordering and tolerates a removed anchor", () => {
		expect(selectSlideRange(["c", "b", "a"], "a", "c")).toEqual(["c", "b", "a"])
		expect(selectSlideRange(["c", "b"], "a", "c")).toEqual(["c"])
		expect(selectSlideRange(["c", "b"], "a", "a")).toEqual([])
	})
	it("moves disjoint pages together in document order at an original-list gap", () => {
		const pages = ["a", "b", "c", "d", "e"]
		const selected = new Set(["d", "b"])
		expect(moveSelectedToGap(pages, selected, String, 5)).toEqual(["a", "c", "e", "b", "d"])
		expect(moveSelectedToGap(pages, selected, String, 0)).toEqual(["b", "d", "a", "c", "e"])
		expect(moveSelectedToGap(pages, selected, String, 3)).toEqual(["a", "c", "b", "d", "e"])
		expect(pages).toEqual(["a", "b", "c", "d", "e"])
	})
	it("keeps a contiguous selection dropped within itself in place", () => {
		expect(moveSelectedToGap(["a", "b", "c", "d"], new Set(["b", "c"]), String, 2)).toEqual([
			"a",
			"b",
			"c",
			"d",
		])
	})
})
