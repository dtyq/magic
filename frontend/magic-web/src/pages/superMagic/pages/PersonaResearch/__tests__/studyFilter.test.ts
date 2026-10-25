import { describe, expect, it } from "vitest"
import { countStudyGroups, filterStudies, studyGroupOf } from "../services/studyFilter"

const items = [
	{ item: "a", title: "Pricing for Office Lunch", kind: "running" as const },
	{ item: "b", title: "儿童营地会员", kind: "waiting_user" as const },
	{ item: "c", title: "Laundry pricing", kind: "done" as const },
	{ item: "d", title: "First purchase churn", kind: "failed" as const },
	{ item: "e", title: "Template chat", kind: "conversation" as const },
]

describe("studyGroupOf", () => {
	it("folds waiting into active and failed into stopped", () => {
		expect(studyGroupOf("waiting_user")).toBe("active")
		expect(studyGroupOf("failed")).toBe("stopped")
		expect(studyGroupOf("idle")).toBe("stopped")
	})
})

describe("filterStudies", () => {
	it("keeps everything for all and an empty keyword", () => {
		expect(filterStudies(items, "all", "  ")).toEqual(["a", "b", "c", "d", "e"])
	})

	it("matches the title ignoring case", () => {
		expect(filterStudies(items, "all", "PRICING")).toEqual(["a", "c"])
		expect(filterStudies(items, "all", "营地")).toEqual(["b"])
	})

	it("combines the group and the keyword", () => {
		expect(filterStudies(items, "active", "pricing")).toEqual(["a"])
		expect(filterStudies(items, "stopped", "")).toEqual(["d"])
	})
})

describe("countStudyGroups", () => {
	it("counts each group", () => {
		expect(countStudyGroups(items.map(({ kind }) => kind))).toEqual({
			active: 2,
			done: 1,
			stopped: 1,
			conversation: 1,
		})
	})
})
