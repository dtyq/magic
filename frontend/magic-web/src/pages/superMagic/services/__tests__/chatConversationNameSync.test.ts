import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import { projectStore, topicStore } from "@/pages/superMagic/stores/core"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import {
	renameTopicWithChatSync,
	shouldSyncChatConversationName,
	syncChatConversationName,
	syncChatProjectNameOnly,
} from "../chatConversationNameSync"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		editProject: vi.fn(),
		editTopic: vi.fn(),
		getTopicsByProjectId: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/hooks/useChatWorkspace", () => ({
	getCachedChatWorkspaceId: vi.fn(() => "chat-workspace-1"),
}))

function createProject(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
	return {
		id: overrides.id ?? "project-1",
		project_name: overrides.project_name ?? "Old Project",
		workspace_id: overrides.workspace_id ?? "chat-workspace-1",
		workspace_name: overrides.workspace_name ?? "Chat",
	} as ProjectListItem
}

function createTopic(overrides: Partial<Topic> = {}): Topic {
	return {
		id: overrides.id ?? "topic-1",
		project_id: overrides.project_id ?? "project-1",
		topic_name: overrides.topic_name ?? "Old Topic",
		user_id: "user-1",
		chat_topic_id: "chat-topic-1",
		chat_conversation_id: "conversation-1",
		task_status: "finished",
		status: "finished",
		task_mode: "general",
		topic_mode: "general",
		updated_at: "2026-05-12 12:00:00",
		workspace_id: "chat-workspace-1",
		is_pinned: false,
		pinned_at: null,
		is_archived: false,
		last_read_at: null,
		last_read_message_id: null,
		has_unread: false,
		token_used: null,
	}
}

describe("chatConversationNameSync", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		projectStore.setProjects([createProject()])
		projectStore.setSelectedProject(createProject())
		topicStore.setTopics([createTopic()])
		topicStore.setSelectedTopic(createTopic())
	})

	it("shouldSyncChatConversationName returns true for chat workspace projects", () => {
		expect(shouldSyncChatConversationName(createProject())).toBe(true)
		expect(shouldSyncChatConversationName(createProject({ workspace_id: "other" }))).toBe(false)
	})

	it("syncChatConversationName calls both editProject and editTopic", async () => {
		vi.mocked(SuperMagicApi.editProject).mockResolvedValue({} as never)
		vi.mocked(SuperMagicApi.editTopic).mockResolvedValue({} as never)

		await syncChatConversationName({
			projectId: "project-1",
			topicId: "topic-1",
			name: "  Unified Name  ",
			workspaceId: "chat-workspace-1",
		})

		expect(SuperMagicApi.editProject).toHaveBeenCalledWith({
			id: "project-1",
			project_name: "Unified Name",
			project_description: "",
		})
		expect(SuperMagicApi.editTopic).toHaveBeenCalledWith({
			id: "topic-1",
			topic_name: "Unified Name",
			project_id: "project-1",
		})
		expect(projectStore.selectedProject?.project_name).toBe("Unified Name")
		expect(topicStore.selectedTopic?.topic_name).toBe("Unified Name")
	})

	it("renameTopicWithChatSync dual-writes for chat projects", async () => {
		vi.mocked(SuperMagicApi.editProject).mockResolvedValue({} as never)
		vi.mocked(SuperMagicApi.editTopic).mockResolvedValue({} as never)

		await renameTopicWithChatSync({
			project: createProject(),
			topicId: "topic-1",
			topicName: "New Chat Title",
		})

		expect(SuperMagicApi.editProject).toHaveBeenCalled()
		expect(SuperMagicApi.editTopic).toHaveBeenCalled()
	})

	it("renameTopicWithChatSync only edits topic for non-chat projects", async () => {
		vi.mocked(SuperMagicApi.editTopic).mockResolvedValue({} as never)

		await renameTopicWithChatSync({
			project: createProject({ workspace_id: "workspace-default" }),
			topicId: "topic-1",
			topicName: "Topic Only",
		})

		expect(SuperMagicApi.editProject).not.toHaveBeenCalled()
		expect(SuperMagicApi.editTopic).toHaveBeenCalledWith({
			id: "topic-1",
			topic_name: "Topic Only",
			project_id: "project-1",
		})
	})

	it("resolveChatTopicId prefers selectedTopic for the same project", async () => {
		topicStore.setSelectedTopic(createTopic({ id: "topic-selected", project_id: "project-1" }))
		topicStore.setTopics([])

		const topicId = await import("../chatConversationNameSync").then((mod) =>
			mod.resolveChatTopicId("project-1"),
		)

		expect(topicId).toBe("topic-selected")
	})

	it("syncChatProjectNameOnly updates project without touching topic API", async () => {
		vi.mocked(SuperMagicApi.editProject).mockResolvedValue({} as never)

		await syncChatProjectNameOnly({
			projectId: "project-1",
			name: "Smart Project Title",
		})

		expect(SuperMagicApi.editProject).toHaveBeenCalledWith({
			id: "project-1",
			project_name: "Smart Project Title",
			project_description: "",
		})
		expect(SuperMagicApi.editTopic).not.toHaveBeenCalled()
		expect(projectStore.selectedProject?.project_name).toBe("Smart Project Title")
	})
})
