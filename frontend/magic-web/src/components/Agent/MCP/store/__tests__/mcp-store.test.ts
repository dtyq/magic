import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMCPFromProject, saveMCPFromProject } = vi.hoisted(() => ({
	getMCPFromProject: vi.fn(),
	saveMCPFromProject: vi.fn(),
}))

vi.mock("@/apis", () => ({
	ContactApi: {},
	FlowApi: {
		getMCPFromProject,
		saveMCPFromProject,
	},
}))

import { defaultMCPStore } from "../mcp-store"

describe("defaultMCPStore", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		defaultMCPStore.mcpList = []
		defaultMCPStore.loading = false
		defaultMCPStore.initialized = false
	})

	it("loads MCP list from template project storage", async () => {
		getMCPFromProject.mockResolvedValue({
			servers: [{ id: "template-mcp", name: "Template MCP" }],
		})

		await defaultMCPStore.load()

		expect(getMCPFromProject).toHaveBeenCalledWith("__template_project_id__")
		expect(defaultMCPStore.hasMCP).toBe(true)
		expect(defaultMCPStore.initialized).toBe(true)
	})

	it("saves MCP ids through template project storage", async () => {
		getMCPFromProject.mockResolvedValue({
			servers: [{ id: "template-mcp", name: "Template MCP" }],
		})

		await defaultMCPStore.save({
			selectedIds: new Set(["template-mcp"]),
		})

		expect(saveMCPFromProject).toHaveBeenCalledWith("__template_project_id__", [
			{ id: "template-mcp" },
		])
		expect(defaultMCPStore.hasMCP).toBe(true)
	})

	it("removes MCP from shared store", async () => {
		getMCPFromProject.mockResolvedValueOnce({
			servers: [{ id: "template-mcp", name: "Template MCP" }],
		})
		await defaultMCPStore.load()

		getMCPFromProject.mockResolvedValueOnce({
			servers: [],
		})
		await defaultMCPStore.remove("template-mcp")

		expect(saveMCPFromProject).toHaveBeenCalledWith("__template_project_id__", [])
		expect(defaultMCPStore.hasMCP).toBe(false)
	})
})
