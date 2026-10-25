import { describe, expect, it } from "vitest"
import {
	countVisibleStudyFiles,
	firstOutputTab,
	hasStudyOutputs,
	type StudyOutputCounts,
} from "../services/studyOutputs"

const none: StudyOutputCounts = {
	report: 0,
	hypotheses: 0,
	personas: 0,
	interviews: 0,
	discussions: 0,
	analysis: 0,
	files: 0,
	validation: 0,
}

describe("hasStudyOutputs / firstOutputTab", () => {
	it("has nothing while every tab is empty", () => {
		expect(hasStudyOutputs(none)).toBe(false)
		expect(firstOutputTab(none)).toBeNull()
	})

	it("opens on the earliest filled tab in study order", () => {
		const counts = { ...none, personas: 3, report: 1 }
		expect(hasStudyOutputs(counts)).toBe(true)
		expect(firstOutputTab(counts)).toBe("personas")
		expect(firstOutputTab({ ...none, files: 1 })).toBe("files")
	})
})

describe("countVisibleStudyFiles", () => {
	it("ignores study.json and hidden files", () => {
		expect(
			countVisibleStudyFiles([
				"studies/a/study.json",
				"studies/a/.draft",
				"studies/a/plan.md",
			]),
		).toBe(1)
		expect(countVisibleStudyFiles(["studies/a/study.json"])).toBe(0)
	})
})
