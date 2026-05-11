import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicStore } from "@/pages/superMagic/stores"

function createAssistantEnvelope({
	appMessageId,
	correlationId,
	content,
	nodeOverrides = {},
	messageOverrides = {},
	seqId = "100",
}: {
	appMessageId: string
	correlationId: string
	content: string
	nodeOverrides?: Record<string, unknown>
	messageOverrides?: Record<string, unknown>
	seqId?: string
}) {
	return {
		seq: {
			seq_id: seqId,
			message: {
				type: "super_magic_message",
				app_message_id: appMessageId,
				topic_id: "topic-1",
				send_time: Date.now() / 1000,
				status: "unread",
				...messageOverrides,
				super_magic_message: {
					role: "assistant",
					correlation_id: correlationId,
					content,
					...nodeOverrides,
				},
			},
		},
	} as any
}

function createChunkMessage({
	content,
	correlationId,
	finishReason = null,
}: {
	content: string
	correlationId: string
	finishReason?: "stop" | "tool_calls" | "length" | null
}) {
	return {
		type: "super_magic_chunk",
		topic_id: "topic-1",
		super_magic_chunk: {
			i: 1,
			correlation_id: correlationId,
			choices: [
				{
					finish_reason: finishReason,
					delta: {
						content,
						reasoning_content: "",
						tool_calls: [],
					},
				},
			],
		},
	} as any
}

