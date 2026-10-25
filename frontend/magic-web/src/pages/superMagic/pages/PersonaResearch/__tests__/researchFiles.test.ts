import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import {
	collectStudyAttachments,
	findStudyDir,
	indexStudyDirs,
	listLibraryFiles,
	listReportTemplates,
	parseDiscussionFile,
	parseInterviewFile,
	parsePersonaFile,
	parseStudyFile,
	reportTemplateName,
	resolvePhaseStatuses,
} from "../services/researchFiles"

const file = (path: string, extra: Partial<AttachmentItem> = {}): AttachmentItem => ({
	file_id: path,
	relative_file_path: path,
	is_directory: false,
	...extra,
})

const validStudy = {
	schema_version: 1,
	title: "AI 录音硬件",
	question: "老板们为什么不用 AI 录音？",
	phase: "interview",
	phases: [
		{ key: "clarify", status: "done" },
		{ key: "plan", status: "done" },
		{ key: "desk_research", status: "done" },
		{ key: "interview", status: "running" },
	],
}

describe("findStudyDir", () => {
	it("finds the study directory written by the topic", () => {
		const list = [
			file("/studies/a-1111/study.json", { topic_id: "t1" }),
			file("studies/b-2222/study.json", { topic_id: "t2" }),
		]
		expect(findStudyDir(list, "t1")).toBe("studies/a-1111/")
		expect(findStudyDir(list, "t2")).toBe("studies/b-2222/")
		expect(findStudyDir(list, "t3")).toBeNull()
	})

	it("ignores nested study.json files and prefers the latest one", () => {
		const list = [
			file("studies/a/inner/study.json", { topic_id: "t1" }),
			file("studies/old/study.json", { topic_id: "t1", updated_at: "2026-10-17 10:00:00" }),
			file("studies/new/study.json", { topic_id: "t1", updated_at: "2026-10-18 10:00:00" }),
		]
		expect(findStudyDir(list, "t1")).toBe("studies/new/")
	})

	it("matches the topic_id recorded in study.json when attachments carry topic 0", () => {
		const list = [
			file("studies/a-1111/study.json", { topic_id: "0" }),
			file("studies/b-2222/study.json", { topic_id: "0" }),
		]
		const recorded: Record<string, string> = {
			"studies/a-1111/study.json": "t1",
			"studies/b-2222/study.json": "t2",
		}
		const studyTopicIdOf = (item: AttachmentItem) => recorded[String(item.relative_file_path)]
		expect(findStudyDir(list, "t2", studyTopicIdOf)).toBe("studies/b-2222/")
		expect(findStudyDir(list, "t3", studyTopicIdOf)).toBeNull()
		expect(findStudyDir(list, "t1")).toBeNull()
	})
})

describe("indexStudyDirs", () => {
	it("maps every topic in one pass with the same rules as findStudyDir", () => {
		const list = [
			file("studies/a/study.json", { topic_id: "0" }),
			file("studies/old/study.json", { topic_id: "0", updated_at: "2026-10-17 10:00:00" }),
			file("studies/new/study.json", { topic_id: "0", updated_at: "2026-10-18 10:00:00" }),
			file("studies/legacy/study.json", { topic_id: "t3" }),
			file("studies/a/inner/study.json", { topic_id: "t4" }),
		]
		const recorded: Record<string, string> = {
			"studies/a/study.json": "t1",
			"studies/old/study.json": "t2",
			"studies/new/study.json": "t2",
		}
		const index = indexStudyDirs(list, (item) => recorded[String(item.relative_file_path)])
		expect(index.get("t1")).toBe("studies/a/")
		expect(index.get("t2")).toBe("studies/new/")
		expect(index.get("t3")).toBe("studies/legacy/")
		expect(index.has("t4")).toBe(false)
		for (const topicId of ["t1", "t2", "t3", "t4"]) {
			expect(index.get(topicId) ?? null).toBe(
				findStudyDir(list, topicId, (item) => recorded[String(item.relative_file_path)]),
			)
		}
	})
})

