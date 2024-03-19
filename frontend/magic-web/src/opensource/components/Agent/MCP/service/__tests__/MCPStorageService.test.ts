import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMCPFromProject, saveMCPFromProject } = vi.hoisted(() => ({
	getMCPFromProject: vi.fn(),
	saveMCPFromProject: vi.fn(),
}))

vi.mock("@/apis", async (importOriginal) => {
	return {
		ContactApi: {},
		FlowApi: {
			getMCPFromProject,
			saveMCPFromProject,
		},
	}
})

import { MCPStorageService, ProjectStorage } from "../MCPStorageService"

describe("MCPStorageService", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("uses template project id when storage key is omitted", async () => {
		getMCPFromProject.mockResolvedValue({
			servers: [{ id: "template-mcp", name: "Template MCP" }],
		})

		const storage = new MCPStorageService(new ProjectStorage())

		await expect(storage.hasMCP()).resolves.toBe(true)
		await storage.saveMCP([{ id: "template-mcp" }])

		expect(getMCPFromProject).toHaveBeenCalledWith("__template_project_id__")
		expect(saveMCPFromProject).toHaveBeenCalledWith("__template_project_id__", [
			{ id: "template-mcp" },
		])
	})
})
