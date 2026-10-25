import { describe, expect, it } from "vitest"
import { createResearchFileDisplayResolver } from "../services/researchFileDisplay"

const resolve = createResearchFileDisplayResolver(
	{
		personas: "人设",
		panels: "人设分组",
		studies: "研究",
		templates: "报告模板",
		defaultTemplate: "人声（默认）",
		interviews: "访谈记录",
		discussions: "小组讨论",
		study: {
			report: "研究报告",
			plan: "研究方案",
			deskResearch: "市场洞察",
			validation: "验证问卷",
			panel: "受访者名单",
		},
	},
	{
		studies: "studies-icon",
		study: "study-icon",
		interviews: "interviews-icon",
		persona: "persona-icon",
		studyFiles: { report: "report-icon" },
	},
	{
		personaName: (path) => (path === "personas/p_a.json" ? "王浩" : undefined),
		interviewLabel: (path) =>
			path === "studies/x/interviews/p_a.json" ? "王浩 · 访谈记录" : undefined,
		studyTitle: (path) => (path === "studies/x" ? "AI 录音硬件" : undefined),
	},
)

const dir = (path: string) =>
	resolve({ path, name: path.replace(/\/$/, "").split("/").pop() ?? "", isDirectory: true })
const file = (path: string) =>
	resolve({ path, name: path.split("/").pop() ?? "", isDirectory: false })

describe("createResearchFileDisplayResolver", () => {
	it("names the research folders and attaches icons", () => {
		expect(dir("personas")).toMatchObject({ name: "人设" })
		expect(dir("panels/")).toMatchObject({ name: "人设分组" })
		expect(dir("studies")).toEqual({ name: "研究", icon: "studies-icon" })
		expect(dir("templates")).toMatchObject({ name: "报告模板" })
	})

	it("hides template conversation markers and everything below them", () => {
		expect(dir("template-chats")).toEqual({ hidden: true })
		expect(file("template-chats/971.json")).toEqual({ hidden: true })
	})

	it("leaves unknown folders alone", () => {
		expect(dir("study-topics")).toBeNull()
		expect(dir("docs")).toBeNull()
		expect(dir("docs/personas")).toBeNull()
	})

	it("names templates, the default one by its Chinese name", () => {
		expect(file("templates/voices.html")).toEqual({ name: "人声（默认）" })
		expect(file("templates/kids-doodle.html")).toEqual({ name: "kids-doodle" })
		expect(file("templates/notes.txt")).toBeNull()
	})

	it("names a study folder by its title once known, else keeps the slug", () => {
		expect(dir("studies/x")).toMatchObject({ name: "AI 录音硬件" })
		expect(dir("studies/y")).toBeNull()
	})

	it("gives study folders and files their own icons, leaving unlisted ones to the default", () => {
		expect(dir("studies/x")).toEqual({ name: "AI 录音硬件", icon: "study-icon" })
		expect(dir("studies/x/interviews")).toMatchObject({ icon: "interviews-icon" })
		expect(file("studies/x/report.html")).toMatchObject({
			name: "研究报告",
			icon: "report-icon",
		})
		expect(file("studies/x/plan.md")?.icon).toBeUndefined()
		expect(file("personas/p_a.json")).toMatchObject({ name: "王浩", icon: "persona-icon" })
	})

	it("names study files and sub folders only directly under studies/<slug>/", () => {
		expect(file("studies/x/report.html")).toMatchObject({ name: "研究报告" })
		expect(file("studies/x/plan.md")).toMatchObject({ name: "研究方案" })
		expect(file("studies/x/desk-research.md")).toMatchObject({ name: "市场洞察" })
		expect(file("studies/x/panel.json")).toMatchObject({ name: "受访者名单" })
		expect(dir("studies/x/interviews")).toMatchObject({ name: "访谈记录" })
		expect(dir("studies/x/discussions")).toMatchObject({ name: "小组讨论" })
		expect(file("studies/x/interviews/report.html")).toBeNull()
		expect(file("studies/x/study.json")).toBeNull()
	})

	it("shows persona and interview names once parsed, otherwise the file name", () => {
		expect(file("personas/p_a.json")).toMatchObject({ name: "王浩" })
		expect(file("personas/p_b.json")).toBeNull()
		expect(file("studies/x/interviews/p_a.json")).toMatchObject({ name: "王浩 · 访谈记录" })
		expect(file("studies/x/interviews/p_b.json")).toBeNull()
		expect(file("docs/personas/p_a.json")).toBeNull()
	})

	it("never touches a normal project", () => {
		expect(file("docs/report.html")).toBeNull()
		expect(file("report.html")).toBeNull()
	})
})
