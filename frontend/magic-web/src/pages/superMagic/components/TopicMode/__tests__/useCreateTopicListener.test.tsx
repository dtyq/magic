import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Topic } from "../../../pages/Workspace/types"
import { TopicMode } from "../../../pages/Workspace/TopicMode"
import SuperMagicService from "../../../services"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useCreateTopicListener } from "../useCreateTopicListener"

const { selectedTopic, latestTopic, topicStoreMock } = vi.hoisted(() => ({
	selectedTopic: {
		id: "topic-1",
		user_id: "user-1",
		chat_topic_id: "chat-topic-1",
		chat_conversation_id: "conversation-topic-1",
		topic_name: "Existing Topic",
		task_status: "finished",
		task_mode: "chat",
		project_id: "project-1",
		topic_mode: "custom_agent",
		agent_code: "employee-code-1",
		updated_at: "2026-04-08T00:00:00Z",
		workspace_id: "workspace-1",
		token_used: null,
	} as Topic,
	latestTopic: {
		id: "topic-latest",
		user_id: "user-1",
		chat_topic_id: "chat-topic-latest",
		chat_conversation_id: "conversation-topic-latest",
		topic_name: "Latest Topic",
		task_status: "finished",
		task_mode: "chat",
		project_id: "project-1",
		topic_mode: "custom_agent",
		agent_code: "employee-code-latest",
		updated_at: "2026-04-08T00:00:00Z",
		workspace_id: "workspace-1",
		token_used: null,
	} as Topic,
	topicStoreMock: {
		selectedTopic: null as Topic | null,
	},
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		subscribe: vi.fn(),
		unsubscribe: vi.fn(),
		publish: vi.fn(),
	},
	PubSubEvents: {
		Create_New_Topic: "Create_New_Topic",
		Add_Content_To_Chat: "Add_Content_To_Chat",
	},
}))

vi.mock("../../../stores/core", () => ({
	workspaceStore: {
		selectedWorkspace: { id: "workspace-1" },
	},
	projectStore: {
		selectedProject: { id: "project-1" },
	},
	topicStore: topicStoreMock,
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		createTopic: vi.fn(),
	},
}))

vi.mock("../../../services", () => ({
	default: {
		handleCreateTopic: vi.fn(),
	},
}))

describe("useCreateTopicListener", () => {
	it("uses the current topic as the source for ordinary project topic creation", () => {
		topicStoreMock.selectedTopic = selectedTopic
		renderHook(() => useCreateTopicListener())

		const handler = vi.mocked(pubsub.subscribe).mock.calls[0]?.[1] as
			| ((payload?: { topicMode?: TopicMode }) => void)
			| undefined
		expect(handler).toBeTypeOf("function")

		topicStoreMock.selectedTopic = latestTopic
		handler?.()

		expect(SuperMagicService.handleCreateTopic).toHaveBeenCalledWith({
			selectedProject: { id: "project-1" },
			sourceTopic: latestTopic,
			onNavigated: undefined,
		})
		expect(vi.mocked(pubsub.subscribe).mock.calls[0]?.[0]).toBe(PubSubEvents.Create_New_Topic)
	})

	it("uses the requested employee mode as the source when creating a topic from the mode toggle", () => {
		topicStoreMock.selectedTopic = latestTopic
		renderHook(() => useCreateTopicListener())

		const handler = vi.mocked(pubsub.subscribe).mock.calls[0]?.[1] as
			| ((payload?: { topicMode?: TopicMode }) => void)
			| undefined
		expect(handler).toBeTypeOf("function")

		handler?.({ topicMode: "SMA-employee-code-2" as TopicMode })

		expect(SuperMagicService.handleCreateTopic).toHaveBeenCalledWith({
			selectedProject: { id: "project-1" },
			sourceTopic: {
				...latestTopic,
				topic_mode: TopicMode.CustomAgent,
				agent_code: "SMA-employee-code-2",
			},
			onNavigated: undefined,
		})
	})
})
