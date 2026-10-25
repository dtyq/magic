import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Topic } from "../../../pages/Workspace/types"
import { TopicMode } from "../../../pages/Workspace/TopicMode"
import SuperMagicService from "../../../services"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useCreateTopicListener } from "../useCreateTopicListener"

const { selectedTopic, latestTopic, topicStoreMock, mockTopicServiceCreateTopic } = vi.hoisted(
	() => ({
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
		mockTopicServiceCreateTopic: vi.fn(),
	}),
)

const defaultSelectionState = vi.hoisted(() => ({
	selection: {
		modeIdentifier: "general" as TopicMode,
		topicPattern: "general" as TopicMode,
		agentCode: undefined as string | undefined,
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
		Send_Message_by_Content: "Send_Message_by_Content",
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

vi.mock("../../../services/topicService", () => ({
	default: vi.fn().mockImplementation(() => ({
		createTopic: mockTopicServiceCreateTopic,
	})),
}))

vi.mock("@/services/superMagic/DefaultAgentSelectionService", () => ({
	resolveDefaultAgentSelection: () => defaultSelectionState.selection,
}))

describe("useCreateTopicListener", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		defaultSelectionState.selection = {
			modeIdentifier: TopicMode.General,
			topicPattern: TopicMode.General,
			agentCode: undefined,
		}
		topicStoreMock.selectedTopic = null
		mockTopicServiceCreateTopic.mockResolvedValue({ ...latestTopic, id: "topic-new" })
	})

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

	it("uses a configured non-SMA default employee as plain topic_mode", () => {
		defaultSelectionState.selection = {
			modeIdentifier: "configured-agent",
			topicPattern: "configured-agent" as TopicMode,
			agentCode: undefined,
		}
		topicStoreMock.selectedTopic = latestTopic
		renderHook(() => useCreateTopicListener())

		const handler = vi.mocked(pubsub.subscribe).mock.calls[0]?.[1] as
			| ((payload?: { topicMode?: TopicMode }) => void)
			| undefined
		handler?.({ topicMode: "configured-agent" as TopicMode })

		expect(SuperMagicService.handleCreateTopic).toHaveBeenCalledWith({
			selectedProject: { id: "project-1" },
			sourceTopic: {
				...latestTopic,
				topic_mode: "configured-agent",
				agent_code: undefined,
			},
			onNavigated: undefined,
		})
	})

	it("sends after-create content through the existing send-message pubsub event", () => {
		topicStoreMock.selectedTopic = latestTopic
		renderHook(() => useCreateTopicListener())

		const handler = vi.mocked(pubsub.subscribe).mock.calls[0]?.[1] as
			| ((payload?: {
					topicMode?: TopicMode
					afterCreate?: {
						content: { type: string; content: any[] }
						send?: boolean
						mentionItems?: any[]
						extra?: Record<string, unknown>
					}
			  }) => void)
			| undefined
		expect(handler).toBeTypeOf("function")

		const content = { type: "doc", content: [] }
		const mentionItems = [{ attrs: { type: "project_directory" } }]
		const extra = { super_agent: { enable_web_search: true } }
		handler?.({
			topicMode: "ip-manager" as TopicMode,
			afterCreate: {
				content,
				send: true,
				mentionItems,
				extra,
			},
		})

		const createParams = vi.mocked(SuperMagicService.handleCreateTopic).mock.calls[0]?.[0]
		expect(createParams).toEqual(
			expect.objectContaining({
				selectedProject: { id: "project-1" },
				sourceTopic: expect.objectContaining({
					project_id: "project-1",
					topic_mode: "ip-manager",
				}),
			}),
		)

		createParams?.onNavigated?.({ ...latestTopic, id: "topic-new" })

		expect(pubsub.publish).toHaveBeenCalledWith(PubSubEvents.Send_Message_by_Content, {
			jsonContent: content,
			mentionItems,
			topicMode: "ip-manager",
			extra,
		})
		expect(pubsub.publish).not.toHaveBeenCalledWith(
			PubSubEvents.Add_Content_To_Chat,
			expect.anything(),
		)
	})

	it("applies requested mode when creating topics through a scoped topic store", async () => {
		topicStoreMock.selectedTopic = latestTopic
		renderHook(() => useCreateTopicListener({ topicStore: topicStoreMock as any }))

		const handler = vi.mocked(pubsub.subscribe).mock.calls[0]?.[1] as
			| ((payload?: { topicMode?: TopicMode }) => void)
			| undefined
		expect(handler).toBeTypeOf("function")

		handler?.({ topicMode: "ip-manager" as TopicMode })

		await waitFor(() => {
			expect(mockTopicServiceCreateTopic).toHaveBeenCalledWith({
				projectId: "project-1",
				topicName: "",
				sourceTopic: {
					...latestTopic,
					topic_mode: "ip-manager",
					agent_code: undefined,
				},
			})
		})
	})

	it("targets the newly created scoped topic when sending after creation", async () => {
		renderHook(() => useCreateTopicListener({ topicStore: topicStoreMock as any }))

		const handler = vi.mocked(pubsub.subscribe).mock.calls[0]?.[1] as
			| ((payload?: {
					topicMode?: TopicMode
					afterCreate?: { content: { type: string; content: any[] }; send?: boolean }
			  }) => void)
			| undefined
		const content = { type: "doc", content: [] }
		handler?.({ afterCreate: { content, send: true } })

		await waitFor(() => {
			expect(pubsub.publish).toHaveBeenCalledWith(PubSubEvents.Send_Message_by_Content, {
				jsonContent: content,
				topicMode: undefined,
				selectedModel: undefined,
				selectedImageModel: undefined,
				selectedVideoModel: undefined,
				shouldClearEditorAfterSend: undefined,
				extra: undefined,
				targetTopic: expect.objectContaining({ id: "topic-new" }),
			})
		})
	})
})
