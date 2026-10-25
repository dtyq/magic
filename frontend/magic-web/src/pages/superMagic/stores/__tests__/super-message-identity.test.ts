import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import { SeqRecordType, type SeqRecord } from "@/apis/modules/chat/types"
import { getMessageNodeKey } from "@/pages/superMagic/components/MessageList/helpers"
import { SuperMagicStore } from "@/pages/superMagic/stores"
import {
	getRawMessageNode,
	transformRawMessage,
} from "@/pages/superMagic/stores/message-transforms"
import type { RawSuperMagicMessageEnvelope } from "@/pages/superMagic/stores/types"
import {
	ConversationMessageStatus,
	ConversationMessageType,
	type SuperMagicConversationMessageV2,
	type SuperMagicNode,
} from "@/types/chat/conversation_message"
import {
	IntermediateMessageType,
	type SuperMagicChunkMessage,
} from "@/types/chat/intermediate_message"

type SuperMagicChunkPayload = SuperMagicChunkMessage["super_magic_chunk"]
type ChunkChoice = SuperMagicChunkPayload["choices"][number]
type ChunkToolCall = ChunkChoice["delta"]["tool_calls"][number]

const TOPIC_A = "topic-super-message-a"
const TOPIC_B = "topic-super-message-b"
const RENDER_SETTLE_MS = 3_000

interface ChunkOptions {
	topicId?: string
	superMessageId: string
	taskId?: string
	correlationId: string
	i?: number
	content?: string
	reasoningContent?: string
	finishReason?: ChunkChoice["finish_reason"]
	toolCalls?: ChunkToolCall[]
}

interface FinalEnvelopeOptions {
	topicId?: string
	appMessageId: string
	superMessageId?: string
	includeSuperMessageId?: boolean
	correlationId: string
	seqId: string
	role?: "assistant" | "user" | "tool"
	content: string
}

interface ProjectedMessage {
	app_message_id?: string
	super_message_id?: string
	correlation_id?: string
	content?: string | null
	reasoning_content?: string | null
	debug?: {
		content?: string | null
		super_message_id?: string
	}
	role?: string
	seq_id?: string
	topic_id?: string
	tool_calls?: Array<{
		id?: string
		function?: {
			name?: string
			arguments?: string
		}
	}> | null
}

function createChunk({
	topicId = TOPIC_A,
	superMessageId,
	taskId = "task-super-message",
	correlationId,
	i = 0,
	content = "",
	reasoningContent = "",
	finishReason = null,
	toolCalls = [],
}: ChunkOptions): SuperMagicChunkMessage {
	return {
		magic_message_id: `magic-chunk-${topicId}-${superMessageId}-${i}`,
		app_message_id: `app-chunk-${topicId}-${superMessageId}-${i}`,
		type: IntermediateMessageType.SuperMagicChunk,
		project_id: "project-super-message",
		topic_id: topicId,
		chat_topic_id: topicId,
		message_id: `completion-${topicId}-${superMessageId}`,
		super_magic_chunk: {
			super_message_id: superMessageId,
			task_id: taskId,
			i,
			usage: null,
			correlation_id: correlationId,
			choices: [
				{
					...({ index: 0 } as const),
					finish_reason: finishReason,
					delta: {
						content,
						role: "assistant",
						tool_calls: toolCalls,
						reasoning_content: reasoningContent,
						index: 0,
					},
				},
			],
		},
	}
}

function createToolCall({
	id = "tool-super-message",
	index = 0,
	name = "read_file",
	arguments: argumentsValue = '{"path":"README.md"}',
}: {
	id?: string
	index?: number
	name?: string
	arguments?: string
} = {}): ChunkToolCall {
	return {
		id,
		index,
		type: "function",
		function: {
			name,
			arguments: argumentsValue,
		},
	}
}

