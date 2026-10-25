import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { createMessageSendService } from "@/pages/superMagic/services/messageSendFlowService"
import {
	registerConversationTopicModeOverride,
	resetConversationTopicModeOverridesForTests,
} from "@/pages/superMagic/services/conversationTopicModeOverride"

const { track, toastError } = vi.hoisted(() => ({ track: vi.fn(), toastError: vi.fn() }))

// This unit owns outbound request construction only; isolate UI/router/store singletons so the
// assertion exercises MessageSendService's real option merge without unrelated application boot.
vi.mock("@/components/base/MagicToaster/utils", () => ({ default: { error: toastError } }))

vi.mock("i18next", () => ({ default: { t: (key: string) => key } }))

vi.mock("@/apis", () => ({ ChatApi: {}, SuperMagicApi: {} }))

vi.mock("@/models/user", () => ({
	userStore: { user: { userInfo: { user_id: "default-user" } } },
}))

vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: {
		messages: new Map(),
		getLatestMessageAnchor: vi.fn(() => ({})),
		addUserMessage: vi.fn(),
		replaceUserMessage: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/stores/optimisticMessageStore", () => ({
	optimisticMessageStore: {
		markSending: vi.fn(),
		markFailed: vi.fn(),
		confirm: vi.fn(),
		clearActiveRevokedAnchor: vi.fn(),
	},
}))

vi.mock("@/components/business/MentionPanel/builtin-store", () => ({
	default: { addMentionListItemsToHistory: vi.fn() },
}))

vi.mock("@/pages/superMagic/components/MessageEditor/utils", () => ({
	buildPlainTextJSONContent: (text: string) => ({
		type: "doc",
		content: [{ type: "paragraph", content: [{ type: "text", text }] }],
	}),
	generateTextFromJSONContent: () => "hello",
	isEmptyJSONContent: () => false,
}))

vi.mock("@/pages/superMagic/components/MessageEditor/utils/mention", () => ({
	transformMentions: (mentions: unknown[]) => mentions,
}))

vi.mock("@/pages/superMagic/components/MessageEditor/services/InternetSearchManager", () => ({
	DEFAULT_KEY: "default",
	internetSearchManager: {
		getIsChecked: vi.fn(() => true),
		setIsChecked: vi.fn(),
	},
}))

vi.mock("@/infrastructure/logger", () => ({
	logger: { createLogger: () => ({ error: vi.fn() }) },
}))

vi.mock("@/utils/pubsub", () => ({
	default: { publish: vi.fn() },
	PubSubEvents: { Refresh_Topic_Messages: "Refresh_Topic_Messages" },
}))

vi.mock("@/pages/superMagic/services/topicRename", () => ({
	smartRenameTopicIfUnnamed: vi.fn(async () => null),
}))

vi.mock("@/services/analytics", () => ({ analyticsService: { report: track } }))

vi.mock("@/pages/superMagic/utils/isChatWorkspaceProject", () => ({
	isCachedChatWorkspaceProject: (project?: { workspace_id?: string } | null) =>
		project?.workspace_id === "chat-workspace",
}))

vi.mock("@/pages/superMagic/services/chatConversationNameSync", () => ({
	shouldSyncChatConversationName: vi.fn(() => false),
	syncChatProjectNameOnly: vi.fn(),
}))

vi.mock("@/services/recordSummary/NetworkMonitor", () => ({
	getNetworkMonitor: () => ({ isNetworkOffline: () => false }),
}))

type MessageSendService = ReturnType<typeof createMessageSendService>
type MessageSendServiceDeps = Parameters<MessageSendService["configure"]>[0]