describe("collectStudyAttachments", () => {
	it("groups files by contract role", () => {
		const list = [
			file("studies/s/study.json"),
			file("studies/s/panel.json"),
			file("studies/s/report.html"),
			file("studies/s/validation-questionnaire.md"),
			file("studies/s/interviews/p_b.json"),
			file("studies/s/interviews/p_a.json"),
			file("studies/s/discussions/d1.json"),
			file("studies/other/report.html"),
		]
		const result = collectStudyAttachments(list, "studies/s/")
		expect(result.study?.file_id).toBe("studies/s/study.json")
		expect(result.report?.file_id).toBe("studies/s/report.html")
		expect(result.interviews.map((item) => item.file_id)).toEqual([
			"studies/s/interviews/p_a.json",
			"studies/s/interviews/p_b.json",
		])
		expect(result.discussions).toHaveLength(1)
		expect(result.all).toHaveLength(7)
	})
})

describe("listLibraryFiles", () => {
	it("lists only top-level json files of the library directory", () => {
		const list = [
			file("personas/p_a.json"),
			file("personas/notes.md"),
			file("personas/archive/p_b.json"),
			file("personas", { is_directory: true, file_id: "dir" }),
		]
		expect(listLibraryFiles(list, "personas/").map((item) => item.file_id)).toEqual([
			"personas/p_a.json",
		])
	})
})

describe("parsers", () => {
	it("accepts a valid study and reports stepper statuses", () => {
		const parsed = parseStudyFile(JSON.stringify(validStudy))
		expect(parsed.ok).toBe(true)
		if (!parsed.ok) return
		expect(resolvePhaseStatuses(parsed.data).map((item) => item.status)).toEqual([
			"done",
			"done",
			"done",
			"running",
			"pending",
			"pending",
		])
	})

	it("treats half-written or unknown-version files as not ready", () => {
		expect(parseStudyFile('{"schema_version":1,"title":').ok).toBe(false)
		expect(parseStudyFile({ ...validStudy, schema_version: 2 }).ok).toBe(false)
		expect(parseStudyFile({ ...validStudy, phase: "unknown" }).ok).toBe(false)
	})

	it("keeps a persona when optional fields are malformed", () => {
		const parsed = parsePersonaFile({
			schema_version: 1,
			id: "p_wang_7f3a",
			name: "王建国",
			tier: "legendary",
			tags: "not-an-array",
			extra_field: true,
		})
		expect(parsed.ok).toBe(true)
		if (!parsed.ok) return
		expect(parsed.data.tier).toBe("generated")
		expect(parsed.data.tags).toBeUndefined()
	})

	it("parses interviews and discussions", () => {
		expect(
			parseInterviewFile({
				schema_version: 1,
				persona_id: "p_a",
				status: "done",
				rounds: [{ role: "moderator", text: "你好" }],
			}).ok,
		).toBe(true)
		expect(
			parseDiscussionFile({
				schema_version: 1,
				participants: ["p_a", "p_b"],
				status: "running",
				rounds: [{ speaker: "p_a", text: "我觉得" }],
			}).ok,
		).toBe(true)
		expect(parseInterviewFile({ schema_version: 1, status: "done", rounds: [] }).ok).toBe(false)
	})
})