function createFinalEnvelope({
	topicId = TOPIC_A,
	appMessageId,
	superMessageId,
	includeSuperMessageId = true,
	correlationId,
	seqId,
	role = "assistant",
	content,
}: FinalEnvelopeOptions): RawSuperMagicMessageEnvelope {
	const node: SuperMagicNode = {
		role,
		topic_id: topicId,
		message_id: `node-${appMessageId}`,
		correlation_id: correlationId,
		content,
		reasoning_content: null,
		tool_calls: role === "assistant" ? [] : null,
		status: "finished",
		send_timestamp: Number(seqId),
	}
	if (includeSuperMessageId) node.super_message_id = superMessageId

	const envelope = {
		type: SeqRecordType.seq,
		seq: {
			magic_id: "magic-user-super-message",
			seq_id: seqId,
			message_id: `server-${seqId}-${appMessageId}`,
			refer_message_id: "",
			sender_message_id: "",
			conversation_id: "conversation-super-message",
			organization_code: "organization-super-message",
			message: {
				magic_message_id: `magic-${appMessageId}`,
				app_message_id: appMessageId,
				sender_id: role === "user" ? "user-1" : "assistant-1",
				send_time: Number(seqId),
				status: ConversationMessageStatus.Read,
				unread_count: 0,
				topic_id: topicId,
				type: ConversationMessageType.SuperMagicMessage,
				super_magic_message: node,
			},
		},
	} satisfies SeqRecord<SuperMagicConversationMessageV2>

	// Runtime accepts V2, while RawSuperMagicMessageEnvelope still omits that variant.
	return envelope as unknown as RawSuperMagicMessageEnvelope
}

function createStore(activeTopicId = TOPIC_A): SuperMagicStore {
	const store = new SuperMagicStore()
	store.setActiveTopicId(activeTopicId)
	return store
}

function settleRendering(milliseconds = RENDER_SETTLE_MS): void {
	vi.advanceTimersByTime(milliseconds)
}

function getMessages(store: SuperMagicStore, topicId = TOPIC_A): ProjectedMessage[] {
	return Array.from(store.messages.get(topicId) ?? []) as ProjectedMessage[]
}

function getConversationOrder(store: SuperMagicStore, topicId = TOPIC_A): string[] {
	return getMessages(store, topicId)
		.filter((message) => message.role === "user" || message.role === "assistant")
		.map((message) => message.app_message_id || "missing-app-message-id")
}

describe("SuperMagic 协议身份字段", () => {
	it("约束新版 chunk 的 super_message_id 与 task_id 为必填字符串", () => {
		expectTypeOf<SuperMagicChunkPayload["super_message_id"]>().toEqualTypeOf<string>()
		expectTypeOf<SuperMagicChunkPayload["task_id"]>().toEqualTypeOf<string>()
	})

	it("允许历史 Final 缺少 super_message_id，以便 Store 用 app_message_id 归一化", () => {
		expectTypeOf<SuperMagicNode["super_message_id"]>().toEqualTypeOf<string | undefined>()
	})
})

