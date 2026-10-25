import { renderHook, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { useIframeAgentActions } from "../useIframeAgentActions"

const mocks = vi.hoisted(() => ({
	publish: vi.fn(),
	createTopic: vi.fn(),
	getTopicDetail: vi.fn(),
	addMessageToQueue: vi.fn(),
	messages: new Map(),
	getMessageNode: vi.fn(),
	setSelectedTopic: vi.fn(),
	setScopedTopics: vi.fn(),
	setScopedSelectedTopic: vi.fn(),
	dispatchMessage: vi.fn(),
	hasListeners: vi.fn(() => false),
	releaseHtmlScreenshotsAfterSend: vi.fn(),
	collectMentionItemsFromContent: vi.fn(() => []),
	processMessageMentions: vi.fn(async (content: unknown) => content),
	notifySpecifiedAgentUnavailable: vi.fn(),
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}))

vi.mock("@/pages/superMagic/utils/isChatWorkspaceProject", () => ({
	isCachedChatWorkspaceProject: (project?: { workspace_id?: string } | null) =>
		project?.workspace_id === "chat-ws",
}))

vi.mock("@/pages/superMagic/utils/notifySpecifiedAgentUnavailable", () => ({
	notifySpecifiedAgentUnavailable: mocks.notifySpecifiedAgentUnavailable,
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: mocks.publish,
		hasListeners: mocks.hasListeners,
	},
	PubSubEvents: {
		Send_Message_by_Content: "send-message-by-content",
		Expand_Topic_Conversation_Panel: "expand-topic-conversation-panel",
		SuperMagicMessageQueueConsumed: "queue-updated",
	},
}))

vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: { messages: mocks.messages, getMessageNode: mocks.getMessageNode },
}))
vi.mock("@/pages/superMagic/stores/optimisticMessageStore", () => ({
	optimisticMessageStore: { getStatus: () => undefined },
}))
vi.mock("@/pages/superMagic/components/MessageEditor/utils/mention", () => ({
	transformMentions: (items: unknown[]) => items,
}))
vi.mock("@/pages/superMagic/pages/Workspace/types", () => ({
	TaskStatus: { RUNNING: "running", WAITING_FOR_USER: "waiting_for_user" },
	MessageStatus: { REVOKED: "revoked" },
	AgentType: {
		Official: 1,
		Custom: 2,
		Public: 3,
	},
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		_modeList: [
			{
				agent: { type: 1 },
				mode: { identifier: TopicMode.General, name: "General" },
			},
		],
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		createTopic: mocks.createTopic,
		getTopicDetail: mocks.getTopicDetail,
		addMessageToQueue: mocks.addMessageToQueue,
	},
}))