describe("MessageSendService / SuperMagic 单候选请求", () => {
	it("sends custom Mention text while preserving its rich-text metadata", async () => {
		const chat = vi.fn().mockResolvedValue({})
		const addUserMessage = vi.fn()
		const service = createMessageSendService({
			chatApi: { chat } as unknown as MessageSendServiceDeps["chatApi"],
			superMagicApi: {} as MessageSendServiceDeps["superMagicApi"],
			pubsub: { publish: vi.fn() } as unknown as MessageSendServiceDeps["pubsub"],
			mentionPanelStore: {
				addMentionListItemsToHistory: vi.fn(),
			} as unknown as MessageSendServiceDeps["mentionPanelStore"],
			userStore: {
				user: { userInfo: { user_id: "mock-user" } },
			} as unknown as MessageSendServiceDeps["userStore"],
			superMagicStore: {
				messages: new Map([["mock-chat-topic", []]]),
				getLatestMessageAnchor: vi.fn(() => ({})),
				addUserMessage,
				replaceUserMessage: vi.fn(),
			} as unknown as MessageSendServiceDeps["superMagicStore"],
			logger: { error: vi.fn() } as unknown as MessageSendServiceDeps["logger"],
		})
		const selectedTopic = {
			id: "mock-topic",
			chat_topic_id: "mock-chat-topic",
			chat_conversation_id: "mock-conversation",
		} as Topic
		const structuredContent = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "请查看 " },
						{
							type: "mention",
							attrs: {
								id: null,
								label: null,
								mentionSuggestionChar: "@",
								type: "text",
								data: {
									groupId: "mock-business-charts",
									id: "mock-chart-a",
									label: "Chart A",
									text: "Business chart Chart A; period: sample quarter; metric: mock revenue; trend: up 12% quarter over quarter.",
									type: "chart",
									source: "fixture",
								},
							},
						},
					],
				},
			],
		}

		await service.dispatchMessage({
			jsonContent: structuredContent,
			showLoading: false,
			selectedProject: null,
			selectedTopic,
			options: { extra: { super_agent: { mentions: [] } } },
		})

		const displayed = addUserMessage.mock.calls[0]?.[1]?.message?.rich_text?.content
		const transported = chat.mock.calls[0]?.[1]?.message?.rich_text?.content
		const expectedContent = {
			...structuredContent,
			content: [
				{
					...structuredContent.content[0],
					content: [
						structuredContent.content[0].content[0],
						{
							...structuredContent.content[0].content[1],
							attrs: {
								...structuredContent.content[0].content[1].attrs,
								label: "Business chart Chart A; period: sample quarter; metric: mock revenue; trend: up 12% quarter over quarter.",
							},
						},
					],
				},
			],
		}
		expect(JSON.parse(displayed)).toEqual(expectedContent)
		expect(JSON.parse(transported)).toEqual(expectedContent)
		expect(JSON.parse(transported).content[0].content[1].attrs.data).toEqual({
			groupId: "mock-business-charts",
			id: "mock-chart-a",
			label: "Chart A",
			text: "Business chart Chart A; period: sample quarter; metric: mock revenue; trend: up 12% quarter over quarter.",
			type: "chart",
			source: "fixture",
		})
		expect(structuredContent.content[0].content[1].attrs.label).toBeNull()
	})

	it.each([
		["调用方传入 n=4", { n: 4, caller_flag: "preserved" }],
		["调用方未传 n", { caller_flag: "preserved" }],
	] as const)(
		"发送 Agent 消息时保留调用方 dynamic_params：%s。",
		async (_caseName, dynamicParams) => {
			const chat = vi.fn().mockResolvedValue({})
			const addUserMessage = vi.fn()
			const service = createMessageSendService({
				chatApi: { chat } as unknown as MessageSendServiceDeps["chatApi"],
				superMagicApi: {} as MessageSendServiceDeps["superMagicApi"],
				pubsub: { publish: vi.fn() } as unknown as MessageSendServiceDeps["pubsub"],
				mentionPanelStore: {
					addMentionListItemsToHistory: vi.fn(),
				} as unknown as MessageSendServiceDeps["mentionPanelStore"],
				userStore: {
					user: { userInfo: { user_id: "user-1" } },
				} as MessageSendServiceDeps["userStore"],
				superMagicStore: {
					messages: new Map([["chat-topic-1", []]]),
					getLatestMessageAnchor: vi.fn(() => ({})),
					addUserMessage,
					replaceUserMessage: vi.fn(),
				} as unknown as MessageSendServiceDeps["superMagicStore"],
				logger: { error: vi.fn() } as unknown as MessageSendServiceDeps["logger"],
			})
			const selectedTopic = {
				id: "topic-1",
				chat_topic_id: "chat-topic-1",
				chat_conversation_id: "conversation-1",
			} as Topic

			const sent = await service.dispatchMessage({
				content: "hello",
				showLoading: false,
				selectedProject: null,
				selectedTopic,
				options: {
					extra: {
						super_agent: {
							mentions: [],
							chat_mode: "normal",
							dynamic_params: { ...dynamicParams },
						},
					},
				},
			})

			expect(sent).toBe(true)
			expect(addUserMessage).toHaveBeenCalledTimes(1)
			expect(chat).toHaveBeenCalledTimes(1)
			const pendingUserMessage = chat.mock.calls[0]?.[1] as {
				message?: {
					rich_text?: {
						extra?: { super_agent?: { dynamic_params?: Record<string, unknown> } }
					}
				}
			}
			expect(
				pendingUserMessage.message?.rich_text?.extra?.super_agent?.dynamic_params,
			).toEqual(
				expect.objectContaining({
					message_version: "v2",
					caller_flag: "preserved",
				}),
			)
		},
	)

	it("marks a previously finished topic as running before dispatching the Agent request", async () => {
		const chat = vi.fn().mockResolvedValue({
			data: {
				seq: {
					message: { app_message_id: "server-user-message" },
				},
			},
		})
		const beginTopicExecution = vi.fn()
		const mergeTopic = vi.fn()
		const service = createMessageSendService({
			chatApi: { chat } as unknown as MessageSendServiceDeps["chatApi"],
			superMagicApi: {} as MessageSendServiceDeps["superMagicApi"],
			pubsub: { publish: vi.fn() } as unknown as MessageSendServiceDeps["pubsub"],
			mentionPanelStore: {
				addMentionListItemsToHistory: vi.fn(),
			} as unknown as MessageSendServiceDeps["mentionPanelStore"],
			userStore: {
				user: { userInfo: { user_id: "mock-user" } },
			} as unknown as MessageSendServiceDeps["userStore"],
			superMagicStore: {
				messages: new Map([["mock-chat-topic", []]]),
				getLatestMessageAnchor: vi.fn(() => ({})),
				addUserMessage: vi.fn(),
				replaceUserMessage: vi.fn(),
				beginTopicExecution,
			} as unknown as MessageSendServiceDeps["superMagicStore"],
			logger: { error: vi.fn() } as unknown as MessageSendServiceDeps["logger"],
		})

		await service.dispatchMessage({
			content: "hello",
			showLoading: false,
			selectedProject: null,
			selectedTopic: {
				id: "topic-1",
				chat_topic_id: "mock-chat-topic",
				chat_conversation_id: "mock-conversation",
				task_status: "finished",
			} as Topic,
			context: {
				topicStore: { mergeTopic } as never,
			},
		})

		expect(beginTopicExecution).toHaveBeenCalledWith("mock-chat-topic")
		expect(mergeTopic).toHaveBeenCalledWith("topic-1", {
			task_status: "running",
			status: "running",
		})
		expect(chat).toHaveBeenCalledTimes(1)
	})

	it("restores the previous Topic status when the Agent request fails", async () => {
		const chat = vi.fn().mockRejectedValue(new Error("request failed"))
		const beginTopicExecution = vi.fn()
		const failPendingTopicExecution = vi.fn()
		const mergeTopic = vi.fn()
		const service = createMessageSendService({
			chatApi: { chat } as unknown as MessageSendServiceDeps["chatApi"],
			superMagicApi: {} as unknown as MessageSendServiceDeps["superMagicApi"],
			pubsub: { publish: vi.fn() } as unknown as MessageSendServiceDeps["pubsub"],
			mentionPanelStore: {
				addMentionListItemsToHistory: vi.fn(),
			} as unknown as MessageSendServiceDeps["mentionPanelStore"],
			userStore: {
				user: { userInfo: { user_id: "mock-user" } },
			} as unknown as MessageSendServiceDeps["userStore"],
			superMagicStore: {
				messages: new Map([["mock-chat-topic", []]]),
				getLatestMessageAnchor: vi.fn(() => ({})),
				addUserMessage: vi.fn(),
				replaceUserMessage: vi.fn(),
				beginTopicExecution,
				failPendingTopicExecution,
			} as unknown as MessageSendServiceDeps["superMagicStore"],
			logger: { error: vi.fn() } as unknown as MessageSendServiceDeps["logger"],
		})

		const sent = await service.dispatchMessage({
			content: "hello",
			showLoading: false,
			selectedProject: null,
			selectedTopic: {
				id: "topic-1",
				chat_topic_id: "mock-chat-topic",
				chat_conversation_id: "mock-conversation",
				task_status: "finished",
			} as Topic,
			context: {
				topicStore: { mergeTopic } as never,
			},
		})

		await vi.waitFor(() =>
			expect(failPendingTopicExecution).toHaveBeenCalledWith("mock-chat-topic"),
		)
		expect(sent).toBe(true)
		expect(mergeTopic).toHaveBeenLastCalledWith("topic-1", {
			task_status: "finished",
			status: "finished",
		})
	})
})

