import { describe, expect, it } from "vitest"
import type { PPTBuildEntry } from "../../../iframe-bridge/types/props"
import {
	appendBuildStep,
	appendBuildStepGroup,
	groupBuildQueue,
	NEW_STEP_DROP_ID,
	reorderBuildQueue,
	groupAutoDelay,
	resolveItemDrop,
	setGroupAutoDelay,
} from "../buildQueue"

const entry = (selector: string, step: number): PPTBuildEntry => ({
	selector,
	label: selector,
	build: { step, effect: "fade" },
})
describe("build queue", () => {
	it("reorders click groups together without separating simultaneous elements", () => {
		const entries = [entry("a", 7), entry("b", 2), entry("c", 7)]
		expect(groupBuildQueue(entries).map((g) => g.items.map((e) => e.selector))).toEqual([
			["b"],
			["a", "c"],
		])
		expect(reorderBuildQueue(entries, 1, 0).map((e) => [e.selector, e.build?.step])).toEqual([
			["a", 1],
			["c", 1],
			["b", 2],
		])
		expect(entries.map((e) => e.build.step)).toEqual([7, 2, 7])
	})
	it("ignores invalid and unchanged moves", () => {
		expect(reorderBuildQueue([entry("a", 1)], 0, 0)).toEqual([])
		expect(reorderBuildQueue([entry("a", 1)], 0, 1)).toEqual([])
	})
	it("appends safely at the schema limit and splits without duplicate targets", () => {
		const entries = [entry("a", 999), entry("b", 1000), entry("c", 1000)]
		expect(
			appendBuildStep(entries, "c", "appear").map((e) => [
				e.selector,
				e.build?.step,
				e.build?.effect,
			]),
		).toEqual([
			["a", 1, "fade"],
			["b", 2, "fade"],
			["c", 3, "appear"],
		])
		expect(appendBuildStep([entry("a", 7)], "b")[0].build?.step).toBe(8)
	})

	it("moves an element into another step, keeping its effect", () => {
		const entries = [
			entry("a", 1),
			{ ...entry("b", 2), build: { step: 2, effect: "appear" as const } },
		]
		expect(resolveItemDrop(entries, "b", 1)).toEqual([
			{ selector: "b", build: { step: 1, effect: "appear" } },
		])
	})

	it("ignores drops that change nothing", () => {
		const entries = [entry("a", 1), entry("b", 1), entry("c", 2)]
		expect(resolveItemDrop(entries, "a", 1)).toEqual([])
		expect(resolveItemDrop(entries, "missing", 2)).toEqual([])
		expect(resolveItemDrop(entries, "a", "other")).toEqual([])
		// c is alone in its step already
		expect(resolveItemDrop(entries, "c", NEW_STEP_DROP_ID)).toEqual([])
	})

	it("splits an element out of a shared step into a new last step", () => {
		const entries = [entry("a", 1), entry("b", 1), entry("c", 2)]
		expect(resolveItemDrop(entries, "a", NEW_STEP_DROP_ID)).toEqual([
			{ selector: "a", build: { step: 3, effect: "fade" } },
		])
	})

	it("treats a step as automatic when any element has a delay, using the longest", () => {
		const items = [
			entry("a", 1),
			{ ...entry("b", 1), build: { step: 1, effect: "fade" as const, after: 500 } },
			{ ...entry("c", 1), build: { step: 1, effect: "fade" as const, after: 1500 } },
		]
		expect(groupAutoDelay(items)).toBe(1500)
		expect(groupAutoDelay([entry("a", 1)])).toBeNull()
	})

	it("sets or clears the delay on every element of a step", () => {
		const items = [entry("a", 1), entry("b", 1)]
		expect(setGroupAutoDelay(items, 1000)).toEqual([
			{ selector: "a", build: { step: 1, effect: "fade", after: 1000 } },
			{ selector: "b", build: { step: 1, effect: "fade", after: 1000 } },
		])
		const auto = [{ ...entry("a", 1), build: { step: 1, effect: "fade" as const, after: 0 } }]
		expect(setGroupAutoDelay(auto, null)).toEqual([
			{ selector: "a", build: { step: 1, effect: "fade" } },
		])
	})

	it("adds several elements as one new last step", () => {
		const entries = [entry("a", 1), entry("b", 4)]
		expect(appendBuildStepGroup(entries, ["x", "y", "z"], "appear")).toEqual([
			{ selector: "x", build: { step: 5, effect: "appear" } },
			{ selector: "y", build: { step: 5, effect: "appear" } },
			{ selector: "z", build: { step: 5, effect: "appear" } },
		])
		expect(appendBuildStepGroup(entries, [])).toEqual([])
	})
})
