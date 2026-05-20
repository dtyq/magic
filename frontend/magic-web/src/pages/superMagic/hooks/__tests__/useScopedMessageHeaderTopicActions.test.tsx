import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import type { ProjectListItem, Topic } from "../../pages/Workspace/types"
import { TaskStatus } from "../../pages/Workspace/types"
import { TopicMode } from "../../pages/Workspace/TopicMode"
import { useScopedMessageHeaderTopicActions } from "../useScopedMessageHeaderTopicActions"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		createTopic: vi.fn(),
		getTopicsByProjectId: vi.fn(),
		editTopic: vi.fn(),
		deleteTopic: vi.fn(),
	},
}))

function createTopic(id: string, topicName: string): Topic {
	return {
		id,
		user_id: "user-1",
		chat_topic_id: `chat-${id}`,
		chat_conversation_id: `conversation-${id}`,
		topic_name: topicName,
		task_status: TaskStatus.FINISHED,
		task_mode: "chat",
		project_id: "project-1",
		topic_mode: TopicMode.General,
		updated_at: "2026-04-08T00:00:00Z",
		workspace_id: "workspace-1",
		token_used: null,
	}
}

describe("useScopedMessageHeaderTopicActions", () => {
	it("refreshes topics from server after creating a topic", async () => {
		const existingTopic = createTopic("topic-1", "Existing Topic")
		const newTopic = createTopic("topic-2", "New Topic")
		const selectedProject = {
			id: "project-1",
		} as ProjectListItem
		const setTopics = vi.fn()
		const setSelectedTopic = vi.fn()
		const topicStore = {
			topics: [existingTopic],
			setTopics,
			setSelectedTopic,
			updateTopicName: vi.fn(),
			removeTopic: vi.fn(),
		}

		vi.mocked(SuperMagicApi.createTopic).mockResolvedValue(newTopic)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({
			list: [newTopic, existingTopic],
			total: 2,
		})

		const { result } = renderHook(() =>
			useScopedMessageHeaderTopicActions({
				selectedProject,
				selectedTopic: existingTopic,
				topicStore: topicStore as never,
			}),
		)

		await result.current.createTopic()

		expect(SuperMagicApi.createTopic).toHaveBeenCalledWith({
			project_id: "project-1",
			topic_name: "",
		})
		expect(SuperMagicApi.getTopicsByProjectId).toHaveBeenCalledWith({
			id: "project-1",
			page: 1,
			page_size: 999,
		})
		expect(setTopics).toHaveBeenCalledWith([newTopic, existingTopic])
		expect(setSelectedTopic).toHaveBeenCalledWith(newTopic)
	})
})
