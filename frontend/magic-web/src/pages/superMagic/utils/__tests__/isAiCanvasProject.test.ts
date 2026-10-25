import { describe, expect, it } from "vitest"
import { TopicMode } from "../../pages/Workspace/TopicMode"
import { hasAiCanvasDefaultName, isAiCanvasProject } from "../isAiCanvasProject"

const canvasProject = (project_name: string) => ({ project_mode: TopicMode.AiCanvas, project_name })

describe("isAiCanvasProject", () => {
	it("matches only AI canvas projects", () => {
		expect(isAiCanvasProject({ project_mode: TopicMode.AiCanvas })).toBe(true)
		expect(isAiCanvasProject({ project_mode: TopicMode.General })).toBe(false)
		expect(isAiCanvasProject(null)).toBe(false)
	})
})

describe("hasAiCanvasDefaultName", () => {
	it("treats empty and default names in any shipped language as unnamed", () => {
		expect(hasAiCanvasDefaultName(canvasProject(""))).toBe(true)
		expect(hasAiCanvasDefaultName(canvasProject("未命名画布"))).toBe(true)
		expect(hasAiCanvasDefaultName(canvasProject(" Untitled canvas "))).toBe(true)
	})

	it("keeps names someone already gave", () => {
		expect(hasAiCanvasDefaultName(canvasProject("夏季海报"))).toBe(false)
	})

	it("ignores other projects even with the same name", () => {
		expect(
			hasAiCanvasDefaultName({ project_mode: TopicMode.General, project_name: "未命名画布" }),
		).toBe(false)
	})
})
