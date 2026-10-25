import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { collectStudyAttachments } from "../services/researchFiles"
import { groupStudyFiles } from "../services/studyFileGroups"

const file = (path: string): AttachmentItem => ({
	file_id: path,
	relative_file_path: path,
	is_directory: false,
})

describe("groupStudyFiles", () => {
	it("groups contract files and puts agent extras by type", () => {
		const list = [
			"studies/x/study.json",
			"studies/x/report.html",
			"studies/x/plan.md",
			"studies/x/desk-research.md",
			"studies/x/notes.md",
			"studies/x/deck.pptx",
			"studies/x/interviews/p_a.json",
			"studies/x/scratch.json",
		].map(file)
		const study = collectStudyAttachments(list, "studies/x/")
		const groups = groupStudyFiles(study, [file("personas/p_a.json")])

		const byKey = Object.fromEntries(
			groups.map((group) => [
				group.key,
				group.entries.map((entry) => `${entry.role}:${entry.file.relative_file_path}`),
			]),
		)
		expect(byKey.deliverables).toEqual([
			"report:studies/x/report.html",
			"other:studies/x/deck.pptx",
		])
		expect(byKey.process).toEqual([
			"plan:studies/x/plan.md",
			"deskResearch:studies/x/desk-research.md",
			"other:studies/x/notes.md",
		])
		expect(byKey.data).toEqual([
			"study:studies/x/study.json",
			"interview:studies/x/interviews/p_a.json",
			"other:studies/x/scratch.json",
			"persona:personas/p_a.json",
		])
	})

	it("drops empty groups", () => {
		const study = collectStudyAttachments([file("studies/y/study.json")], "studies/y/")
		expect(groupStudyFiles(study, []).map((group) => group.key)).toEqual(["data"])
	})
})