describe("MessageSendService / conversation_message_send_attempted", () => {
	beforeEach(() => {
		vi.mocked(track).mockReset()
		resetConversationTopicModeOverridesForTests()
	})

	function createService(
		chat: ReturnType<typeof vi.fn>,
		logger: { error: ReturnType<typeof vi.fn> } = { error: vi.fn() },
	) {
		return createMessageSendService({
			chatApi: { chat } as unknown as MessageSendServiceDeps["chatApi"],
			superMagicApi: {} as unknown as MessageSendServiceDeps["superMagicApi"],
			pubsub: { publish: vi.fn() } as unknown as MessageSendServiceDeps["pubsub"],
			mentionPanelStore: {
				addMentionListItemsToHistory: vi.fn(),
			} as unknown as MessageSendServiceDeps["mentionPanelStore"],
			userStore: {
				user: { userInfo: { user_id: "user-1" } },
			} as unknown as MessageSendServiceDeps["userStore"],
			superMagicStore: {
				messages: new Map([["chat-topic-1", []]]),
				getLatestMessageAnchor: vi.fn(() => ({})),
				addUserMessage: vi.fn(),
				replaceUserMessage: vi.fn(),
			} as unknown as MessageSendServiceDeps["superMagicStore"],
			logger: logger as unknown as MessageSendServiceDeps["logger"],
		})
	}

	const successResponse = {
		data: { seq: { message: { app_message_id: "server-1" } } },
	}

	it("tracks once after chat confirms the message", async () => {
		const chat = vi.fn().mockResolvedValue(successResponse)
		const service = createService(chat)

		await service.dispatchMessage({
			content: "hello",
			showLoading: false,
			selectedProject: { id: "project-1", workspace_id: "ws-1" } as never,
			selectedTopic: {
				id: "topic-1",
				chat_topic_id: "chat-topic-1",
				chat_conversation_id: "conversation-1",
				topic_mode: TopicMode.General,
			} as Topic,
			context: {
				selectedWorkspace: {
					id: "ws-1",
					workspace_type: "default",
				} as never,
			},
			options: {
				extra: { super_agent: { mentions: [], chat_mode: "normal" } },
			},
		})

		await vi.waitFor(() => expect(track).toHaveBeenCalledTimes(1))
		expect(track).toHaveBeenCalledWith(
			"conversation_message_send_attempted",
			expect.objectContaining({
				topicId: "topic-1",
				workspaceId: "ws-1",
				projectId: "project-1",
				topicMode: TopicMode.General,
				workspaceType: "default",
			}),
		)
	})

	it("tracks the attempt when chat fails", async () => {
		const chat = vi.fn().mockRejectedValue(new Error("request failed"))
		const service = createService(chat)

		await service.dispatchMessage({
			content: "hello",
			showLoading: false,
			selectedTopic: {
				id: "topic-1",
				chat_topic_id: "chat-topic-1",
				chat_conversation_id: "conversation-1",
			} as Topic,
		})

		await vi.waitFor(() => expect(chat).toHaveBeenCalledTimes(1))
		expect(track).toHaveBeenCalledTimes(1)
	})

	it("logs and toasts when the chat request is rejected (e.g. WebSocket cannot connect)", async () => {
		toastError.mockClear()
		const logger = { error: vi.fn() }
		const chat = vi.fn().mockRejectedValue("websocket 连接超时")
		const service = createService(chat, logger)

		await service.dispatchMessage({
			content: "hello",
			showLoading: false,
			selectedTopic: {
				id: "topic-1",
				chat_topic_id: "chat-topic-1",
				chat_conversation_id: "conversation-1",
			} as Topic,
		})

		await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith("messageSendFailed"))
		expect(logger.error).toHaveBeenCalledWith(
			expect.objectContaining({
				eventKey: "message_send_failed",
				context: { reason: "chat_request_rejected", chatTopicId: "chat-topic-1" },
			}),
		)
	})

	it("tracks the attempt when chat returns no message payload", async () => {
		const chat = vi.fn().mockResolvedValue({})
		const service = createService(chat)

		await service.dispatchMessage({
			content: "hello",
			showLoading: false,
			selectedTopic: {
				id: "topic-1",
				chat_topic_id: "chat-topic-1",
				chat_conversation_id: "conversation-1",
			} as Topic,
		})

		await vi.waitFor(() => expect(chat).toHaveBeenCalledTimes(1))
		expect(track).toHaveBeenCalledTimes(1)
	})

	it("does not duplicate when two real sends succeed (queue flush is another dispatch)", async () => {
		const chat = vi.fn().mockResolvedValue(successResponse)
		const service = createService(chat)
		const payload = {
			content: "hello",
			showLoading: false,
			selectedTopic: {
				id: "topic-1",
				chat_topic_id: "chat-topic-1",
				chat_conversation_id: "conversation-1",
				topic_mode: TopicMode.General,
			} as Topic,
		}

		await service.dispatchMessage(payload)
		await service.dispatchMessage(payload)
		await vi.waitFor(() => expect(track).toHaveBeenCalledTimes(2))
	})

	it("tracks MicroApp sends with the MicroApp topic mode", async () => {
		const chat = vi.fn().mockResolvedValue(successResponse)
		const service = createService(chat)

		await service.dispatchMessage({
			content: "hello",
			showLoading: false,
			selectedTopic: {
				id: "topic-1",
				chat_topic_id: "chat-topic-1",
				chat_conversation_id: "conversation-1",
				topic_mode: TopicMode.MicroApp,
			} as Topic,
		})

		await vi.waitFor(() => expect(chat).toHaveBeenCalledTimes(1))
		await vi.waitFor(() =>
			expect(track).toHaveBeenCalledWith(
				"conversation_message_send_attempted",
				expect.objectContaining({
					topicId: "topic-1",
					topicMode: TopicMode.MicroApp,
				}),
			),
		)
	})

	it.each([TopicMode.MagiClaw, TopicMode.CrewCreator, TopicMode.SkillCreator] as const)(
		"forwards %s send options as topicMode",
		async (topicPattern) => {
			const chat = vi.fn().mockResolvedValue(successResponse)
			const service = createService(chat)

			await service.dispatchMessage({
				content: "hello",
				showLoading: false,
				selectedProject: { id: "project-1", workspace_id: "chat-workspace" } as never,
				selectedTopic: {
					id: "topic-1",
					chat_topic_id: "chat-topic-1",
					chat_conversation_id: "conversation-1",
					topic_mode: TopicMode.General,
				} as Topic,
				context: {
					selectedWorkspace: {
						id: "chat-workspace",
						workspace_type: "chat",
					} as never,
				},
				options: {
					extra: { super_agent: { topic_pattern: topicPattern } },
				},
			})

			await vi.waitFor(() => expect(track).toHaveBeenCalledTimes(1))
			expect(track).toHaveBeenCalledWith(
				"conversation_message_send_attempted",
				expect.objectContaining({
					topicMode: topicPattern,
					workspaceType: "chat",
				}),
			)
		},
	)

	it("forwards chat workspace type for a regular topic", async () => {
		const chat = vi.fn().mockResolvedValue(successResponse)
		const service = createService(chat)

		await service.dispatchMessage({
			content: "hello",
			showLoading: false,
			selectedProject: { id: "project-1", workspace_id: "chat-workspace" } as never,
			selectedTopic: {
				id: "topic-1",
				chat_topic_id: "chat-topic-1",
				chat_conversation_id: "conversation-1",
				topic_mode: TopicMode.General,
			} as Topic,
			context: {
				selectedWorkspace: {
					id: "chat-workspace",
					workspace_type: "chat",
				} as never,
			},
		})

		await vi.waitFor(() => expect(track).toHaveBeenCalledTimes(1))
		expect(track).toHaveBeenCalledWith(
			"conversation_message_send_attempted",
			expect.objectContaining({ workspaceType: "chat", topicMode: TopicMode.General }),
		)
	})

	it("prefers a registered Claw outbound topic mode over the topic record", async () => {
		registerConversationTopicModeOverride("topic-1", TopicMode.MagiClaw)
		const chat = vi.fn().mockResolvedValue(successResponse)
		const service = createService(chat)

		await service.dispatchMessage({
			content: "hello",
			showLoading: false,
			selectedTopic: {
				id: "topic-1",
				chat_topic_id: "chat-topic-1",
				chat_conversation_id: "conversation-1",
				topic_mode: TopicMode.General,
			} as Topic,
		})

		await vi.waitFor(() => expect(track).toHaveBeenCalledTimes(1))
		expect(track).toHaveBeenCalledWith(
			"conversation_message_send_attempted",
			expect.objectContaining({ topicMode: TopicMode.MagiClaw }),
		)
	})
})
