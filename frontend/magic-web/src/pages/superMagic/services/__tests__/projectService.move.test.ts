import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

const { mockWorkspaces, mockProjectStore } = vi.hoisted(() => ({
	mockWorkspaces: [{ id: "workspace-target", name: "Target Workspace" }],
	mockProjectStore: {
		projects: [] as ProjectListItem[],
		removeProject: vi.fn(),
		setProjects: vi.fn(),
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		moveProjectToNewWorkspace: vi.fn(),
		getProjects: vi.fn(),
		getProjectsWithCollaboration: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/stores/core/project", () => ({
	default: mockProjectStore,
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	workspaceStore: {
		workspaces: mockWorkspaces,
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

describe("ProjectService.moveProject", () => {
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
		})
	})

	it("optimistically removes project from store before API resolves", async () => {
		mockProjectStore.removeProject.mockClear()
		await projectService.moveProject({
			projectId: "project-1",
			targetWorkspaceId: "workspace-target",
			sourceWorkspaceId: "workspace-source",
		})

		expect(mockProjectStore.removeProject).toHaveBeenCalledWith("project-1")
	})
})