vi.mock("@/services/superMagic/topicModel", () => ({
	superMagicTopicModelService: {
		saveModel: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/services/messageSendFlowService", () => ({
	messageSendService: {
		dispatchMessage: mocks.dispatchMessage,
	},
}))

vi.mock("@/pages/superMagic/services/messageSendPreparation", () => ({
	resolveMessageSendContext: (context: unknown) => context,
	processMessageMentions: mocks.processMessageMentions,
	releaseHtmlScreenshotsAfterSend: mocks.releaseHtmlScreenshotsAfterSend,
}))

vi.mock("@/pages/superMagic/components/MessageEditor/services/uploadMentionService", () => ({
	collectMentionItemsFromContent: mocks.collectMentionItemsFromContent,
}))

describe("useIframeAgentActions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.messages.clear()
		mocks.getMessageNode.mockReset()
		mocks.addMessageToQueue.mockReset().mockResolvedValue({ queue_id: "queue-1" })
		mocks.publish.mockReset()
		mocks.createTopic.mockResolvedValue({ id: "topic-1" })
		mocks.getTopicDetail.mockImplementation(async ({ id }: { id: string }) => ({
			id,
			chat_topic_id: `chat-${id}`,
			chat_conversation_id: `conversation-${id}`,
		}))
		mocks.dispatchMessage.mockResolvedValue(true)
		mocks.hasListeners.mockReturnValue(false)
	})

	function renderSendActions(status = "running") {
		const store = {
			selectedTopic: { id: "host-topic", chat_topic_id: "host-chat", task_status: status },
			topics: [],
		} as unknown as TopicStore
		const hook = renderHook(() =>
			useIframeAgentActions(
				"origin-project",
				store,
				{ id: "host-project", project_mode: TopicMode.MicroApp } as ProjectListItem,
				{ microAppId: "app-1" },
			),
		)
		return { ...hook, store }
	}

	it("queues running host messages with their model and micro-app mention", async () => {
		const { result } = renderSendActions()
		await act(async () => {
			await result.current.sendMessage({ message: "queued", model: "model-1" })
		})
		expect(mocks.dispatchMessage).not.toHaveBeenCalled()
		const request = mocks.addMessageToQueue.mock.calls[0][0]
		expect(request).toMatchObject({
			project_id: "host-project",
			topic_id: "host-topic",
			message_type: "rich_text",
			message_content: {
				extra: {
					super_agent: {
						model: { model_id: "model-1" },
						topic_pattern: TopicMode.MicroApp,
					},
				},
			},
		})
		expect(request.message_content.content).toContain("app-1")
		expect(request.message_content.content).toContain("queued")
		expect(mocks.publish).toHaveBeenCalledWith("queue-updated")
	})

	it.each(["finished", "waiting_for_user"])(
		"sends directly when the topic is %s",
		async (status) => {
			const { result } = renderSendActions(status)
			await act(async () => {
				await result.current.sendMessage({ message: "reply" })
			})
			expect(mocks.dispatchMessage).toHaveBeenCalledOnce()
			expect(mocks.addMessageToQueue).not.toHaveBeenCalled()
		},
	)

	it("queues when conversation messages are still running before topic status updates", async () => {
		const { result } = renderSendActions("finished")
		mocks.messages.set("host-chat", [
			{ role: "assistant", super_message_id: "message-1" },
			{ role: "assistant", super_message_id: "message-2" },
		])
		mocks.getMessageNode.mockReturnValue({ status: "running" })
		await act(async () => {
			await result.current.sendMessage({ message: "follow-up" })
		})
		expect(mocks.addMessageToQueue).toHaveBeenCalledOnce()
		expect(mocks.dispatchMessage).not.toHaveBeenCalled()
	})

	it.each([undefined, {}])(
		"rejects an unconfirmed queue submission without falling back to direct send",
		async (response) => {
			const { result } = renderSendActions()
			mocks.addMessageToQueue.mockResolvedValue(response)
			await expect(result.current.sendMessage({ message: "queued" })).rejects.toThrow(
				"Failed to queue message",
			)
			expect(mocks.dispatchMessage).not.toHaveBeenCalled()
			expect(mocks.releaseHtmlScreenshotsAfterSend).not.toHaveBeenCalled()
			expect(mocks.publish).not.toHaveBeenCalledWith("queue-updated")
		},
	)

	it("keeps the captured host topic when selection changes during preparation", async () => {
		const { result, store } = renderSendActions()
		store.topics = store.selectedTopic ? [store.selectedTopic] : []
		mocks.processMessageMentions.mockImplementationOnce(async (content) => {
			store.selectedTopic = { id: "other-topic", task_status: "finished" } as Topic
			return content
		})
		await result.current.sendMessage({ message: "queued" })
		expect(mocks.addMessageToQueue).toHaveBeenCalledWith(
			expect.objectContaining({ topic_id: "host-topic" }),
		)
		expect(mocks.dispatchMessage).not.toHaveBeenCalled()
	})

	it("keeps a failed queue submission retryable and never sends it directly", async () => {
		const { result } = renderSendActions()
		mocks.addMessageToQueue.mockRejectedValue(new Error("network unavailable"))
		await expect(result.current.sendMessage({ message: "queued" })).rejects.toThrow(
			"network unavailable",
		)
		expect(mocks.dispatchMessage).not.toHaveBeenCalled()
		expect(mocks.releaseHtmlScreenshotsAfterSend).not.toHaveBeenCalled()
	})

	it("lets a waiting-for-user reply through even with stale running message nodes", async () => {
		const { result } = renderSendActions("waiting_for_user")
		mocks.messages.set("host-chat", [{ role: "assistant" }])
		mocks.getMessageNode.mockReturnValue({ status: "running" })
		await result.current.sendMessage({ message: "answer" })
		expect(mocks.dispatchMessage).toHaveBeenCalledOnce()
		expect(mocks.addMessageToQueue).not.toHaveBeenCalled()
	})

	it("rechecks running state after async preparation and preserves the implicit model", async () => {
		const { result, store } = renderSendActions("finished")
		mocks.processMessageMentions.mockImplementationOnce(async (content) => {
			store.selectedTopic = { ...store.selectedTopic, task_status: "running" } as Topic
			return content
		})
		await result.current.sendMessage({ message: "next" })
		expect(mocks.addMessageToQueue).toHaveBeenCalledOnce()
		expect(
			mocks.addMessageToQueue.mock.calls[0][0].message_content.extra.super_agent.model,
		).toBeUndefined()
		expect(mocks.dispatchMessage).not.toHaveBeenCalled()
	})

	it("rejects topic creation when the topic store is missing", async () => {
		const { result } = renderHook(() =>
			useIframeAgentActions("project-from-preview", undefined, {
				id: "project-current",
			} as any),
		)

		await act(async () => {
			await expect(result.current.createTopicAndSend({ message: "hello" })).rejects.toThrow(
				"No topic store",
			)
		})

		expect(mocks.createTopic).not.toHaveBeenCalled()
		expect(mocks.publish).not.toHaveBeenCalled()
	})

	it("preserves runtime access errors without creating a topic or sending", async () => {
		const ensureConversation = vi
			.fn()
			.mockRejectedValue(
				new Error("Password-protected micro apps only support collaborators"),
			)
		const { result } = renderHook(() =>
			useIframeAgentActions(
				"project-from-preview",
				undefined,
				null,
				{ microAppId: "app-1" },
				ensureConversation,
			),
		)

		await act(async () => {
			await expect(result.current.createTopicAndSend({ message: "hello" })).rejects.toThrow(
				"Password-protected micro apps only support collaborators",
			)
		})

		expect(ensureConversation).toHaveBeenCalledTimes(1)
		expect(mocks.createTopic).not.toHaveBeenCalled()
		expect(mocks.dispatchMessage).not.toHaveBeenCalled()
		expect(mocks.publish).not.toHaveBeenCalled()
	})

	it("creates topics in the host project instead of the preview origin", async () => {
		const topicStore = {
			topics: [],
			setTopics: mocks.setScopedTopics,
			setSelectedTopic: mocks.setScopedSelectedTopic,
		} as any
		const { result } = renderHook(() =>
			useIframeAgentActions("project-from-preview", topicStore, {
				id: "project-current",
			} as any),
		)

		await act(async () => {
			await result.current.createTopicAndSend({ message: "hello" })
		})

		expect(mocks.createTopic).toHaveBeenCalledWith({
			project_id: "project-current",
			topic_name: "",
		})
		expect(mocks.dispatchMessage).toHaveBeenCalled()
		expect(mocks.publish).not.toHaveBeenCalled()
	})

	it("selects a custom employee before topic detail includes one", async () => {
		const modeList = superMagicModeService._modeList as Array<{
			agent: { type: number }
			mode: { identifier: string; name: string }
		}>
		modeList.push({
			agent: { type: 2 },
			mode: { identifier: "SMA-preview", name: "Preview employee" },
		})
		try {
			const topicStore = {
				topics: [],
				setTopics: mocks.setScopedTopics,
				setSelectedTopic: mocks.setScopedSelectedTopic,
			} as any
			const { result } = renderHook(() =>
				useIframeAgentActions("project-from-preview", topicStore, {
					id: "project-current",
				} as any),
			)

			await act(async () => {
				await result.current.createTopicAndSend({
					message: "hello",
					agentId: "SMA-preview",
				})
			})

			expect(mocks.setScopedSelectedTopic).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "topic-1",
					topic_mode: TopicMode.CustomAgent,
					agent_code: "SMA-preview",
				}),
			)
		} finally {
			modeList.pop()
		}
	})

	it("selects a built-in employee as topic mode without an agent code", async () => {
		const topicStore = {
			topics: [],
			setTopics: mocks.setScopedTopics,
			setSelectedTopic: mocks.setScopedSelectedTopic,
		} as any
		const { result } = renderHook(() =>
			useIframeAgentActions("project-from-preview", topicStore, {
				id: "project-current",
			} as any),
		)

		await act(async () => {
			await result.current.createTopicAndSend({
				message: "hello",
				agentId: TopicMode.General,
			})
		})

		expect(mocks.setScopedSelectedTopic).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "topic-1",
				topic_mode: TopicMode.General,
				agent_code: undefined,
			}),
		)
	})

	it("prepends the published micro-app mention to Agent messages", async () => {
		const topicStore = {
			topics: [],
			setTopics: mocks.setScopedTopics,
			setSelectedTopic: mocks.setScopedSelectedTopic,
		} as any
		const { result } = renderHook(() =>
			useIframeAgentActions(
				"project-from-preview",
				topicStore,
				{ id: "project-current" } as any,
				{ microAppId: "app-1", microAppName: "库存助手" },
			),
		)

		await act(async () => {
			await result.current.sendMessage({ message: "查询库存" })
		})

		expect(mocks.publish).toHaveBeenCalledWith("expand-topic-conversation-panel")
		expect(mocks.publish).toHaveBeenCalledTimes(1)
		expect(mocks.publish.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.dispatchMessage.mock.invocationCallOrder[0],
		)

		const processedContent = mocks.processMessageMentions.mock.calls[0]?.[0] as any
		expect(processedContent.content[0].content[0]).toEqual({
			type: "mention",
			attrs: {
				type: "micro_app",
				data: { app_id: "app-1", app_name: "库存助手" },
			},
		})
	})

	it("prepends the published micro-app mention when creating a topic", async () => {
		const topicStore = {
			topics: [],
			setTopics: mocks.setScopedTopics,
			setSelectedTopic: mocks.setScopedSelectedTopic,
		} as any
		const { result } = renderHook(() =>
			useIframeAgentActions(
				"project-from-preview",
				topicStore,
				{ id: "project-current" } as any,
				{ microAppId: "app-1", microAppName: "库存助手" },
			),
		)

		await act(async () => {
			await result.current.createTopicAndSend({ message: "生成补货建议" })
		})

		const processedContent = mocks.processMessageMentions.mock.calls[0]?.[0] as any
		expect(processedContent.content[0].content[0]).toEqual({
			type: "mention",
			attrs: {
				type: "micro_app",
				data: { app_id: "app-1", app_name: "库存助手" },
			},
		})
	})

	it("sends on the current MagiClaw topic instead of creating a new one", async () => {
		const currentTopic = {
			id: "claw-topic-1",
			chat_topic_id: "chat-claw-topic-1",
			chat_conversation_id: "conversation-claw-topic-1",
		} as Topic
		const topicStore = {
			topics: [currentTopic],
			selectedTopic: currentTopic,
			setTopics: mocks.setScopedTopics,
			setSelectedTopic: mocks.setScopedSelectedTopic,
		} as unknown as TopicStore
		const { result } = renderHook(() =>
			useIframeAgentActions("project-from-preview", topicStore, {
				id: "project-current",
				project_mode: TopicMode.MagiClaw,
			} as any),
		)

		await act(async () => {
			await expect(result.current.createTopicAndSend({ message: "hello" })).resolves.toEqual({
				topicId: "claw-topic-1",
			})
		})

		expect(mocks.createTopic).not.toHaveBeenCalled()
		expect(mocks.getTopicDetail).not.toHaveBeenCalled()
		expect(mocks.setScopedSelectedTopic).not.toHaveBeenCalled()
		expect(mocks.setScopedTopics).not.toHaveBeenCalled()
		expect(mocks.dispatchMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				options: expect.objectContaining({
					extra: expect.objectContaining({
						super_agent: expect.objectContaining({
							topic_pattern: TopicMode.MagiClaw,
						}),
					}),
				}),
				context: expect.objectContaining({
					selectedTopic: expect.objectContaining({ id: "claw-topic-1" }),
				}),
			}),
		)
	})

	it("sends on the current Chat topic instead of creating a new one", async () => {
		const currentTopic = {
			id: "chat-topic-1",
			chat_topic_id: "chat-chat-topic-1",
			chat_conversation_id: "conversation-chat-topic-1",
		} as Topic
		const topicStore = {
			topics: [currentTopic],
			selectedTopic: currentTopic,
			setTopics: mocks.setScopedTopics,
			setSelectedTopic: mocks.setScopedSelectedTopic,
		} as unknown as TopicStore
		const { result } = renderHook(() =>
			useIframeAgentActions("project-from-preview", topicStore, {
				id: "project-current",
				project_mode: TopicMode.Chat,
			} as any),
		)

		await act(async () => {
			await expect(result.current.createTopicAndSend({ message: "hello" })).resolves.toEqual({
				topicId: "chat-topic-1",
			})
		})

		expect(mocks.createTopic).not.toHaveBeenCalled()
		expect(mocks.dispatchMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				options: expect.objectContaining({
					extra: expect.objectContaining({
						super_agent: expect.objectContaining({
							topic_pattern: TopicMode.Chat,
						}),
					}),
				}),
				context: expect.objectContaining({
					selectedTopic: expect.objectContaining({ id: "chat-topic-1" }),
				}),
			}),
		)
	})

	it("reuses the current Chat workspace topic even without Chat project_mode", async () => {
		const currentTopic = {
			id: "chat-topic-2",
			chat_topic_id: "chat-chat-topic-2",
			chat_conversation_id: "conversation-chat-topic-2",
		} as Topic
		const topicStore = {
			topics: [currentTopic],
			selectedTopic: currentTopic,
			setTopics: mocks.setScopedTopics,
			setSelectedTopic: mocks.setScopedSelectedTopic,
		} as unknown as TopicStore
		const { result } = renderHook(() =>
			useIframeAgentActions("project-from-preview", topicStore, {
				id: "project-current",
				project_mode: TopicMode.General,
				workspace_id: "chat-ws",
			} as any),
		)

		await act(async () => {
			await expect(
				result.current.createTopicAndSend({
					message: "hello",
					agentId: TopicMode.General,
				}),
			).resolves.toEqual({
				topicId: "chat-topic-2",
			})
		})

		expect(mocks.createTopic).not.toHaveBeenCalled()
		expect(mocks.dispatchMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				options: expect.objectContaining({
					extra: expect.objectContaining({
						super_agent: expect.objectContaining({
							topic_pattern: TopicMode.Chat,
						}),
					}),
				}),
			}),
		)
	})

	it("ignores agentId when sending on MagiClaw", async () => {
		const currentTopic = {
			id: "claw-topic-2",
			chat_topic_id: "chat-claw-topic-2",
			chat_conversation_id: "conversation-claw-topic-2",
		} as Topic
		const topicStore = {
			topics: [currentTopic],
			selectedTopic: currentTopic,
			setTopics: mocks.setScopedTopics,
			setSelectedTopic: mocks.setScopedSelectedTopic,
		} as unknown as TopicStore
		const { result } = renderHook(() =>
			useIframeAgentActions("project-from-preview", topicStore, {
				id: "project-current",
				project_mode: TopicMode.MagiClaw,
			} as any),
		)

		await act(async () => {
			await expect(
				result.current.createTopicAndSend({
					message: "hello",
					agentId: TopicMode.General,
				}),
			).resolves.toEqual({
				topicId: "claw-topic-2",
			})
		})

		expect(mocks.createTopic).not.toHaveBeenCalled()
		expect(mocks.notifySpecifiedAgentUnavailable).toHaveBeenCalledWith(
			TopicMode.General,
			expect.objectContaining({ project_mode: TopicMode.MagiClaw }),
		)
		expect(mocks.dispatchMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				options: expect.objectContaining({
					extra: expect.objectContaining({
						super_agent: expect.objectContaining({
							topic_pattern: TopicMode.MagiClaw,
						}),
					}),
				}),
			}),
		)
		expect(mocks.dispatchMessage.mock.calls[0][0].options.extra.agent_code).toBeUndefined()
	})

	it("rejects MagiClaw send when the unique topic is missing", async () => {
		const topicStore = {
			topics: [],
			selectedTopic: null,
			setTopics: mocks.setScopedTopics,
			setSelectedTopic: mocks.setScopedSelectedTopic,
		} as unknown as TopicStore
		const { result } = renderHook(() =>
			useIframeAgentActions("project-from-preview", topicStore, {
				id: "project-current",
				project_mode: TopicMode.MagiClaw,
			} as any),
		)

		await act(async () => {
			await expect(result.current.createTopicAndSend({ message: "hello" })).rejects.toThrow(
				"No topic selected",
			)
		})

		expect(mocks.createTopic).not.toHaveBeenCalled()
		expect(mocks.dispatchMessage).not.toHaveBeenCalled()
	})

	it("rejects topic creation when the host project is missing", async () => {
		const { result } = renderHook(() => useIframeAgentActions("project-from-preview"))

		await act(async () => {
			await expect(result.current.createTopicAndSend({ message: "hello" })).rejects.toThrow(
				"No project selected",
			)
		})

		expect(mocks.createTopic).not.toHaveBeenCalled()
	})

	it("resolves mentions against the origin project when sending in a scoped conversation", async () => {
		const scopedTopicStore = {
			topics: [],
			setTopics: mocks.setScopedTopics,
			setSelectedTopic: mocks.setScopedSelectedTopic,
		} as any
		const { result } = renderHook(() =>
			useIframeAgentActions("project-from-preview", scopedTopicStore, {
				id: "project-current",
			} as any),
		)

		await act(async () => {
			await result.current.createTopicAndSend({ message: "hello" })
		})

		expect(mocks.createTopic).toHaveBeenCalledWith({
			project_id: "project-current",
			topic_name: "",
		})
		expect(mocks.processMessageMentions).toHaveBeenCalledWith(
			expect.anything(),
			"project-from-preview",
			"topic-1",
		)
		expect(mocks.dispatchMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				context: expect.objectContaining({
					selectedProject: expect.objectContaining({ id: "project-current" }),
				}),
			}),
		)
	})

	it("defaults micro-app topic creation to the general agent", async () => {
		let topics = [{ id: "old-topic" }] as Topic[]
		let selectedTopic: Topic | null = topics[0] ?? null
		const scopedTopicStore = {
			get topics() {
				return topics
			},
			get selectedTopic() {
				return selectedTopic
			},
			setTopics(nextTopics: Topic[]) {
				topics = nextTopics
				mocks.setScopedTopics(nextTopics)
			},
			setSelectedTopic(nextTopic: Topic | null) {
				selectedTopic = nextTopic
				mocks.setScopedSelectedTopic(nextTopic)
			},
		} as unknown as TopicStore
		const { result } = renderHook(() =>
			useIframeAgentActions("project-from-preview", scopedTopicStore, {
				id: "project-from-preview",
				project_mode: TopicMode.MicroApp,
			} as any),
		)

		await act(async () => {
			await result.current.createTopicAndSend({ message: "hello" })
		})

		expect(mocks.setScopedSelectedTopic).toHaveBeenCalledWith(
			expect.objectContaining({ id: "topic-1" }),
		)
		expect(mocks.setScopedTopics).toHaveBeenCalledWith([
			expect.objectContaining({ id: "topic-1" }),
			{ id: "old-topic" },
		])
		expect(mocks.dispatchMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				options: expect.objectContaining({
					extra: expect.objectContaining({
						super_agent: expect.objectContaining({
							topic_pattern: TopicMode.General,
						}),
					}),
				}),
				context: expect.objectContaining({
					selectedTopic: expect.objectContaining({ id: "topic-1" }),
				}),
			}),
		)
		expect(mocks.publish).toHaveBeenCalledWith("expand-topic-conversation-panel")
		expect(mocks.publish.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.createTopic.mock.invocationCallOrder[0],
		)
		expect(mocks.setSelectedTopic).not.toHaveBeenCalled()
	})

	it("binds concurrent sends to the topic created for each message", async () => {
		const createdTopics = [{ id: "topic-1" }, { id: "topic-2" }, { id: "topic-3" }]
		let createIndex = 0
		let selectedTopic: Topic | null = null
		const scopedTopicStore = {
			topics: [],
			get selectedTopic() {
				return selectedTopic
			},
			setTopics: mocks.setScopedTopics,
			setSelectedTopic(topic: Topic | null) {
				selectedTopic = topic
			},
		} as unknown as TopicStore
		mocks.createTopic.mockImplementation(async () => createdTopics[createIndex++])

		const { result } = renderHook(() =>
			useIframeAgentActions("project-from-preview", scopedTopicStore, {
				id: "project-from-preview",
			} as any),
		)

		await act(async () => {
			await Promise.all(
				createdTopics.map((_, index) =>
					result.current.createTopicAndSend({ message: `message-${index + 1}` }),
				),
			)
		})

		expect(mocks.dispatchMessage).toHaveBeenCalledTimes(3)
		expect(
			mocks.dispatchMessage.mock.calls.map(([payload]) => payload.context.selectedTopic?.id),
		).toEqual(["topic-1", "topic-2", "topic-3"])
	})

	it("bypasses the mounted editor lock for concurrent scoped sends", async () => {
		const createdTopics = [{ id: "topic-1" }, { id: "topic-2" }, { id: "topic-3" }]
		let createIndex = 0
		let selectedTopic: Topic | null = null
		let editorBusy = false
		const scopedTopicStore = {
			topics: [],
			get selectedTopic() {
				return selectedTopic
			},
			setTopics: mocks.setScopedTopics,
			setSelectedTopic(topic: Topic | null) {
				selectedTopic = topic
			},
		} as unknown as TopicStore
		mocks.createTopic.mockImplementation(async () => createdTopics[createIndex++])
		mocks.hasListeners.mockReturnValue(true)
		mocks.publish.mockImplementation((_event, payload) => {
			if (editorBusy) return
			editorBusy = true
			void mocks.dispatchMessage({
				context: { selectedTopic: payload.targetTopic },
			})
		})

		const { result } = renderHook(() =>
			useIframeAgentActions("project-from-preview", scopedTopicStore, {
				id: "project-from-preview",
			} as any),
		)

		await act(async () => {
			await Promise.all(
				createdTopics.map((_, index) =>
					result.current.createTopicAndSend({ message: `message-${index + 1}` }),
				),
			)
		})

		expect(mocks.dispatchMessage).toHaveBeenCalledTimes(3)
		expect(
			mocks.dispatchMessage.mock.calls.map(([payload]) => payload.context.selectedTopic?.id),
		).toEqual(["topic-1", "topic-2", "topic-3"])
		expect(mocks.publish).not.toHaveBeenCalled()
	})

	it("uses the scoped direct path when the message editor is mounted", async () => {
		mocks.hasListeners.mockReturnValue(true)
		const scopedTopicStore = {
			topics: [],
			setTopics: mocks.setScopedTopics,
			setSelectedTopic: mocks.setScopedSelectedTopic,
		} as any
		const { result } = renderHook(() =>
			useIframeAgentActions("project-from-preview", scopedTopicStore, {
				id: "project-from-preview",
			} as any),
		)

		await act(async () => {
			await result.current.createTopicAndSend({ message: "hello" })
		})

		expect(mocks.dispatchMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				context: expect.objectContaining({
					selectedTopic: expect.objectContaining({ id: "topic-1" }),
				}),
			}),
		)
		expect(mocks.publish).not.toHaveBeenCalled()
	})

	it("releases screenshot blobs after a scoped send succeeds", async () => {
		const screenshotMentions = [
			{ attrs: { data: { is_html_screenshot: true, storage_id: "region-1" } } },
		]
		mocks.collectMentionItemsFromContent.mockReturnValue(screenshotMentions)
		const scopedTopicStore = {
			topics: [],
			setTopics: mocks.setScopedTopics,
			setSelectedTopic: mocks.setScopedSelectedTopic,
		} as any
		const { result } = renderHook(() =>
			useIframeAgentActions("project-from-preview", scopedTopicStore, {
				id: "project-from-preview",
			} as any),
		)

		await act(async () => {
			await result.current.createTopicAndSend({ message: "hello" })
		})

		expect(mocks.releaseHtmlScreenshotsAfterSend).toHaveBeenCalledWith(screenshotMentions)
	})

	it("keeps screenshot blobs when a scoped send fails", async () => {
		mocks.collectMentionItemsFromContent.mockReturnValue([
			{ attrs: { data: { is_html_screenshot: true, storage_id: "region-1" } } },
		])
		mocks.dispatchMessage.mockResolvedValue(false)
		const scopedTopicStore = {
			topics: [],
			setTopics: mocks.setScopedTopics,
			setSelectedTopic: mocks.setScopedSelectedTopic,
		} as any
		const { result } = renderHook(() =>
			useIframeAgentActions("project-from-preview", scopedTopicStore, {
				id: "project-from-preview",
			} as any),
		)

		await act(async () => {
			await expect(result.current.createTopicAndSend({ message: "hello" })).rejects.toThrow(
				"Failed to send message",
			)
		})

		expect(mocks.releaseHtmlScreenshotsAfterSend).not.toHaveBeenCalled()
	})
})
