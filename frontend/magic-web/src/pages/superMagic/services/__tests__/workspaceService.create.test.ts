import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"

const trackMock = vi.hoisted(() => vi.fn())
vi.mock("@/apis", () => ({ SuperMagicApi: { createWorkspace: vi.fn() } }))
vi.mock("@/services/analytics", () => ({ analyticsService: { report: trackMock } }))
vi.mock("@/pages/superMagic/stores/core/workspace", () => ({
	default: {
		beginWorkspaceListFetch: vi.fn(),
		endWorkspaceListFetch: vi.fn(),
		setWorkspaces: vi.fn(),
		setSelectedWorkspace: vi.fn(),
		updateWorkspace: vi.fn(),
		getWorkspaceById: vi.fn(),
	},
}))
vi.mock("@/pages/superMagic/stores/core/project", () => ({
	default: { selectedProject: null, setSelectedProject: vi.fn() },
}))
vi.mock("@/pages/superMagic/services/orderUtils", () => ({
	getInsertIndexByAnchors: vi.fn(),
	isSameOrder: vi.fn(),
}))
vi.mock("@/pages/superMagic/services/orderErrorReporter", () => ({
	createOrderRequestOptions: vi.fn(),
	reportOrderApiError: vi.fn(),
}))
vi.mock("@/pages/superMagic/services/workspaceListSearchInvalidation", () => ({
	invalidateWorkspaceSearchResults: vi.fn(),
}))

import WorkspaceService from "../workspaceService"

describe("WorkspaceService attempt analytics", () => {
	beforeEach(() => vi.clearAllMocks())

	it("reports before a failed request", async () => {
		vi.mocked(SuperMagicApi.createWorkspace).mockRejectedValue(new Error("create-failed"))
		await expect(new WorkspaceService().createWorkspace("New")).rejects.toThrow("create-failed")
		expect(trackMock).toHaveBeenCalledWith("workspace_create_attempted")
	})
})
