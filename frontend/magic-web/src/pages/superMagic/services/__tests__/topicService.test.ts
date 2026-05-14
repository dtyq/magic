import { beforeEach, describe, expect, it, vi } from "vitest"
import { TopicStore } from "@/pages/superMagic/stores/core/topic"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import TopicService from "../topicService"
import { SuperMagicApi } from "@/apis"
import { interfaceStore } from "@/stores/interface"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getTopicsByProjectId: vi.fn(),
		getSidebarTopicsByProjectId: vi.fn(),
		createTopic: vi.fn(),
	},
}))

vi.mock("@/stores/interface", () => ({
	interfaceStore: {
		isMobile: false,
	},
}))

function createTopic(overrides: Partial<Topic> = {}): Topic {
	return {
		id: overrides.id ?? "topic-1",
		user_id: overrides.user_id ?? "user-1",
		chat_topic_id: overrides.chat_topic_id ?? "chat-topic-1",
		chat_conversation_id: overrides.chat_conversation_id ?? "conversation-1",
		topic_name: overrides.topic_name ?? "Topic",
		task_status: overrides.task_status ?? "finished",
		status: overrides.status ?? "finished",
		task_mode: overrides.task_mode ?? "ppt",
		project_id: overrides.project_id ?? "project-1",
		topic_mode: overrides.topic_mode ?? "ppt",
		updated_at: overrides.updated_at ?? "2026-05-12 12:34:24",
		workspace_id: overrides.workspace_id ?? "workspace-1",
		is_pinned: overrides.is_pinned ?? false,
		pinned_at: overrides.pinned_at ?? null,
		is_archived: overrides.is_archived ?? false,
		last_read_at: overrides.last_read_at ?? null,
		last_read_message_id: overrides.last_read_message_id ?? null,
		has_unread: overrides.has_unread ?? false,
		token_used: overrides.token_used ?? null,
	}
}

function createProject(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
	return {
		id: overrides.id ?? "project-1",
		project_name: overrides.project_name ?? "Project",
		workspace_id: overrides.workspace_id ?? "workspace-1",
		workspace_name: overrides.workspace_name ?? "Workspace",
		...overrides,
	} as ProjectListItem
}

describe("TopicService interface-aware topic source", () => {
	let topicService: TopicService
	let topicStore: TopicStore

	beforeEach(() => {
		vi.clearAllMocks()
		topicStore = new TopicStore()
		topicService = new TopicService({ store: topicStore })
		interfaceStore.isMobile = false
	})

	it("uses sidebar-topics for mobile fetchTopics", async () => {
		vi.mocked(SuperMagicApi.getSidebarTopicsByProjectId).mockResolvedValue({
			list: [createTopic({ id: "topic-sidebar" })],
			total: 1,
		})

		interfaceStore.isMobile = true
		await topicService.fetchTopics({ projectId: "project-1", isAutoSelect: false })

		expect(SuperMagicApi.getSidebarTopicsByProjectId).toHaveBeenCalledWith({
			id: "project-1",
			page: 1,
			page_size: 100,
			q: undefined,
		})
		expect(SuperMagicApi.getTopicsByProjectId).not.toHaveBeenCalled()
	})

	it("keeps desktop fetchTopics on the legacy project topics api", async () => {
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [createTopic({ id: "topic-desktop" })],
			total: 1,
		})

		await topicService.fetchTopics({ projectId: "project-1", isAutoSelect: false })

		expect(SuperMagicApi.getTopicsByProjectId).toHaveBeenCalledWith({
			id: "project-1",
			page: 1,
			page_size: 99,
		})
		expect(SuperMagicApi.getSidebarTopicsByProjectId).not.toHaveBeenCalled()
	})

	it("uses sidebar-topics after mobile createTopic to refresh project topics", async () => {
		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(createTopic({ id: "topic-new" }))
		vi.mocked(SuperMagicApi.getSidebarTopicsByProjectId).mockResolvedValue({
			list: [createTopic({ id: "topic-new" })],
			total: 1,
		})

		interfaceStore.isMobile = true
		await topicService.createTopic({ projectId: "project-1", topicName: "" })

		expect(SuperMagicApi.getSidebarTopicsByProjectId).toHaveBeenCalledWith({
			id: "project-1",
			page: 1,
			page_size: 100,
			q: undefined,
		})
		expect(topicStore.topics[0]?.id).toBe("topic-new")
	})

	it("uses sidebar-topics when mobile selects project topics", async () => {
		vi.mocked(SuperMagicApi.getSidebarTopicsByProjectId).mockResolvedValue({
			list: [createTopic({ id: "topic-selected" })],
			total: 1,
		})

		interfaceStore.isMobile = true
		await topicService.selectTopicWithProject(createProject(), "project-topic-map")

		expect(SuperMagicApi.getSidebarTopicsByProjectId).toHaveBeenCalledWith({
			id: "project-1",
			page: 1,
			page_size: 100,
			q: undefined,
		})
		expect(topicStore.selectedTopic?.id).toBe("topic-selected")
	})
})
