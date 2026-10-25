import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { classifyStudyDeliverables, personaIdOfFile } from "../services/researchDeliverables"
import { collectStudyAttachments } from "../services/researchFiles"

const file = (path: string): AttachmentItem => ({
	file_id: path,
	relative_file_path: path,
	is_directory: false,
})

const dir = "studies/recorder-7f3a/"
const projectFiles = [
	"study.json",
	"report.html",
	"plan.md",
	"desk-research.md",
	"validation-questionnaire.md",
	"validation-questionnaire.csv",
	"synthesis.json",
	"interviews/p1.json",
	"interviews/p2.json",
	"discussions/d1.json",
].map((name) => file(`${dir}${name}`))
const study = collectStudyAttachments(projectFiles, dir)

describe("classifyStudyDeliverables", () => {
	it("groups study files by role and keeps unrelated files as others", () => {
		const result = classifyStudyDeliverables(
			[...projectFiles, file("uploads/notes.png")],
			study,
		)

		expect(result?.report?.file_id).toBe(`${dir}report.html`)
		expect(result?.validation?.file_id).toBe(`${dir}validation-questionnaire.md`)
		expect(result?.validationCsv?.file_id).toBe(`${dir}validation-questionnaire.csv`)
		expect(result?.documents.map((doc) => doc.key)).toEqual(["plan", "deskResearch"])
		expect(result?.interviews).toBe(2)
		expect(result?.discussions).toBe(1)
		expect(result?.hasSynthesis).toBe(true)
		expect(result?.others.map((item) => item.file_id)).toEqual(["uploads/notes.png"])
	})

	it("matches message attachments by file id even without a path", () => {
		const result = classifyStudyDeliverables([{ file_id: `${dir}plan.md` }], study)
		expect(result?.documents).toHaveLength(1)
	})

	it("keeps the default list when nothing study-specific is attached", () => {
		expect(classifyStudyDeliverables([file("uploads/notes.png")], study)).toBeNull()
		expect(classifyStudyDeliverables([file(`${dir}study.json`)], study)).toBeNull()
		expect(classifyStudyDeliverables(projectFiles, null)).toBeNull()
	})
})

describe("persona library files", () => {
	it("extracts the persona id from a library file path only", () => {
		expect(personaIdOfFile(file("personas/p_chen_1a2b.json"))).toBe("p_chen_1a2b")
		expect(personaIdOfFile(file("/personas/p_chen_1a2b.json"))).toBe("p_chen_1a2b")
		expect(personaIdOfFile(file("personas/nested/p1.json"))).toBeNull()
		expect(personaIdOfFile(file("personas/README.md"))).toBeNull()
		expect(personaIdOfFile(file(`${dir}interviews/p1.json`))).toBeNull()
	})

	it("lists library personas separately from other files", () => {
		const result = classifyStudyDeliverables(
			[
				file("studies/recorder-7f3a/study.json"),
				file("personas/p_a.json"),
				file("personas/p_b.json"),
				file("uploads/notes.png"),
			],
			study,
		)

		expect(result?.personas.map((item) => item.file_id)).toEqual([
			"personas/p_a.json",
			"personas/p_b.json",
		])
		expect(result?.others.map((item) => item.file_id)).toEqual(["uploads/notes.png"])
	})
})

describe("message attachments without a project path", () => {
	// A finished-task message lists files by `filename` and `file_key` only.
	const messageFile = (id: string, filename: string): AttachmentItem => ({
		file_id: id,
		filename,
		display_filename: filename,
	})
	const library = [
		file("personas/p_chen_1a2b.json"),
		file("personas/p_li_3c4d.json"),
		file("personas/portraits/p_chen_1a2b/0123456789abcdef0123.webp"),
	]
	const byId = new Map<string, AttachmentItem>(
		[...projectFiles, ...library].map((item) => [String(item.file_id), item]),
	)

	it("resolves persona files by id so they render as people, and hides their portraits", () => {
		const result = classifyStudyDeliverables(
			[
				messageFile("studies/recorder-7f3a/report.html", "report.html"),
				messageFile("personas/p_chen_1a2b.json", "p_chen_1a2b.json"),
				messageFile("personas/p_li_3c4d.json", "p_li_3c4d.json"),
				messageFile(
					"personas/portraits/p_chen_1a2b/0123456789abcdef0123.webp",
					"0123456789abcdef0123.webp",
				),
			],
			study,
			byId,
		)

		expect(result?.personas.map((item) => personaIdOfFile(item))).toEqual([
			"p_chen_1a2b",
			"p_li_3c4d",
		])
		expect(result?.others).toEqual([])
	})

	it("keeps an unknown message file as is", () => {
		const result = classifyStudyDeliverables(
			[
				messageFile("studies/recorder-7f3a/report.html", "report.html"),
				messageFile("unknown-id", "notes.png"),
			],
			study,
			byId,
		)
		expect(result?.others.map((item) => item.filename)).toEqual(["notes.png"])
	})
})