describe("SuperMagicStore streaming", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.runOnlyPendingTimers()
		vi.useRealTimers()
	})

	it("assistant 消息主键归一 + alias 可回查", () => {
		const store = new SuperMagicStore()
		store.setActiveTopicId("topic-1")
		store.setTest("topic-1")

		store.enqueueMessage(
			"topic-1",
			createAssistantEnvelope({
				appMessageId: "raw-app-id",
				correlationId: "corr-1",
				content: "hello",
			}),
		)

		vi.runAllTimers()

		const messages = store.messages.get("topic-1") || []
		const assistantMessage = messages.find((item) => item.correlation_id === "corr-1")
		expect(assistantMessage?.app_message_id).toBe("corr-1")
		expect(store.getMessageNode("raw-app-id")).toBeTruthy()
		expect((store.getMessageNode("corr-1") as any)?.content).toBe("hello")
	})

	it("chunk 终态 stop 后冻结，后到 chunk 不可脏写", () => {
		const store = new SuperMagicStore()
		store.setTest("topic-1")

		store.handleSuperMagicChunkMessage(
			createChunkMessage({
				correlationId: "corr-2",
				content: "hel",
			}),
		)
		store.handleSuperMagicChunkMessage(
			createChunkMessage({
				correlationId: "corr-2",
				content: "lo",
				finishReason: "stop",
			}),
		)
		vi.runAllTimers()

		const streamEntry = store.getTopicMetadata("topic-1").content["corr-2"]
		expect(streamEntry.status).toBe(4)
		expect(streamEntry.content).toBe("hello")

		store.handleSuperMagicChunkMessage(
			createChunkMessage({
				correlationId: "corr-2",
				content: "!!!",
			}),
		)
		vi.runAllTimers()

		const nextEntry = store.getTopicMetadata("topic-1").content["corr-2"]
		expect(nextEntry.content).toBe("hello")
	})

	it("真消息到达后，非流式元信息（status/task_id/event/attachments）同步到 mock 节点与卡片", () => {
		const store = new SuperMagicStore()
		store.setActiveTopicId("topic-1")
		store.setTest("topic-1")

		// 1. 先让 chunk 到达，mock 出一条节点 + 卡片
		store.receiveChunk({
			type: "super_magic_chunk",
			topic_id: "topic-1",
			super_magic_chunk: {
				i: 1,
				correlation_id: "corr-sync",
				choices: [
					{
						finish_reason: null,
						delta: {
							content: "hi",
							reasoning_content: "",
							tool_calls: [],
						},
					},
				],
			},
		} as any)
		vi.runAllTimers()

		const mockedNode = store.getMessageNode("corr-sync") as any
		expect(mockedNode).toBeTruthy()
		expect(mockedNode.status).toBe("running")
		expect(mockedNode.task_id).toBeUndefined()

		const mockedCard = (store.messages.get("topic-1") || []).find(
			(o) => o.app_message_id === "corr-sync",
		) as any
		expect(mockedCard).toBeTruthy()
		expect(mockedCard.sender_id).toBe("sender_id")
		expect(mockedCard.seq_id).toBeDefined()
		const mockedSeqId = mockedCard.seq_id

		// 2. 真消息到达，携带元信息字段
		store.enqueueMessage(
			"topic-1",
			createAssistantEnvelope({
				appMessageId: "real-app-id",
				correlationId: "corr-sync",
				content: "hello world",
				seqId: "200",
				messageOverrides: {
					magic_message_id: "magic-id-1",
					sender_id: "user-real",
					status: "read",
				},
				nodeOverrides: {
					status: "finished",
					task_id: "task-xyz",
					event: "task_finished",
					attachments: [{ name: "a.txt" }],
					usage: { total_tokens: 42 },
				},
			}),
		)
		vi.runAllTimers()

		// 节点元信息同步（content 走流式 catch-up，独立校验）
		const syncedNode = store.getMessageNode("corr-sync") as any
		expect(syncedNode.status).toBe("finished")
		expect(syncedNode.task_id).toBe("task-xyz")
		expect(syncedNode.event).toBe("task_finished")
		expect(syncedNode.attachments).toEqual([{ name: "a.txt" }])
		expect(syncedNode.usage).toEqual({ total_tokens: 42 })
		expect(syncedNode.content).toBe("hello world")

		// 卡片身份字段同步，但 app_message_id 保留为 correlationId 占位不变
		const syncedCard = (store.messages.get("topic-1") || []).find(
			(o) => o.app_message_id === "corr-sync",
		) as any
		expect(syncedCard).toBeTruthy()
		expect(syncedCard.app_message_id).toBe("corr-sync")
		expect((syncedCard as any).magic_message_id).toBe("magic-id-1")
		expect(syncedCard.sender_id).toBe("user-real")
		expect(syncedCard.status).toBe("read")
		expect(syncedCard.seq_id).toBe("200")
		expect(syncedCard.seq_id).not.toBe(mockedSeqId)

		// 列表中不应因为同步而出现重复卡片
		const corrCards = (store.messages.get("topic-1") || []).filter(
			(o) => o.correlation_id === "corr-sync",
		)
		expect(corrCards).toHaveLength(1)
	})

	it("chunk 半程后 message 接管，继续平滑补齐且不重复插卡", () => {
		const store = new SuperMagicStore()
		store.setActiveTopicId("topic-1")
		store.setTest("topic-1")

		store.handleSuperMagicChunkMessage(
			createChunkMessage({
				correlationId: "corr-3",
				content: "你",
			}),
		)
		vi.runAllTimers()

		store.enqueueMessage(
			"topic-1",
			createAssistantEnvelope({
				appMessageId: "raw-2",
				correlationId: "corr-3",
				content: "你好呀",
			}),
		)
		vi.runAllTimers()

		const messages = (store.messages.get("topic-1") || []).filter(
			(item) => item.correlation_id === "corr-3" && item.role === "assistant",
		)
		expect(messages).toHaveLength(1)
		expect((store.getMessageNode("corr-3") as any)?.content).toBe("你好呀")
	})

	it("非活跃话题不启动定时器，final 到达后 buffer 正常排空且保存快照", () => {
		const store = new SuperMagicStore()
		store.setActiveTopicId("topic-active")
		store.setTest("topic-1")

		store.enqueueMessage(
			"topic-1",
			createAssistantEnvelope({
				appMessageId: "raw-inactive",
				correlationId: "corr-inactive",
				content: "background reply",
			}),
		)
		vi.runAllTimers()

		const node = store.getMessageNode("corr-inactive") as any
		expect(node).toBeTruthy()
		expect(node.content).toBe("background reply")

		const topicMeta = (store as any).getTopicMetadata("topic-1")
		expect(topicMeta.timer).toBeNull()
		expect(topicMeta.content.size).toBe(0)
		expect(topicMeta.streamSnapshots.size).toBe(1)
		expect(topicMeta.streamSnapshots.get("corr-inactive")).toMatchObject({
			content: "",
			reasoning_content: "",
		})
	})

	it("切回话题时回放打字机动画（场景 2）", () => {
		const store = new SuperMagicStore()
		store.setActiveTopicId("topic-active")
		store.setTest("topic-1")

		store.enqueueMessage(
			"topic-1",
			createAssistantEnvelope({
				appMessageId: "raw-replay",
				correlationId: "corr-replay",
				content: "replay me",
			}),
		)
		vi.runAllTimers()

		expect((store.getMessageNode("corr-replay") as any)?.content).toBe("replay me")

		store.setActiveTopicId("topic-1")

		const rewoundNode = store.getMessageNode("corr-replay") as any
		expect(rewoundNode.content.length).toBeLessThan("replay me".length)

		const topicMeta = (store as any).getTopicMetadata("topic-1")
		expect(topicMeta.content.size).toBe(1)
		const replayState = topicMeta.content.get("corr-replay")
		expect(replayState.content).toBe("replay me")
		expect(replayState.isFinalMessageReceived).toBe(true)

		vi.runAllTimers()
		expect((store.getMessageNode("corr-replay") as any)?.content).toBe("replay me")
		expect(topicMeta.content.size).toBe(0)
	})

	it("非活跃话题 chunk 积累后切回，从断点继续流式", () => {
		const store = new SuperMagicStore()
		store.setActiveTopicId("topic-1")
		store.setTest("topic-1")

		store.receiveChunk(createChunkMessage({ correlationId: "corr-resume", content: "he" }))
		vi.runAllTimers()

		const partialContent = (store.getMessageNode("corr-resume") as any)?.content || ""
		expect(partialContent.length).toBeGreaterThan(0)
		const snapshotLen = partialContent.length

		store.setActiveTopicId("topic-other")

		store.receiveChunk(
			createChunkMessage({ correlationId: "corr-resume", content: "llo world" }),
		)
		vi.runAllTimers()

		const afterInactiveContent = (store.getMessageNode("corr-resume") as any)?.content || ""
		expect(afterInactiveContent.length).toBe(snapshotLen)

		store.setActiveTopicId("topic-1")
		vi.runAllTimers()

		const streamState = (store as any).getTopicMetadata("topic-1").content.get("corr-resume")
		expect(streamState?.content || "").toBe("hello world")
	})

	it("快速切换话题无定时器泄漏", () => {
		const store = new SuperMagicStore()
		store.setActiveTopicId("topic-1")
		store.setTest("topic-1")

		store.receiveChunk(createChunkMessage({ correlationId: "corr-leak", content: "a" }))
		vi.advanceTimersByTime(16)

		for (let i = 0; i < 10; i++) {
			store.setActiveTopicId(i % 2 === 0 ? "topic-other" : "topic-1")
		}

		const topicMeta = (store as any).getTopicMetadata("topic-1")
		const timerCount = topicMeta.timer ? 1 : 0
		expect(timerCount).toBeLessThanOrEqual(1)
	})
})