describe("Top 5 contract fields", () => {
	it("keeps valid hypotheses and drops malformed ones", async () => {
		const { parseStudyFile } = await import("../services/researchFiles")
		const parsed = parseStudyFile({
			...validStudy,
			decision: "是否立项",
			hypotheses: [
				{
					id: "H1",
					statement: "口头约定没留痕是第一痛点",
					verdict: "mixed",
					evidence_refs: [
						{ kind: "quote", persona_id: "p_a", round_index: 1, text: "原话" },
						{ kind: "source", ref: "S3" },
						{ kind: "unknown" },
					],
				},
				{ id: "H2" },
			],
			quota: [{ segment: "建材", count: 3 }],
			validated_count: 12,
		})
		expect(parsed.ok).toBe(true)
		if (!parsed.ok) return
		expect(parsed.data.hypotheses).toHaveLength(1)
		expect(parsed.data.hypotheses?.[0].evidence_refs).toHaveLength(2)
		expect(parsed.data.validated_count).toBe(12)
	})

	it("parses synthesis and validation results", async () => {
		const { parseSynthesisFile, parseValidationResultsFile } =
			await import("../services/researchFiles")
		const synthesis = parseSynthesisFile({
			schema_version: 1,
			segments: [{ id: "s1", name: "建材", persona_ids: ["p_a"] }],
			themes: [
				{
					id: "T1",
					name: "留痕",
					stance_by_persona: { p_a: "support", p_b: "weird" },
					confidence: "nonsense",
				},
				{ name: "missing id" },
			],
			dimensions: [{ id: "D1", name: "价格", level_by_segment: { s1: "high" } }],
			saturation: { new_themes_per_interview: [3, 1, 0, 0], saturated: true },
		})
		expect(synthesis.ok).toBe(true)
		if (!synthesis.ok) return
		expect(synthesis.data.themes).toHaveLength(1)
		expect(synthesis.data.themes[0].stance_by_persona.p_b).toBe("not_mentioned")
		expect(synthesis.data.themes[0].confidence).toBe("to_validate")

		const results = parseValidationResultsFile({
			schema_version: 1,
			respondent_count: 12,
			by_hypothesis: [{ hypothesis_id: "H1", agreement: "agree" }, { hypothesis_id: "H2" }],
		})
		expect(results.ok).toBe(true)
		if (results.ok) expect(results.data.by_hypothesis).toHaveLength(1)
	})

	it("accepts legacy numeric decision weights and social evidence", async () => {
		const { parsePersonaFile } = await import("../services/researchFiles")
		const parsed = parsePersonaFile({
			schema_version: 1,
			id: "p_a",
			name: "王建国",
			tier: "evidence_based",
			layers: { cognition: { decision_weights: { 价格: 0.3 } } },
			evidence: [{ id: "e1", type: "social", platform: "xiaohongshu" }],
			field_sources: { needs_pains: ["e1"], tech_adoption: "inferred" },
		})
		expect(parsed.ok).toBe(true)
		if (parsed.ok) expect(parsed.data.evidence?.[0].type).toBe("social")
	})
})

describe("user-created personas", () => {
	it("keeps the manual tier, user field sources and edited_at", async () => {
		const { parsePersonaFile } = await import("../services/researchFiles")
		const parsed = parsePersonaFile({
			schema_version: 1,
			id: "p_user_1a2b",
			name: "王芳",
			tier: "manual",
			field_sources: { needs_pains: "user", behavior: ["e1"] },
			edited_at: "2026-10-18T15:02:00+08:00",
		})
		expect(parsed.ok && parsed.data.tier).toBe("manual")
		expect(parsed.ok && parsed.data.field_sources?.needs_pains).toBe("user")
		expect(parsed.ok && parsed.data.edited_at).toBe("2026-10-18T15:02:00+08:00")
	})

	it("reads persona_build studies", async () => {
		const { parseStudyFile } = await import("../services/researchFiles")
		const parsed = parseStudyFile({
			schema_version: 1,
			title: "奶茶店老板",
			question: "帮我构建人设",
			study_type: "persona_build",
			phase: "done",
			phases: ["clarify", "plan", "desk_research", "interview", "report", "validation"].map(
				(key, index) => ({ key, status: index === 0 ? "done" : "skipped" }),
			),
		})
		expect(parsed.ok && parsed.data.study_type).toBe("persona_build")
	})
})

describe("listReportTemplates", () => {
	it("lists top-level HTML templates with the default first", () => {
		const list = [
			file("templates/brand.html"),
			file("templates/voices.html"),
			file("templates/notes.md"),
			file("templates/old/dark.html"),
			file("studies/x/report.html"),
		]
		expect(listReportTemplates(list).map((item) => item.relative_file_path)).toEqual([
			"templates/voices.html",
			"templates/brand.html",
		])
	})

	it("names a template by its file name", () => {
		expect(reportTemplateName("templates/品牌周报.html")).toBe("品牌周报")
	})
})
