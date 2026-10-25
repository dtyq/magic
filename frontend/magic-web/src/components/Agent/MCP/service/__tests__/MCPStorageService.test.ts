import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMCPFromProject, getUserStorage, saveMCPFromProject, saveUserStorage } = vi.hoisted(
	() => ({
		getMCPFromProject: vi.fn(),
		getUserStorage: vi.fn(),
		saveMCPFromProject: vi.fn(),
		saveUserStorage: vi.fn(),
	}),
)

vi.mock("@/apis", () => {
	return {
		ContactApi: {
			getUserStorage,
			saveUserStorage,
		},
		FlowApi: {
			getMCPFromProject,
			saveMCPFromProject,
		},
	}
})

import { MCPStorageService, ProjectStorage, UserGlobalStorage } from "../MCPStorageService"

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

	it("propagates project load failures instead of treating them as empty settings", async () => {
		const requestError = new Error("request failed")
		getMCPFromProject.mockRejectedValue(requestError)
		const storage = new MCPStorageService(new ProjectStorage("project-id"))

		await expect(storage.getMCP()).rejects.toBe(requestError)
	})

	it("propagates user storage load failures instead of treating them as empty settings", async () => {
		const requestError = new Error("request failed")
		getUserStorage.mockRejectedValue(requestError)
		const storage = new MCPStorageService(new UserGlobalStorage())

		await expect(storage.getMCP()).rejects.toBe(requestError)
	})
})
