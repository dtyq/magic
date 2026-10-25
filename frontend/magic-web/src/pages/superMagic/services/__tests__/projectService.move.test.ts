import { assertProjectDeletionAllowed } from "@/services/recordSummary/projectDeletionRecordingGuard"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

const { mockWorkspaces, mockProjectStore } = vi.hoisted(() => ({
	mockWorkspaces: [{ id: "workspace-target", name: "Target Workspace" }],
	mockProjectStore: {
		projects: [] as ProjectListItem[],
		removeProject: vi.fn(),
		removeProjectFromCollections: vi.fn(),
		selectedProject: null as ProjectListItem | null,
		setSelectedProject: vi.fn(),
		setProjects: vi.fn(),
		setProjectsForWorkspace: vi.fn(),
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		moveProjectToNewWorkspace: vi.fn(),
		deleteProject: vi.fn(),
		getProjects: vi.fn(),
		getProjectsWithCollaboration: vi.fn(),
	},
}))

vi.mock("@/services/analytics", () => ({
	analyticsService: { report: vi.fn() },
}))

vi.mock("@/pages/superMagic/stores/core/project", () => ({
	default: mockProjectStore,
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	workspaceStore: {
		workspaces: mockWorkspaces,
		setSelectedWorkspace: vi.fn(),
	},
	topicStore: {},
}))

vi.mock("@/pages/superMagic/hooks/useChatWorkspace", () => ({
	ensureChatWorkspaceId: vi.fn(),
	getCachedChatWorkspaceId: vi.fn(),
}))

vi.mock("../chatConversationNameSync", () => ({
	shouldSyncChatConversationName: vi.fn(),
	syncChatConversationName: vi.fn(),
}))

vi.mock("@/utils/clipboard-helpers", () => ({
	clipboard: { writeText: vi.fn() },
}))

vi.mock("@/pages/superMagic/constants", () => ({
	SHARE_WORKSPACE_ID: "share",
	isOtherCollaborationProject: vi.fn(() => false),
}))

vi.mock("@/pages/superMagic/utils/project", () => ({
	generateCollaborationProjectUrl: vi.fn(),
}))

import ProjectService from "../projectService"

describe("ProjectService project operations", () => {
	it("blocks recording deletion before optimistic removal and the server request", async () => {
		const error = new Error("unfinished recording")
		vi.mocked(assertProjectDeletionAllowed).mockImplementationOnce(() => {
			throw error
		})
		await expect(projectService.deleteProject("project-1", "workspace-source")).rejects.toBe(
			error,
		)
		expect(mockProjectStore.removeProject).not.toHaveBeenCalled()
		expect(SuperMagicApi.deleteProject).not.toHaveBeenCalled()
	})
	let projectService: ProjectService

	beforeEach(() => {
		vi.clearAllMocks()
		mockProjectStore.setProjects.mockImplementation((projects: ProjectListItem[]) => {
			mockProjectStore.projects = projects
		})
		projectService = new ProjectService()
		mockProjectStore.projects = [
			{
				id: "project-1",
				project_name: "Source Project",
				workspace_id: "workspace-source",
				workspace_name: "Source Workspace",
			} as ProjectListItem,
		]
		vi.mocked(SuperMagicApi.moveProjectToNewWorkspace).mockResolvedValue(true as never)
		vi.mocked(SuperMagicApi.getProjects).mockResolvedValue({ list: [], total: 0 } as never)
		vi.mocked(SuperMagicApi.getProjectsWithCollaboration).mockResolvedValue({
			list: [],
			total: 0,
		} as never)
	})

	it("sends target_project_name when save-as-project name is provided", async () => {
		await projectService.moveProject({
			projectId: "project-1",
			targetWorkspaceId: "workspace-target",
			sourceWorkspaceId: "workspace-source",
			targetProjectName: " 新项目名称 ",
		})

		expect(SuperMagicApi.moveProjectToNewWorkspace).toHaveBeenCalledWith({
			source_project_id: "project-1",
			target_workspace_id: "workspace-target",
			target_workspace_name: "Target Workspace",
			target_project_name: "新项目名称",
			pre_project_id: undefined,
			next_project_id: undefined,
		})
	})

	it("does not put project name into target_workspace_name", async () => {
		await projectService.moveProject({
			projectId: "project-1",
			targetWorkspaceId: "workspace-target",
			sourceWorkspaceId: "workspace-source",
			targetProjectName: "My Save As Name",
		})

		const payload = vi.mocked(SuperMagicApi.moveProjectToNewWorkspace).mock.calls[0]?.[0]
		expect(payload?.target_workspace_name).toBe("Target Workspace")
		expect(payload?.target_workspace_name).not.toBe("My Save As Name")
		expect(payload?.target_project_name).toBe("My Save As Name")
	})

	it("omits target_project_name for plain move without rename", async () => {
		await projectService.moveProject({
			projectId: "project-1",
			targetWorkspaceId: "workspace-target",
			sourceWorkspaceId: "workspace-source",
		})

		expect(SuperMagicApi.moveProjectToNewWorkspace).toHaveBeenCalledWith({
			source_project_id: "project-1",
			target_workspace_id: "workspace-target",
			target_workspace_name: "Target Workspace",
			target_project_name: undefined,
			pre_project_id: undefined,
			next_project_id: undefined,
		})
	})

	it("optimistically removes project from store before API resolves", async () => {
		mockProjectStore.removeProjectFromCollections.mockClear()
		await projectService.moveProject({
			projectId: "project-1",
			targetWorkspaceId: "workspace-target",
			sourceWorkspaceId: "workspace-source",
		})

		expect(mockProjectStore.removeProjectFromCollections).toHaveBeenCalledWith("project-1")
	})

	it("does not switch selectedWorkspace when the moved project is not currently selected", async () => {
		const { workspaceStore } = await import("@/pages/superMagic/stores/core")
		mockProjectStore.selectedProject = null

		await projectService.moveProject({
			projectId: "project-1",
			targetWorkspaceId: "workspace-target",
			sourceWorkspaceId: "workspace-source",
		})

		expect(workspaceStore.setSelectedWorkspace).not.toHaveBeenCalled()
	})

	// Navigation/view code owns selectedWorkspace. A list-page move must not
	// steal the current workspace just because the moved project is still selected.
	it("does not switch selectedWorkspace even when the moved project is selected", async () => {
		const { workspaceStore } = await import("@/pages/superMagic/stores/core")
		mockProjectStore.selectedProject = {
			id: "project-1",
			project_name: "Source Project",
			workspace_id: "workspace-source",
			workspace_name: "Source Workspace",
		} as ProjectListItem

		await projectService.moveProject({
			projectId: "project-1",
			targetWorkspaceId: "workspace-target",
			sourceWorkspaceId: "workspace-source",
		})

		expect(workspaceStore.setSelectedWorkspace).not.toHaveBeenCalled()
	})
})

vi.mock("@/services/recordSummary/projectDeletionRecordingGuard", () => ({
	assertProjectDeletionAllowed: vi.fn(),
}))