describe("SuperMagicStore / SuperMessage ID 黑盒契约", () => {
	it("normalizes a type-less general_agent_card envelope before deriving identity", () => {
		const envelope = createFinalEnvelope({
			appMessageId: "assistant-revision",
			superMessageId: "assistant-logical-id",
			correlationId: "correlation-1",
			seqId: "10",
			content: "assistant content",
		})
		const message = envelope.seq.message as unknown as Record<string, unknown>
		message.general_agent_card = message.super_magic_message
		delete message.type
		delete message.super_magic_message

		const node = getRawMessageNode(message as never)
		const transformed = transformRawMessage(envelope.seq as never)

		expect(node).toMatchObject({
			role: "assistant",
			super_message_id: "assistant-logical-id",
		})
		expect(transformed).toMatchObject({
			app_message_id: "assistant-revision",
			super_message_id: "assistant-logical-id",
			role: "assistant",
		})
	})
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.clearAllTimers()
		vi.useRealTimers()
	})

	it("D01/D02/D03：同 Topic、同 super_message_id 的不同 app/correlation 按高 seq 收敛", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "assistant-old-app",
				superMessageId: "assistant-shared-super",
				correlationId: "assistant-old-correlation",
				seqId: "100",
				content: "old",
			}),
		)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "assistant-new-app",
				superMessageId: "assistant-shared-super",
				correlationId: "assistant-new-correlation",
				seqId: "101",
				content: "new",
			}),
		)
		settleRendering()

		const assistants = getMessages(store).filter((message) => message.role === "assistant")
		expect(assistants).toEqual([
			expect.objectContaining({
				app_message_id: "assistant-new-app",
				super_message_id: "assistant-shared-super",
				correlation_id: "assistant-new-correlation",
				seq_id: "101",
			}),
		])
		expect(store.getMessageNode("assistant-shared-super")).toMatchObject({
			app_message_id: "assistant-new-app",
			super_message_id: "assistant-shared-super",
			content: "new",
		})
	})

	it("UI key 在同 super_message_id 的 app/correlation/seq revision 中保持稳定", () => {
		const store = createStore()
		const superMessageId = "ui-stable-super-message"

		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "ui-old-app",
				superMessageId,
				correlationId: "ui-old-correlation",
				seqId: "100",
				content: "old UI revision",
			}),
		)
		settleRendering()
		const firstCard = getMessages(store).find((message) => message.role === "assistant")
		const firstKey = getMessageNodeKey(firstCard)
		expect.soft(firstKey).toBe(superMessageId)

		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "ui-new-app",
				superMessageId,
				correlationId: "ui-new-correlation",
				seqId: "200",
				content: "new UI revision",
			}),
		)
		settleRendering()

		const cards = getMessages(store).filter((message) => message.role === "assistant")
		expect.soft(cards).toHaveLength(1)
		expect.soft(getMessageNodeKey(cards[0])).toBe(firstKey)
		expect.soft(getMessageNodeKey(cards[0])).toBe(superMessageId)
		expect.soft(cards[0]).toMatchObject({
			app_message_id: "ui-new-app",
			correlation_id: "ui-new-correlation",
			seq_id: "200",
		})
	})

	it("D03：同 correlation_id、不同 super_message_id 的 Assistant 不得合并", () => {
		const store = createStore()

		for (const [appMessageId, superMessageId, seqId, content] of [
			["assistant-app-a", "assistant-super-a", "100", "message A"],
			["assistant-app-b", "assistant-super-b", "101", "message B"],
		] as const) {
			store.enqueueMessage(
				TOPIC_A,
				createFinalEnvelope({
					appMessageId,
					superMessageId,
					correlationId: "shared-tool-correlation",
					seqId,
					content,
				}),
			)
		}
		settleRendering()

		expect(
			getMessages(store)
				.filter((message) => message.role === "assistant")
				.map((message) => message.super_message_id),
		).toEqual(["assistant-super-a", "assistant-super-b"])
	})

	it("原始跨轮次竞态：B 的迟到 Chunk 保持原 super_message_id，并按真实 seq 排在新 User 之前", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "user-a",
				superMessageId: "user-a-super",
				correlationId: "user-a-correlation",
				seqId: "100",
				role: "user",
				content: "first question",
			}),
		)
		settleRendering()

		// Message A 先完整经历 reasoning、content 与 tool_call，确保后续 B/C 不是首轮简化夹具。
		store.receiveChunk(
			createChunk({
				superMessageId: "assistant-a-super",
				correlationId: "assistant-a-correlation",
				i: 0,
				reasoningContent: "reasoning A",
			}),
		)
		store.receiveChunk(
			createChunk({
				superMessageId: "assistant-a-super",
				correlationId: "assistant-a-correlation",
				i: 1,
				content: "content A",
			}),
		)
		store.receiveChunk(
			createChunk({
				superMessageId: "assistant-a-super",
				correlationId: "assistant-a-correlation",
				i: 2,
				toolCalls: [createToolCall({ id: "tool-a" })],
			}),
		)
		settleRendering()
		expect(
			getMessages(store).find((message) => message.super_message_id === "assistant-a-super")
				?.tool_calls,
		).toEqual([expect.objectContaining({ id: "tool-a" })])
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "assistant-a-final-app",
				superMessageId: "assistant-a-super",
				correlationId: "assistant-a-correlation",
				seqId: "120",
				content: "content A",
			}),
		)
		settleRendering()

		store.receiveChunk(
			createChunk({
				superMessageId: "assistant-b-super",
				correlationId: "assistant-b-correlation",
				i: 0,
				reasoningContent: "reasoning B starts",
			}),
		)
		settleRendering(32)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "user-b",
				superMessageId: "user-b-super",
				correlationId: "user-b-correlation",
				seqId: "200",
				role: "user",
				content: "second question",
			}),
		)
		settleRendering()

		// 用户消息插入后，B 的后续 reasoning/content 才迟到；C 才是新一轮 Assistant。
		store.receiveChunk(
			createChunk({
				superMessageId: "assistant-b-super",
				correlationId: "assistant-b-correlation",
				i: 1,
				reasoningContent: " reasoning B resumes",
			}),
		)
		store.receiveChunk(
			createChunk({
				superMessageId: "assistant-b-super",
				correlationId: "assistant-b-correlation",
				i: 2,
				content: "content B",
			}),
		)
		store.receiveChunk(
			createChunk({
				superMessageId: "assistant-c-super",
				correlationId: "assistant-c-correlation",
				i: 0,
				reasoningContent: "reasoning C starts",
			}),
		)
		settleRendering()

		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "assistant-b-final-app",
				superMessageId: "assistant-b-super",
				correlationId: "assistant-b-correlation",
				seqId: "150",
				content: "content B",
			}),
		)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "assistant-c-final-app",
				superMessageId: "assistant-c-super",
				correlationId: "assistant-c-correlation",
				seqId: "250",
				content: "content C",
			}),
		)
		settleRendering()

		const messages = getMessages(store)
		expect(
			messages.map(({ role, app_message_id, super_message_id, seq_id }) => ({
				role,
				app_message_id,
				super_message_id,
				seq_id,
			})),
		).toEqual([
			{ role: "user", app_message_id: "user-a", super_message_id: "user-a", seq_id: "100" },
			{
				role: "assistant",
				app_message_id: "assistant-a-final-app",
				super_message_id: "assistant-a-super",
				seq_id: "120",
			},
			{
				role: "assistant",
				app_message_id: "assistant-b-final-app",
				super_message_id: "assistant-b-super",
				seq_id: "150",
			},
			{ role: "user", app_message_id: "user-b", super_message_id: "user-b", seq_id: "200" },
			{
				role: "assistant",
				app_message_id: "assistant-c-final-app",
				super_message_id: "assistant-c-super",
				seq_id: "250",
			},
		])
		const superMessageIds = messages.map((message) => message.super_message_id)
		expect(new Set(superMessageIds).size).toBe(messages.length)
		expect(messages.some((message) => message.app_message_id === "assistant-b-super")).toBe(
			false,
		)
		expect(store.getMessageNode("assistant-b-final-app")).toBeUndefined()
		expect(
			getMessages(store).filter(
				(message) => message.super_message_id === "assistant-b-super",
			),
		).toEqual([
			expect.objectContaining({
				app_message_id: "assistant-b-final-app",
				seq_id: "150",
				content: "content B",
			}),
		])
	})

	it("同 correlation、不同 super_message_id 的两个 Chunk 流交错到达时保持独立", () => {
		const store = createStore()
		const sharedCorrelationId = "shared-interleaved-correlation"

		store.receiveChunk(
			createChunk({
				superMessageId: "interleaved-super-a",
				correlationId: sharedCorrelationId,
				i: 0,
				reasoningContent: "reasoning A",
			}),
		)
		store.receiveChunk(
			createChunk({
				superMessageId: "interleaved-super-b",
				correlationId: sharedCorrelationId,
				i: 0,
				reasoningContent: "reasoning B",
			}),
		)
		store.receiveChunk(
			createChunk({
				superMessageId: "interleaved-super-a",
				correlationId: sharedCorrelationId,
				i: 1,
				content: "content A",
			}),
		)
		store.receiveChunk(
			createChunk({
				superMessageId: "interleaved-super-b",
				correlationId: sharedCorrelationId,
				i: 1,
				content: "content B",
			}),
		)
		settleRendering()

		expect(
			getMessages(store)
				.filter((message) => message.role === "assistant")
				.map((message) => ({
					superMessageId: message.super_message_id,
					content: message.content,
					reasoningContent: message.reasoning_content,
				})),
		).toEqual([
			{
				superMessageId: "interleaved-super-a",
				content: "content A",
				reasoningContent: "reasoning A",
			},
			{
				superMessageId: "interleaved-super-b",
				content: "content B",
				reasoningContent: "reasoning B",
			},
		])
		expect(store.getStreamState(TOPIC_A, "interleaved-super-a")?.content).toBe("content A")
		expect(store.getStreamState(TOPIC_A, "interleaved-super-b")?.content).toBe("content B")
	})

	it("同 super_message_id 的 Chunk 即使 correlation_id 中途变化也收敛为同一 Assistant", () => {
		const store = createStore()

		store.receiveChunk(
			createChunk({
				superMessageId: "correlation-drift-super",
				correlationId: "correlation-before-drift",
				i: 0,
				reasoningContent: "reasoning before drift",
			}),
		)
		store.receiveChunk(
			createChunk({
				superMessageId: "correlation-drift-super",
				correlationId: "correlation-after-drift",
				i: 1,
				content: "content after drift",
			}),
		)
		settleRendering()

		expect(
			getMessages(store).filter(
				(message) => message.super_message_id === "correlation-drift-super",
			),
		).toEqual([
			expect.objectContaining({
				content: "content after drift",
				reasoning_content: "reasoning before drift",
			}),
		])
		expect(store.getStreamState(TOPIC_A, "correlation-drift-super")).toMatchObject({
			content: "content after drift",
			reasoning_content: "reasoning before drift",
		})
	})

	it("ToolCall Message 与 Final Message 复用 correlation 时按不同 super_message_id 保持两张卡片", () => {
		const store = createStore()
		const sharedCorrelationId = "tool-final-shared-correlation"

		store.receiveChunk(
			createChunk({
				superMessageId: "tool-call-super",
				correlationId: sharedCorrelationId,
				toolCalls: [createToolCall({ id: "tool-call-id" })],
			}),
		)
		settleRendering()
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "final-answer-app",
				superMessageId: "final-answer-super",
				correlationId: sharedCorrelationId,
				seqId: "200",
				content: "final answer",
			}),
		)
		settleRendering()

		const assistants = getMessages(store).filter((message) => message.role === "assistant")
		expect(assistants.map((message) => message.super_message_id)).toEqual([
			"tool-call-super",
			"final-answer-super",
		])
		expect(
			assistants.find((message) => message.super_message_id === "tool-call-super")
				?.tool_calls,
		).toEqual([expect.objectContaining({ id: "tool-call-id" })])
		expect(
			assistants.find((message) => message.super_message_id === "final-answer-super"),
		).toMatchObject({ app_message_id: "final-answer-app", content: "final answer" })
	})

	it("Final 先到后迟到 Chunk：同 super_message_id 不因 correlation 变化重开流", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "canonical-final-app",
				superMessageId: "final-first-super",
				correlationId: "final-first-correlation",
				seqId: "200",
				content: "canonical final",
			}),
		)
		settleRendering()
		store.receiveChunk(
			createChunk({
				superMessageId: "final-first-super",
				correlationId: "late-chunk-correlation",
				i: 0,
				content: "stale late chunk",
			}),
		)
		settleRendering()

		expect(
			getMessages(store).filter(
				(message) => message.super_message_id === "final-first-super",
			),
		).toEqual([
			expect.objectContaining({
				app_message_id: "canonical-final-app",
				seq_id: "200",
				content: "canonical final",
			}),
		])
		expect(store.getStreamState(TOPIC_A, "final-first-super")).toBeUndefined()
		expect(store.isTopicStreaming(TOPIC_A)).toBe(false)
	})

	it("历史 Final fallback identity 可与新版显式 super_message_id 的高 seq revision 收敛", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "legacy-fallback-id",
				includeSuperMessageId: false,
				correlationId: "legacy-correlation",
				seqId: "100",
				content: "legacy content",
			}),
		)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "new-revision-app",
				superMessageId: "legacy-fallback-id",
				correlationId: "new-revision-correlation",
				seqId: "101",
				content: "new revision content",
			}),
		)
		settleRendering()

		expect(
			getMessages(store).filter(
				(message) => message.super_message_id === "legacy-fallback-id",
			),
		).toEqual([
			expect.objectContaining({
				app_message_id: "new-revision-app",
				correlation_id: "new-revision-correlation",
				seq_id: "101",
				content: "new revision content",
			}),
		])
	})

	it("刷新 initialMessages 后 WS 重放同一 super_message_id 不重复卡片或回退真实 seq", () => {
		const store = createStore()
		const canonicalFinal = createFinalEnvelope({
			appMessageId: "refresh-canonical-app",
			superMessageId: "refresh-replay-super",
			correlationId: "refresh-canonical-correlation",
			seqId: "200",
			content: "refresh canonical content",
		})

		store.initializeMessages(TOPIC_A, [canonicalFinal])
		store.receiveChunk(
			createChunk({
				superMessageId: "refresh-replay-super",
				correlationId: "refresh-replayed-correlation",
				i: 0,
				content: "replayed stale chunk",
			}),
		)
		store.enqueueMessage(TOPIC_A, canonicalFinal)
		settleRendering()

		expect(
			getMessages(store).filter(
				(message) => message.super_message_id === "refresh-replay-super",
			),
		).toEqual([
			expect.objectContaining({
				app_message_id: "refresh-canonical-app",
				seq_id: "200",
				content: "refresh canonical content",
			}),
		])
		expect(store.getLatestMessageSeqId(TOPIC_A)).toBe("200")
		expect(store.isTopicStreaming(TOPIC_A)).toBe(false)
	})

	it("相同 task_id 下的不同 super_message_id 仍是独立 Assistant", () => {
		const store = createStore()
		const sharedTaskId = "shared-task-not-message-identity"

		store.receiveChunk(
			createChunk({
				superMessageId: "task-shared-super-a",
				taskId: sharedTaskId,
				correlationId: "task-shared-correlation-a",
				content: "message A",
			}),
		)
		store.receiveChunk(
			createChunk({
				superMessageId: "task-shared-super-b",
				taskId: sharedTaskId,
				correlationId: "task-shared-correlation-b",
				content: "message B",
			}),
		)
		settleRendering()

		expect(
			getMessages(store)
				.filter((message) => message.role === "assistant")
				.map((message) => message.super_message_id),
		).toEqual(["task-shared-super-a", "task-shared-super-b"])
		expect(store.getStreamState(TOPIC_A, "task-shared-super-a")).toMatchObject({
			super_message_id: "task-shared-super-a",
			correlation_id: "task-shared-correlation-a",
			task_id: sharedTaskId,
		})
		expect(store.getMessageNode("task-shared-super-a")).toMatchObject({
			super_message_id: "task-shared-super-a",
			correlation_id: "task-shared-correlation-a",
			task_id: sharedTaskId,
		})
		expect(
			getMessages(store).find(
				(message) => message.super_message_id === "task-shared-super-a",
			),
		).toMatchObject({ task_id: sharedTaskId })
	})

	it("D04：历史 Final 缺少 super_message_id 时用 app_message_id 补齐且保留真实 app_message_id", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "legacy-assistant-app",
				includeSuperMessageId: false,
				correlationId: "legacy-assistant-correlation",
				seqId: "100",
				content: "legacy final",
			}),
		)
		settleRendering()

		expect(getMessages(store)).toEqual([
			expect.objectContaining({
				app_message_id: "legacy-assistant-app",
				super_message_id: "legacy-assistant-app",
			}),
		])
		expect(store.getMessageNode("legacy-assistant-app")).toMatchObject({
			app_message_id: "legacy-assistant-app",
			super_message_id: "legacy-assistant-app",
		})
	})

	it("三类消息统一归一化 super_message_id，并且查询只依赖该字段", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "user-app-id",
				superMessageId: "ignored-user-super-id",
				correlationId: "user-correlation",
				seqId: "100",
				role: "user",
				content: "user message",
			}),
		)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "tool-app-id",
				superMessageId: "tool-backend-super-id",
				correlationId: "shared-tool-final-correlation",
				seqId: "110",
				role: "tool",
				content: "tool response",
			}),
		)
		settleRendering()

		const messages = getMessages(store)
		expect(messages).toEqual([
			expect.objectContaining({
				role: "user",
				app_message_id: "user-app-id",
				super_message_id: "user-app-id",
			}),
			expect.objectContaining({
				role: "tool",
				app_message_id: "tool-app-id",
				super_message_id: "tool-backend-super-id",
			}),
		])
		expect(store.getMessageNode("user-app-id")).toMatchObject({ role: "user" })
		expect(store.getMessageNode("tool-backend-super-id")).toMatchObject({
			role: "tool",
			app_message_id: "tool-app-id",
			super_message_id: "tool-backend-super-id",
		})
		expect(store.messageMap.has("tool-app-id")).toBe(false)
	})

	it("D01：不同 Topic 可以复用同一 super_message_id", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "topic-a-app",
				superMessageId: "cross-topic-shared-super",
				correlationId: "topic-a-correlation",
				seqId: "100",
				content: "topic A",
			}),
		)
		store.enqueueMessage(
			TOPIC_B,
			createFinalEnvelope({
				topicId: TOPIC_B,
				appMessageId: "topic-b-app",
				superMessageId: "cross-topic-shared-super",
				correlationId: "topic-b-correlation",
				seqId: "100",
				content: "topic B",
			}),
		)
		settleRendering()

		expect(getMessages(store, TOPIC_A)).toEqual([
			expect.objectContaining({ app_message_id: "topic-a-app" }),
		])
		expect(getMessages(store, TOPIC_B)).toEqual([
			expect.objectContaining({ app_message_id: "topic-b-app" }),
		])
		expect(
			getMessages(store, TOPIC_A).find(
				(message) => message.super_message_id === "cross-topic-shared-super",
			),
		).toMatchObject({ app_message_id: "topic-a-app", content: "topic A" })
		expect(
			getMessages(store, TOPIC_B).find(
				(message) => message.super_message_id === "cross-topic-shared-super",
			),
		).toMatchObject({ app_message_id: "topic-b-app", content: "topic B" })
		expect(store.getMessageNode("cross-topic-shared-super")).toMatchObject({
			app_message_id: "topic-b-app",
			content: "topic B",
		})
	})

	it("清理 Topic A 不得污染 Topic B 中复用的同一 super_message_id", () => {
		const store = createStore()
		const sharedSuperMessageId = "cleanup-cross-topic-shared-super"

		store.initializeMessages(TOPIC_A, [
			createFinalEnvelope({
				appMessageId: "cleanup-topic-a-app",
				superMessageId: sharedSuperMessageId,
				correlationId: "cleanup-topic-a-correlation",
				seqId: "100",
				content: "topic A before cleanup",
			}),
		])
		store.initializeMessages(TOPIC_B, [
			createFinalEnvelope({
				topicId: TOPIC_B,
				appMessageId: "cleanup-topic-b-app",
				superMessageId: sharedSuperMessageId,
				correlationId: "cleanup-topic-b-correlation",
				seqId: "100",
				content: "topic B survives cleanup",
			}),
		])

		store.initializeMessages(TOPIC_A, [])

		expect(getMessages(store, TOPIC_A)).toEqual([])
		expect(getMessages(store, TOPIC_B)).toEqual([
			expect.objectContaining({
				app_message_id: "cleanup-topic-b-app",
				debug: expect.objectContaining({
					super_message_id: sharedSuperMessageId,
					content: "topic B survives cleanup",
				}),
			}),
		])
	})

	it("D05：Final 用同一 super_message_id 接管占位、替换真实 seq 并重新排序", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "user-a",
				superMessageId: "user-a-super",
				correlationId: "user-a-correlation",
				seqId: "100",
				role: "user",
				content: "first question",
			}),
		)
		settleRendering()
		store.receiveChunk(
			createChunk({
				superMessageId: "assistant-b-super",
				correlationId: "assistant-b-stream-correlation",
				reasoningContent: "draft B",
			}),
		)
		settleRendering(32)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "user-b",
				superMessageId: "user-b-super",
				correlationId: "user-b-correlation",
				seqId: "200",
				role: "user",
				content: "second question",
			}),
		)
		settleRendering()
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "assistant-b-final-app",
				superMessageId: "assistant-b-super",
				correlationId: "assistant-b-final-correlation",
				seqId: "150",
				content: "final B",
			}),
		)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "assistant-c-final-app",
				superMessageId: "assistant-c-super",
				correlationId: "assistant-c-correlation",
				seqId: "250",
				content: "final C",
			}),
		)
		settleRendering()

		expect(getConversationOrder(store)).toEqual([
			"user-a",
			"assistant-b-final-app",
			"user-b",
			"assistant-c-final-app",
		])
		expect(
			getMessages(store).find((message) => message.super_message_id === "assistant-b-super"),
		).toMatchObject({
			app_message_id: "assistant-b-final-app",
			seq_id: "150",
		})
		expect(store.getMessageNode("assistant-b-super")).toMatchObject({ content: "final B" })
	})

	it("D06：initializeMessages 仅按服务端真实 seq 恢复 B 的列表位置", () => {
		const store = createStore()

		store.initializeMessages(TOPIC_A, [
			createFinalEnvelope({
				appMessageId: "assistant-c-final-app",
				superMessageId: "assistant-c-super",
				correlationId: "assistant-c-correlation",
				seqId: "250",
				content: "final C",
			}),
			createFinalEnvelope({
				appMessageId: "user-b",
				superMessageId: "user-b-super",
				correlationId: "user-b-correlation",
				seqId: "200",
				role: "user",
				content: "second question",
			}),
			createFinalEnvelope({
				appMessageId: "assistant-b-final-app",
				superMessageId: "assistant-b-super",
				correlationId: "assistant-b-final-correlation",
				seqId: "150",
				content: "final B",
			}),
			createFinalEnvelope({
				appMessageId: "user-a",
				superMessageId: "user-a-super",
				correlationId: "user-a-correlation",
				seqId: "100",
				role: "user",
				content: "first question",
			}),
		])

		const messages = getMessages(store)
		expect(messages.map((message) => message.seq_id)).toEqual(["100", "150", "200", "250"])
		expect(
			messages.map(({ role, app_message_id, super_message_id, seq_id }) => ({
				role,
				app_message_id,
				super_message_id,
				seq_id,
			})),
		).toEqual([
			{ role: "user", app_message_id: "user-a", super_message_id: "user-a", seq_id: "100" },
			{
				role: "assistant",
				app_message_id: "assistant-b-final-app",
				super_message_id: "assistant-b-super",
				seq_id: "150",
			},
			{ role: "user", app_message_id: "user-b", super_message_id: "user-b", seq_id: "200" },
			{
				role: "assistant",
				app_message_id: "assistant-c-final-app",
				super_message_id: "assistant-c-super",
				seq_id: "250",
			},
		])
		expect(new Set(messages.map((message) => message.super_message_id)).size).toBe(
			messages.length,
		)
		expect(messages.some((message) => message.app_message_id === "assistant-b-super")).toBe(
			false,
		)
		expect(store.getMessageNode("assistant-b-final-app")).toBeUndefined()
	})
})
