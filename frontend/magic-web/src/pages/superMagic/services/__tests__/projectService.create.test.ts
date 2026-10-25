import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

const trackMock = vi.hoisted(() => vi.fn())
const { mockProjectStore, mockRecentProjectsStore } = vi.hoisted(() => ({
	mockProjectStore: {
		projects: [] as ProjectListItem[],
		setProjects: vi.fn(),
		setProjectsForWorkspace: vi.fn(),
	},
	mockRecentProjectsStore: { invalidate: vi.fn(), items: [] as ProjectListItem[] },
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		createProject: vi.fn(),
		getProjects: vi.fn(),
		getProjectsWithCollaboration: vi.fn(),
		getCollaborationProjects: vi.fn(),
	},
}))
vi.mock("@/services/analytics", () => ({ analyticsService: { report: trackMock } }))
vi.mock("@/pages/superMagic/stores/core/project", () => ({ default: mockProjectStore }))
vi.mock("@/pages/superMagic/stores/core/recentProjects", () => ({
	default: mockRecentProjectsStore,
}))
vi.mock("@/pages/superMagic/stores/core", () => ({
	workspaceStore: { workspaces: [], setSelectedWorkspace: vi.fn() },
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
vi.mock("@/utils/clipboard-helpers", () => ({ clipboard: { writeText: vi.fn() } }))
vi.mock("@/pages/superMagic/constants", () => ({
	SHARE_WORKSPACE_ID: "share",
	isOtherCollaborationProject: vi.fn(() => false),
}))
vi.mock("@/pages/superMagic/utils/project", () => ({ generateCollaborationProjectUrl: vi.fn() }))
vi.mock("@/models/user", () => ({ userStore: { user: { userInfo: { user_id: "user-1" } } } }))

import ProjectService from "../projectService"

describe("ProjectService creation attempt analytics", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockProjectStore.projects = []
	})

	it("reports request context before a failed create", async () => {
		vi.mocked(SuperMagicApi.createProject).mockRejectedValue(new Error("create-failed"))
		await expect(
			new ProjectService().createProject({
				workspaceId: "workspace-1",
				projectMode: TopicMode.General,
				creationScene: "chat",
			}),
		).resolves.toBeNull()
		expect(trackMock).toHaveBeenCalledWith("project_create_attempted", {
			workspaceId: "workspace-1",
			sceneOverride: "chat",
			mode: TopicMode.General,
		})
	})
})
