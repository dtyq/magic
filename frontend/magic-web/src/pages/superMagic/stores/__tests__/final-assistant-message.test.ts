import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { autorun } from "mobx"
import { SeqRecordType, type SeqRecord } from "@/apis/modules/chat/types"
import {
	getMessageNodeKey,
	messagesConverter,
} from "@/pages/superMagic/components/MessageList/helpers"
import { SuperMagicStore } from "@/pages/superMagic/stores"
import type {
	MessageCommittedEvent,
	MessageStreamEndedEvent,
} from "@/pages/superMagic/stores/events"
import type {
	RawSuperMagicMessageEnvelope,
	StreamRecoveryRequestPayload,
	TokenUsage,
} from "@/pages/superMagic/stores/types"
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

const TOPIC_ID = "topic-final"
const CORRELATION_ID = "correlation-final"
const SUPER_MESSAGE_ID = "super-message-final"
const RENDER_SETTLE_MS = 2_000
const NO_WATCHDOG_OBSERVATION_MS = 5_100

type ChunkChoice = SuperMagicChunkMessage["super_magic_chunk"]["choices"][number]
type ChunkToolCall = ChunkChoice["delta"]["tool_calls"][number]
type ChunkUsage = NonNullable<SuperMagicChunkMessage["super_magic_chunk"]["usage"]>

interface ProjectedToolCall {
	id?: string
	index?: number
	type?: string
	function?: {
		name?: string
		arguments?: string
	}
	tool?: {
		id?: string
		name?: string
		status?: string
	}
}

interface ProjectedNode {
	app_message_id?: string
	super_message_id?: string
	role?: string
	content?: string | null
	reasoning_content?: string | null
	message_id?: string
	correlation_id?: string
	status?: string
	event?: string
	tool_calls?: ProjectedToolCall[] | null
	tool?: {
		id?: string
		status?: string
	} | null
	token_usage?: TokenUsage | null
	usage?: unknown
	attachments?: unknown[] | null
}

interface ChunkOptions {
	i?: number
	content?: string
	reasoningContent?: string
	correlationId?: string
	superMessageId?: string
	finishReason?: ChunkChoice["finish_reason"]
	toolCalls?: ChunkToolCall[]
	usage?: ChunkUsage | null
	choices?: ChunkChoice[]
}

interface FinalEnvelopeOptions {
	appMessageId?: string
	correlationId?: string
	superMessageId?: string
	seqId?: string
	content?: string | null
	includeContent?: boolean
	includeToolCalls?: boolean
	toolCalls?: ProjectedToolCall[] | null
	nodeStatus?: string
	tokenUsage?: TokenUsage | null
	includeTokenUsage?: boolean
	nodeExtra?: Record<string, unknown>
}

interface ToolEnvelopeOptions {
	appMessageId?: string
	correlationId?: string
	seqId?: string
	toolId?: string
	status?: string
}

function createTokenUsage(totalTokens: number): TokenUsage {
	return {
		input_tokens: Math.max(totalTokens - 2, 0),
		output_tokens: Math.min(totalTokens, 2),
		total_tokens: totalTokens,
		model_id: "test-model",
		input_tokens_details: {
			cached_tokens: 0,
			cache_write_tokens: 0,
		},
		request_id: `request-${totalTokens}`,
	}
}

function createChunk({
	i = 0,
	content = "",
	reasoningContent = "",
	correlationId = CORRELATION_ID,
	superMessageId = SUPER_MESSAGE_ID,
	finishReason = null,
	toolCalls = [],
	usage = null,
	choices,
}: ChunkOptions = {}): SuperMagicChunkMessage {
	return {
		magic_message_id: `magic-chunk-${i}`,
		app_message_id: `app-chunk-${i}`,
		type: IntermediateMessageType.SuperMagicChunk,
		project_id: "project-1",
		topic_id: TOPIC_ID,
		chat_topic_id: TOPIC_ID,
		message_id: "completion-final",
		super_magic_chunk: {
			super_message_id: superMessageId,
			task_id: `task-${correlationId}`,
			i,
			usage,
			correlation_id: correlationId,
			choices: choices ?? [
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
	id = "tool-1",
	index = 0,
	name = "read_file",
	arguments: argumentsValue = '{"path":"README.md"}',
	status,
}: {
	id?: string
	index?: number
	name?: string
	arguments?: string
	status?: string
} = {}): ChunkToolCall & ProjectedToolCall {
	return {
		id,
		index,
		type: "function",
		function: {
			name,
			arguments: argumentsValue,
		},
		...(status
			? {
					tool: {
						id,
						name,
						status,
					},
				}
			: {}),
	}
}

function createFinalEnvelope({
	appMessageId = "final-app-1",
	correlationId = CORRELATION_ID,
	superMessageId = SUPER_MESSAGE_ID,
	seqId = "100",
	content = "canonical",
	includeContent = true,
	includeToolCalls = true,
	toolCalls = [],
	nodeStatus = "finished",
	tokenUsage = null,
	includeTokenUsage = true,
	nodeExtra = {},
}: FinalEnvelopeOptions = {}): RawSuperMagicMessageEnvelope {
	const node: SuperMagicNode = {
		role: "assistant",
		topic_id: TOPIC_ID,
		message_id: `node-${appMessageId}`,
		super_message_id: superMessageId,
		correlation_id: correlationId,
		reasoning_content: null,
		status: nodeStatus,
		send_timestamp: Number(seqId) || 1,
		...nodeExtra,
	}
	if (includeContent) {
		// The runtime protocol distinguishes an explicit null from an omitted field;
		// keep that distinction in the fixture so the test can assert normalization.
		node.content = content as unknown as string
	}
	if (includeToolCalls) node.tool_calls = toolCalls
	if (includeTokenUsage) node.token_usage = tokenUsage

	const envelope = {
		type: SeqRecordType.seq,
		seq: {
			magic_id: "magic-user-1",
			seq_id: seqId,
			message_id: `server-${seqId}-${appMessageId}`,
			refer_message_id: "",
			sender_message_id: "",
			conversation_id: "conversation-1",
			organization_code: "organization-1",
			message: {
				magic_message_id: `magic-${appMessageId}`,
				app_message_id: appMessageId,
				sender_id: "assistant-1",
				send_time: Number(seqId) || 1,
				status: ConversationMessageStatus.Read,
				unread_count: 0,
				topic_id: TOPIC_ID,
				type: ConversationMessageType.SuperMagicMessage,
				super_magic_message: node,
			},
		},
	} satisfies SeqRecord<SuperMagicConversationMessageV2>

	// Runtime accepts V2, while RawSuperMagicMessageEnvelope still omits that variant.
	return envelope as unknown as RawSuperMagicMessageEnvelope
}

function createToolEnvelope({
	appMessageId = "tool-response-1",
	correlationId = CORRELATION_ID,
	seqId = "101",
	toolId = "tool-1",
	status = "finished",
}: ToolEnvelopeOptions = {}): RawSuperMagicMessageEnvelope {
	const node: SuperMagicNode = {
		role: "tool",
		topic_id: TOPIC_ID,
		message_id: `node-${appMessageId}`,
		correlation_id: correlationId,
		content: null,
		reasoning_content: null,
		tool_calls: null,
		tool_call_id: toolId,
		tool: {
			id: toolId,
			name: "read_file",
			status,
		},
		status: "running",
		send_timestamp: Number(seqId),
	}
	const envelope = {
		type: SeqRecordType.seq,
		seq: {
			magic_id: "magic-user-1",
			seq_id: seqId,
			message_id: `server-${seqId}-${appMessageId}`,
			refer_message_id: "",
			sender_message_id: "",
			conversation_id: "conversation-1",
			organization_code: "organization-1",
			message: {
				magic_message_id: `magic-${appMessageId}`,
				app_message_id: appMessageId,
				sender_id: "assistant-1",
				send_time: Number(seqId),
				status: ConversationMessageStatus.Read,
				unread_count: 0,
				topic_id: TOPIC_ID,
				type: ConversationMessageType.SuperMagicMessage,
				super_magic_message: node,
			},
		},
	} satisfies SeqRecord<SuperMagicConversationMessageV2>

	return envelope as unknown as RawSuperMagicMessageEnvelope
}

function cloneEnvelope(envelope: RawSuperMagicMessageEnvelope): RawSuperMagicMessageEnvelope {
	return JSON.parse(JSON.stringify(envelope)) as RawSuperMagicMessageEnvelope
}

function createStore(): SuperMagicStore {
	const store = new SuperMagicStore()
	store.setActiveTopicId(TOPIC_ID)
	return store
}

function getNode(store: SuperMagicStore, superMessageId: string): ProjectedNode | undefined {
	const directNode = store.getMessageNode(superMessageId)
	const node = directNode
	return node && typeof node === "object" ? (node as ProjectedNode) : undefined
}

function getMessageRecords(store: SuperMagicStore): Array<Record<string, unknown>> {
	return Array.from(store.messages.get(TOPIC_ID) ?? []) as Array<Record<string, unknown>>
}

function getAssistantCards(store: SuperMagicStore): ProjectedNode[] {
	return messagesConverter(getMessageRecords(store)).filter(
		(message) =>
			message?.role === "assistant" && message?.super_message_id === SUPER_MESSAGE_ID,
	) as ProjectedNode[]
}

function getCanonicalNodeForCard(
	store: SuperMagicStore,
	card: ProjectedNode | undefined,
): ProjectedNode | undefined {
	// UI cards carry message identity; canonical tool fields remain owned by the public Store API.
	const identity = card?.super_message_id
	return typeof identity === "string" ? getNode(store, identity) : undefined
}

function advanceRendering(milliseconds = RENDER_SETTLE_MS): void {
	vi.advanceTimersByTime(milliseconds)
}

function collectRecoveryRequests(store: SuperMagicStore): {
	events: StreamRecoveryRequestPayload[]
	unsubscribe: () => void
} {
	const events: StreamRecoveryRequestPayload[] = []
	const unsubscribe = store.registerOnStreamRecoveryRequested((payload) => events.push(payload))
	return { events, unsubscribe }
}

function collectTopicArrivals(store: SuperMagicStore): {
	events: MessageCommittedEvent[]
	unsubscribe: () => void
} {
	const events: MessageCommittedEvent[] = []
	const unsubscribe = store.subscribe("message.committed", (event) => events.push(event), {
		scope: { topicId: TOPIC_ID },
	})
	return { events, unsubscribe }
}

describe("SuperMagicStore / 最终 Assistant Message", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.clearAllTimers()
		vi.useRealTimers()
	})

	it("finish_reason 只结束流式动画，未收到 Final 时不主动 watchdog recovery。", () => {
		const store = createStore()
		const recovery = collectRecoveryRequests(store)

		store.receiveChunk(createChunk({ content: "provisional", finishReason: "stop" }))
		advanceRendering()

		expect(getNode(store, SUPER_MESSAGE_ID)?.content).toBe("provisional")
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()

		// D1/D2：finish_reason 不是 canonical Final，后续消息获取或轮询负责 HTTP 兜底；
		// 本地 Store 不应因为缺少 Final 自行发起 recovery 请求。
		vi.advanceTimersByTime(NO_WATCHDOG_OBSERVATION_MS)
		expect(recovery.events).toHaveLength(0)
		recovery.unsubscribe()
	})

	it("最终 assistant message 先于尾部 chunk 到达。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ i: 0, content: "draft" }))
		store.enqueueMessage(TOPIC_ID, createFinalEnvelope({ content: "canonical" }))
		advanceRendering()
		store.receiveChunk(createChunk({ i: 1, content: " late", finishReason: "stop" }))
		advanceRendering(100)

		expect(getNode(store, SUPER_MESSAGE_ID)?.content).toBe("canonical")
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
	})

	it("本地 execution marker 在首个 canonical Final 前保护 finished polling，并由活动流 Final 消费", () => {
		const store = createStore()

		store.beginTopicExecution(TOPIC_ID)
		expect(store.hasPendingTopicExecution(TOPIC_ID)).toBe(true)

		store.receiveChunk(createChunk({ content: "draft" }))
		store.enqueueMessage(TOPIC_ID, createFinalEnvelope({ content: "draft answer" }))

		expect(store.hasPendingTopicExecution(TOPIC_ID)).toBe(false)
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
	})

	it("历史 HTTP Final 没有活动流时不得消费新发送任务的 execution marker", () => {
		const store = createStore()

		store.beginTopicExecution(TOPIC_ID)
		store.initializeMessages(TOPIC_ID, [createFinalEnvelope({ content: "historical final" })])

		expect(store.hasPendingTopicExecution(TOPIC_ID)).toBe(true)
		expect(getNode(store, SUPER_MESSAGE_ID)?.content).toBe("historical final")
	})

	it("多个本地发送按计数消费，且孤立 marker 超时后允许 HTTP recovery", () => {
		const store = createStore()

		store.beginTopicExecution(TOPIC_ID)
		store.beginTopicExecution(TOPIC_ID)
		expect(store.topicMeta.get(TOPIC_ID)?.pendingExecutionCount).toBe(2)

		store.completePendingTopicExecution(TOPIC_ID)
		expect(store.hasPendingTopicExecution(TOPIC_ID)).toBe(true)
		expect(store.topicMeta.get(TOPIC_ID)?.pendingExecutionCount).toBe(1)

		vi.advanceTimersByTime(30_001)
		expect(store.hasPendingTopicExecution(TOPIC_ID)).toBe(false)
		expect(store.topicMeta.get(TOPIC_ID)?.pendingExecutionCount).toBe(0)
	})

	it("旧 TopicMeta 缺少新字段时会先归一化再登记 execution", () => {
		const store = createStore()
		store.topicMeta.set(TOPIC_ID, {} as never)

		store.beginTopicExecution(TOPIC_ID)

		expect(store.topicMeta.get(TOPIC_ID)?.pendingExecutionCount).toBe(1)
		expect(store.hasPendingTopicExecution(TOPIC_ID)).toBe(true)
	})

	it("最终 assistant message 先于 finish_reason 到达。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ i: 0, content: "draft" }))
		store.enqueueMessage(TOPIC_ID, createFinalEnvelope({ content: "canonical" }))
		advanceRendering()
		store.receiveChunk(createChunk({ i: 1, finishReason: "stop" }))
		advanceRendering(100)

		expect(getNode(store, SUPER_MESSAGE_ID)?.content).toBe("canonical")
		expect(store.isTopicStreaming(TOPIC_ID)).toBe(false)
	})

	it("最终 assistant message 到达后，旧 chunk 继续写入。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ i: 0, content: "draft" }))
		store.enqueueMessage(TOPIC_ID, createFinalEnvelope({ content: "canonical" }))
		advanceRendering()
		store.receiveChunk(createChunk({ i: 0, content: "stale replay" }))
		store.receiveChunk(createChunk({ i: 1, content: "stale tail" }))
		advanceRendering(100)

		expect(getNode(store, SUPER_MESSAGE_ID)?.content).toBe("canonical")
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
	})

	it("最终 assistant message 重复到达。", () => {
		const store = createStore()
		const arrivals = collectTopicArrivals(store)
		const finalMessage = createFinalEnvelope()

		store.enqueueMessage(TOPIC_ID, finalMessage)
		store.enqueueMessage(TOPIC_ID, cloneEnvelope(finalMessage))
		advanceRendering()

		expect(arrivals.events).toHaveLength(1)
		expect(getNode(store, SUPER_MESSAGE_ID)?.app_message_id).toBe("final-app-1")
		expect(getAssistantCards(store)).toHaveLength(1)
		arrivals.unsubscribe()
	})

	it("Final 结算后仍暴露独立的视觉追平阶段", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ content: "draft" }))
		advanceRendering(32)
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				content: "draft plus the complete canonical answer",
				seqId: "100",
			}),
		)

		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
		expect(store.getAssistantRenderPhase(TOPIC_ID, SUPER_MESSAGE_ID, CORRELATION_ID)).toBe(
			"content",
		)
		const rendered = store.getRenderedMessageNode(SUPER_MESSAGE_ID, TOPIC_ID) as ProjectedNode
		expect(rendered.content).not.toBe("draft plus the complete canonical answer")

		advanceRendering(2_000)
		expect(
			store.getAssistantRenderPhase(TOPIC_ID, SUPER_MESSAGE_ID, CORRELATION_ID),
		).toBeUndefined()
		expect(
			(store.getRenderedMessageNode(SUPER_MESSAGE_ID, TOPIC_ID) as ProjectedNode).content,
		).toBe("draft plus the complete canonical answer")
	})

	it("Final 视觉追平只唤醒同一 Topic + SuperMessage 的 observer", () => {
		const store = createStore()
		const otherSuperMessageId = "super-message-final-b"

		store.receiveChunk(createChunk({ content: "draft" }))
		advanceRendering(32)
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({ content: "draft canonical answer", seqId: "100" }),
		)
		// The second message has no render-only sidecar; it still subscribes to its own keyed Map entry.
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				superMessageId: otherSuperMessageId,
				correlationId: "correlation-final-b",
				appMessageId: "final-app-b",
				content: "other canonical",
				seqId: "101",
			}),
		)

		let firstRuns = 0
		let secondRuns = 0
		const disposeFirst = autorun(() => {
			firstRuns += 1
			store.getRenderedMessageNode(SUPER_MESSAGE_ID, TOPIC_ID)
		})
		const disposeSecond = autorun(() => {
			secondRuns += 1
			store.getRenderedMessageNode(otherSuperMessageId, TOPIC_ID)
		})
		const initialFirstRuns = firstRuns
		const initialSecondRuns = secondRuns

		vi.advanceTimersByTime(16)

		expect(firstRuns).toBeGreaterThan(initialFirstRuns)
		expect(secondRuns).toBe(initialSecondRuns)
		disposeFirst()
		disposeSecond()
	})

	it("相同 seq 的重复 Final 不会打断正在进行的视觉追平", () => {
		const store = createStore()
		const finalMessage = createFinalEnvelope({
			content: "draft plus the complete canonical answer",
			seqId: "100",
		})

		store.receiveChunk(createChunk({ content: "draft" }))
		advanceRendering(32)
		store.enqueueMessage(TOPIC_ID, finalMessage)
		const beforeDuplicate = store.getRenderedMessageNode(
			SUPER_MESSAGE_ID,
			TOPIC_ID,
		) as ProjectedNode
		expect(beforeDuplicate.content).not.toBe("draft plus the complete canonical answer")

		store.enqueueMessage(TOPIC_ID, cloneEnvelope(finalMessage))
		const afterDuplicate = store.getRenderedMessageNode(
			SUPER_MESSAGE_ID,
			TOPIC_ID,
		) as ProjectedNode
		expect(afterDuplicate.content).toBe(beforeDuplicate.content)
		expect(store.getAssistantRenderPhase(TOPIC_ID, SUPER_MESSAGE_ID, CORRELATION_ID)).toBe(
			"content",
		)
	})

	it("Final transport 插在 chunk 中间时保留尾部流，finish 后再固定 canonical", () => {
		const store = createStore()
		const prefixLength = 1541
		const suffixLength = 823
		const canonicalContent = "d".repeat(prefixLength) + "t".repeat(suffixLength)

		for (let i = 0; i < prefixLength; i += 1) {
			store.receiveChunk(createChunk({ i, content: "d" }))
		}

		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({ content: canonicalContent, seqId: "953723091053199360" }),
		)
		advanceRendering(32)

		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeDefined()
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)?.content).toBe(
			"d".repeat(prefixLength),
		)

		for (let i = prefixLength; i < prefixLength + suffixLength; i += 1) {
			store.receiveChunk(
				createChunk({
					i,
					content: "t",
					...(i === prefixLength + suffixLength - 1 ? { finishReason: "stop" } : {}),
				}),
			)
		}
		expect(getNode(store, SUPER_MESSAGE_ID)?.content).toBe(canonicalContent)
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
	})

	it("Final 屏障在接收入口最前面生效，不让迟到 chunk 重写 correlation sidecar", () => {
		const store = createStore()
		store.enqueueMessage(TOPIC_ID, createFinalEnvelope({ content: "canonical" }))

		store.receiveChunk(
			createChunk({
				correlationId: "late-correlation",
				content: "late mutation",
			}),
		)

		const streamCorrelationIds = (
			store as unknown as { streamCorrelationIds: Map<string, string> }
		).streamCorrelationIds
		expect(streamCorrelationIds.size).toBe(0)
	})

	it("同一个 correlation 收到两个不同的最终 assistant message。", () => {
		const store = createStore()
		const arrivals = collectTopicArrivals(store)

		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({ appMessageId: "final-old", seqId: "100", content: "old" }),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({ appMessageId: "final-new", seqId: "101", content: "new" }),
		)
		advanceRendering()

		const canonical = getNode(store, SUPER_MESSAGE_ID)
		expect(canonical).toMatchObject({
			app_message_id: "final-new",
			super_message_id: SUPER_MESSAGE_ID,
			content: "new",
		})
		expect(getAssistantCards(store)).toHaveLength(1)
		expect(arrivals.events).toHaveLength(2)
		arrivals.unsubscribe()
	})

	it("最终 assistant message 内容为空。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ content: "draft must be cleared" }))
		store.enqueueMessage(TOPIC_ID, createFinalEnvelope({ content: "" }))
		advanceRendering()

		expect(getNode(store, SUPER_MESSAGE_ID)?.content).toBe("")
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
	})

	it("最终 assistant message 显式 content=null 时清空旧 draft。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ content: "draft must be cleared" }))
		store.enqueueMessage(TOPIC_ID, createFinalEnvelope({ content: null }))
		advanceRendering()

		const canonical = getNode(store, SUPER_MESSAGE_ID)
		expect(Object.prototype.hasOwnProperty.call(canonical, "content")).toBe(true)
		expect([null, ""]).toContain(canonical?.content)
		expect(store.isTopicStreaming(TOPIC_ID)).toBe(false)
	})

	it("最终 assistant message 只有 metadata 时也能冷启动落地。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				includeContent: false,
				includeToolCalls: false,
				includeTokenUsage: false,
				nodeExtra: { event: "task_finished", task_id: "task-1" },
			}),
		)
		advanceRendering()

		const metadataNode = getNode(store, SUPER_MESSAGE_ID)
		expect(metadataNode).toMatchObject({
			role: "assistant",
			status: "finished",
			event: "task_finished",
		})
		expect(metadataNode?.content ?? "").toBe("")
		expect(metadataNode?.reasoning_content ?? "").toBe("")
		expect(metadataNode?.tool_calls ?? []).toEqual([])
		expect(metadataNode?.attachments ?? []).toEqual([])
		expect(getMessageRecords(store)).toEqual([
			expect.objectContaining({
				role: "assistant",
				event: "task_finished",
				correlation_id: CORRELATION_ID,
				super_message_id: SUPER_MESSAGE_ID,
			}),
		])
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
		expect(store.isTopicStreaming(TOPIC_ID)).toBe(false)
	})

	it("最终 assistant message 只有 metadata 时保留已有 streamed draft。", () => {
		const store = createStore()
		const streamedDraft = "streamed draft preserved by an absent Final content field"

		store.receiveChunk(createChunk({ content: streamedDraft }))
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toMatchObject({
			content: streamedDraft,
			isFinalMessageReceived: false,
		})

		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				includeContent: false,
				includeToolCalls: false,
				includeTokenUsage: false,
				nodeExtra: { event: "task_finished", task_id: "task-1" },
			}),
		)
		advanceRendering()

		expect(getNode(store, SUPER_MESSAGE_ID)).toMatchObject({
			role: "assistant",
			status: "finished",
			event: "task_finished",
		})
		expect(store.isTopicStreaming(TOPIC_ID)).toBe(false)
		const metadataNode = getNode(store, SUPER_MESSAGE_ID)
		// Final 自身只有 metadata；缺失的 content 不能覆盖已经接受的 streamed draft。
		expect(metadataNode?.content).toBe(streamedDraft)
		expect((metadataNode?.reasoning_content ?? "").trim()).toBe("")
		expect(metadataNode?.tool_calls ?? []).toHaveLength(0)
		expect(metadataNode?.attachments ?? []).toHaveLength(0)
		expect(getMessageRecords(store)).toEqual([
			expect.objectContaining({
				role: "assistant",
				event: "task_finished",
				correlation_id: CORRELATION_ID,
				super_message_id: SUPER_MESSAGE_ID,
				content: streamedDraft,
			}),
		])
	})

	it("最终 assistant message 缺少 tool_calls 时不把 absent 当成显式空数组。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ toolCalls: [createToolCall({ arguments: "draft" })] }))
		store.enqueueMessage(TOPIC_ID, createFinalEnvelope({ includeToolCalls: false }))
		advanceRendering()

		expect(getNode(store, SUPER_MESSAGE_ID)?.tool_calls?.map((tool) => tool.id)).toEqual([
			"tool-1",
		])
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
	})

	it("IM Final 的 tool_calls=undefined 按 absent 处理并保留 streamed tools。", () => {
		const store = createStore()
		const streamedArguments = '{"path":"im-undefined-field.md"}'

		store.receiveChunk(
			createChunk({ toolCalls: [createToolCall({ arguments: streamedArguments })] }),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				includeToolCalls: false,
				nodeExtra: { tool_calls: undefined },
			}),
		)
		advanceRendering()

		expect(getNode(store, SUPER_MESSAGE_ID)?.tool_calls?.[0]?.function?.arguments).toBe(
			streamedArguments,
		)
	})

	it.each([
		["null", null],
		["空数组", []],
	] as const)("最终 assistant message 显式 tool_calls=%s 时清空旧工具。", (_label, toolCalls) => {
		const store = createStore()

		store.receiveChunk(createChunk({ toolCalls: [createToolCall({ arguments: "draft" })] }))
		store.enqueueMessage(TOPIC_ID, createFinalEnvelope({ toolCalls }))
		advanceRendering()

		const canonical = getNode(store, SUPER_MESSAGE_ID)
		expect(Object.prototype.hasOwnProperty.call(canonical, "tool_calls")).toBe(true)
		expect(canonical?.tool_calls === null || canonical?.tool_calls?.length === 0).toBe(true)
		expect(store.isTopicStreaming(TOPIC_ID)).toBe(false)
	})

	it("最终 assistant message 的 tool_calls 不完整。", () => {
		const store = createStore()
		const streamedFirstTool = createToolCall({
			id: "tool-1",
			index: 0,
			arguments: "streamed arguments",
		})
		const secondTool = createToolCall({ id: "tool-2", index: 1 })
		const finalFirstTool = createToolCall({
			id: "tool-1",
			index: 0,
			arguments: "final authoritative arguments",
		})

		store.receiveChunk(createChunk({ toolCalls: [streamedFirstTool, secondTool] }))
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({ toolCalls: [finalFirstTool], content: "canonical" }),
		)
		advanceRendering()

		expect(getNode(store, SUPER_MESSAGE_ID)?.tool_calls?.map((tool) => tool.id)).toEqual([
			"tool-1",
		])
		expect(getNode(store, SUPER_MESSAGE_ID)?.tool_calls?.[0]?.function?.arguments).toBe(
			"final authoritative arguments",
		)
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
	})

	it("Final tool call 缺少 function.arguments 且存在 streamed 值时继承并收敛为单卡。", () => {
		const store = createStore()
		const streamedArguments = '{"path":"README.md"}'
		const finalWithoutArguments: ProjectedToolCall = {
			id: "tool-1",
			type: "function",
			function: { name: "read_file" },
		}

		store.receiveChunk(
			createChunk({ toolCalls: [createToolCall({ arguments: streamedArguments })] }),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({ toolCalls: [finalWithoutArguments], content: "canonical" }),
		)
		advanceRendering()

		const cards = getAssistantCards(store)
		expect(cards).toHaveLength(1)
		expect(getMessageNodeKey(cards[0])).toBe(SUPER_MESSAGE_ID)
		const canonical = getCanonicalNodeForCard(store, cards[0])
		expect(canonical?.tool_calls).toHaveLength(1)
		expect(canonical?.tool_calls?.[0]?.function?.arguments).toBe(streamedArguments)
	})

	it("finish_reason 已清理 StreamState 后，Final 缺少 function.arguments 仍继承已投影值。", () => {
		const store = createStore()
		const streamedArguments = '{"path":"late-final.md"}'
		const finalWithoutArguments: ProjectedToolCall = {
			id: "tool-1",
			type: "function",
			function: { name: "read_file" },
		}

		store.receiveChunk(
			createChunk({
				i: 0,
				toolCalls: [createToolCall({ arguments: streamedArguments })],
			}),
		)
		store.receiveChunk(createChunk({ i: 1, finishReason: "stop" }))
		advanceRendering()

		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
		expect(getNode(store, SUPER_MESSAGE_ID)?.tool_calls?.[0]?.function?.arguments).toBe(
			streamedArguments,
		)

		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({ toolCalls: [finalWithoutArguments], content: "canonical" }),
		)
		advanceRendering()

		const cards = getAssistantCards(store)
		expect(cards).toHaveLength(1)
		expect(cards[0]?.app_message_id).toBe("final-app-1")
		expect(getMessageNodeKey(cards[0])).toBe(SUPER_MESSAGE_ID)
		expect(getCanonicalNodeForCard(store, cards[0])?.tool_calls?.[0]?.function?.arguments).toBe(
			streamedArguments,
		)
	})

	it("HTTP Final 缺少 function.arguments 时继承活动流值，完成同步后仍保留。", () => {
		const store = createStore()
		const streamedArguments = '{"path":"http-final.md"}'
		const finalWithoutArguments: ProjectedToolCall = {
			id: "tool-1",
			type: "function",
			function: { name: "read_file" },
		}

		store.receiveChunk(
			createChunk({ toolCalls: [createToolCall({ arguments: streamedArguments })] }),
		)
		const generation = store.beginTopicSync(TOPIC_ID)
		store.initializeMessages(TOPIC_ID, [
			createFinalEnvelope({ toolCalls: [finalWithoutArguments], content: "canonical" }),
		])

		expect(getNode(store, SUPER_MESSAGE_ID)?.tool_calls?.[0]?.function?.arguments).toBe(
			streamedArguments,
		)
		expect(
			store.completeTopicSync(TOPIC_ID, generation, {
				succeeded: true,
				taskStatus: "finished",
				latestSeqId: "100",
			}),
		).toBe(true)
		expect(getNode(store, SUPER_MESSAGE_ID)?.tool_calls?.[0]?.function?.arguments).toBe(
			streamedArguments,
		)
	})

	it("HTTP Final 的 tool_calls=undefined 按 absent 处理并保留 streamed tools。", () => {
		const store = createStore()
		const streamedArguments = '{"path":"undefined-field.md"}'

		store.receiveChunk(
			createChunk({ toolCalls: [createToolCall({ arguments: streamedArguments })] }),
		)
		const generation = store.beginTopicSync(TOPIC_ID)
		store.initializeMessages(TOPIC_ID, [
			createFinalEnvelope({
				includeToolCalls: false,
				nodeExtra: { tool_calls: undefined },
			}),
		])

		expect(getNode(store, SUPER_MESSAGE_ID)?.tool_calls?.[0]?.function?.arguments).toBe(
			streamedArguments,
		)
		expect(
			store.completeTopicSync(TOPIC_ID, generation, {
				succeeded: true,
				taskStatus: "finished",
				latestSeqId: "100",
			}),
		).toBe(true)
		expect(getNode(store, SUPER_MESSAGE_ID)?.tool_calls?.[0]?.function?.arguments).toBe(
			streamedArguments,
		)
	})

	it("纯 initializeMessages 没有 streamed 来源时，不为缺失 arguments 合成非空值。", () => {
		const store = createStore()
		const finalWithoutArguments: ProjectedToolCall = {
			id: "tool-1",
			type: "function",
			function: { name: "read_file" },
		}

		store.initializeMessages(TOPIC_ID, [
			createFinalEnvelope({ toolCalls: [finalWithoutArguments], content: "canonical" }),
		])

		const argumentsValue = getNode(store, SUPER_MESSAGE_ID)?.tool_calls?.[0]?.function
			?.arguments
		expect(argumentsValue ?? "").toBe("")
		expect(argumentsValue).not.toBe('{"path":"README.md"}')
	})

	it("Final 显式 function.arguments 为空字符串时覆盖 streamed 值。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ toolCalls: [createToolCall({ arguments: "streamed" })] }))
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				toolCalls: [createToolCall({ arguments: "" })],
				content: "canonical",
			}),
		)
		advanceRendering()

		expect(getNode(store, SUPER_MESSAGE_ID)?.tool_calls?.[0]?.function?.arguments).toBe("")
	})

	it("Final 重复 tool id 时末项胜出、记录日志并只投影一个工具。", () => {
		const store = createStore()
		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const firstTool: ProjectedToolCall = {
			id: "tool-1",
			type: "function",
			function: { name: "read_file", arguments: '{"value":1}' },
		}
		const lastTool: ProjectedToolCall = {
			id: "tool-1",
			type: "function",
			function: { name: "read_file", arguments: '{"value":2}' },
		}

		try {
			store.enqueueMessage(
				TOPIC_ID,
				createFinalEnvelope({ toolCalls: [firstTool, lastTool], content: "canonical" }),
			)
			advanceRendering()

			const cards = getAssistantCards(store)
			expect.soft(cards).toHaveLength(1)
			expect.soft(getMessageNodeKey(cards[0])).toBe(SUPER_MESSAGE_ID)
			const canonical = getCanonicalNodeForCard(store, cards[0])
			expect.soft(canonical?.tool_calls).toEqual([
				expect.objectContaining({
					id: "tool-1",
					index: 0,
					function: expect.objectContaining({ arguments: '{"value":2}' }),
				}),
			])
			expect.soft(consoleWarn).toHaveBeenCalledWith(
				"[SuperMagicStore] duplicate final tool call id",
				expect.objectContaining({
					toolCallId: "tool-1",
					previousIndex: 0,
					incomingIndex: 1,
					resolution: "last-write-wins",
				}),
			)
			expect.soft(consoleWarn).toHaveBeenCalledTimes(1)
		} finally {
			consoleWarn.mockRestore()
		}
	})

	it("Final 删除 streamed tool 后不展示幽灵工具（response 可选作审计保留）。", () => {
		const store = createStore()
		const retainedTool = createToolCall({ id: "tool-1", index: 0 })
		const removedTool = createToolCall({ id: "tool-2", index: 1 })

		store.receiveChunk(createChunk({ toolCalls: [retainedTool, removedTool] }))
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({ toolId: "tool-2", seqId: "101", status: "finished" }),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				seqId: "102",
				toolCalls: [retainedTool],
				content: "canonical",
			}),
		)
		advanceRendering()

		// T1：只锁定 Assistant 的可渲染工具投影；role=tool response 可继续保留作审计。
		expect(getNode(store, SUPER_MESSAGE_ID)?.tool_calls?.map((tool) => tool.id)).toEqual([
			"tool-1",
		])
	})

	it("低 seq IM 不覆盖高 seq HTTP snapshot。", () => {
		const store = createStore()
		const generation = store.beginTopicSync(TOPIC_ID)

		store.initializeMessages(TOPIC_ID, [
			createFinalEnvelope({ appMessageId: "same-final", seqId: "200", content: "snapshot" }),
		])
		expect(
			store.completeTopicSync(TOPIC_ID, generation, {
				succeeded: true,
				taskStatus: "finished",
				latestSeqId: "200",
			}),
		).toBe(true)
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({ appMessageId: "same-final", seqId: "100", content: "stale IM" }),
		)
		advanceRendering()

		expect(getNode(store, SUPER_MESSAGE_ID)?.content).toBe("snapshot")
		expect(store.getLatestMessageSeqId(TOPIC_ID)).toBe("200")
	})

	it("高 seq IM 覆盖低 seq HTTP snapshot。", () => {
		const store = createStore()

		store.initializeMessages(TOPIC_ID, [
			createFinalEnvelope({ appMessageId: "same-final", seqId: "200", content: "snapshot" }),
		])
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({ appMessageId: "same-final", seqId: "201", content: "new IM" }),
		)
		advanceRendering()

		expect(getNode(store, SUPER_MESSAGE_ID)?.content).toBe("new IM")
		expect(store.getLatestMessageSeqId(TOPIC_ID)).toBe("201")
		expect(
			getMessageRecords(store).some(
				(message) => message?.app_message_id === "same-final" && message?.seq_id === "201",
			),
		).toBe(true)
	})

	it("最终 message 的 status 仍然为 running。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ content: "draft" }))
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				content: "canonical",
				nodeStatus: "running",
				toolCalls: [createToolCall({ status: "running" })],
			}),
		)
		advanceRendering()

		expect(getNode(store, SUPER_MESSAGE_ID)?.content).toBe("canonical")
		expect(getNode(store, SUPER_MESSAGE_ID)?.status).toBe("running")
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
		expect(store.isTopicStreaming(TOPIC_ID)).toBe(false)
		// T2：Final transport 到达不是 task terminal，不应伪造 response_missing。
		const canonicalTool = store.toolResponseMap.get(TOPIC_ID)?.get("tool-1")
		const effectiveTool =
			canonicalTool ?? getNode(store, SUPER_MESSAGE_ID)?.tool_calls?.[0]?.tool
		expect(canonicalTool).toBeUndefined()
		expect(effectiveTool?.status).toBe("running")
	})

	it("最终 message 的 tool 状态仍然为 running，但 tool response 已 finished。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				seqId: "100",
				toolCalls: [createToolCall({ status: "running" })],
			}),
		)
		store.enqueueMessage(TOPIC_ID, createToolEnvelope({ seqId: "101", status: "finished" }))
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				seqId: "102",
				toolCalls: [createToolCall({ status: "running" })],
			}),
		)
		advanceRendering()

		const embeddedTool = getNode(store, SUPER_MESSAGE_ID)?.tool_calls?.[0]?.tool
		const canonicalTool = store.toolResponseMap.get(TOPIC_ID)?.get("tool-1")
		const effectiveTool = canonicalTool || embeddedTool

		// Assistant embedded projection 仍是 running；用户可见执行态必须读取
		// toolResponseMap 优先的 effective state。
		expect(embeddedTool?.status).toBe("running")
		expect(canonicalTool?.status).toBe("finished")
		expect(effectiveTool?.status).toBe("finished")
	})

	it("final message 缺少 token usage 时保留已有 canonical usage。", () => {
		const store = createStore()

		const initialUsage = createTokenUsage(42)
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				appMessageId: "usage-initial",
				seqId: "100",
				content: "initial",
				tokenUsage: initialUsage,
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				appMessageId: "usage-next",
				seqId: "101",
				content: "canonical",
				includeTokenUsage: false,
			}),
		)
		advanceRendering()

		expect(getNode(store, SUPER_MESSAGE_ID)?.content).toBe("canonical")
		expect(getNode(store, SUPER_MESSAGE_ID)?.token_usage).toEqual(initialUsage)
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
		expect(store.isTopicStreaming(TOPIC_ID)).toBe(false)
	})

	it("final message 显式 token_usage=null 时清空已有 canonical usage。", () => {
		const store = createStore()
		const initialUsage = createTokenUsage(42)

		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				appMessageId: "usage-initial",
				seqId: "100",
				tokenUsage: initialUsage,
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				appMessageId: "usage-cleared",
				seqId: "101",
				tokenUsage: null,
			}),
		)
		advanceRendering()

		const canonical = getNode(store, SUPER_MESSAGE_ID)
		expect(Object.prototype.hasOwnProperty.call(canonical, "token_usage")).toBe(true)
		expect(canonical?.token_usage).toBeNull()
	})

	it("usage-only chunk 和 final message 的 token usage 不一致。", () => {
		const store = createStore()

		store.receiveChunk(
			createChunk({
				i: 0,
				choices: [],
				usage: { completion_tokens: 1, prompt_tokens: 2, total_tokens: 3 },
			}),
		)
		store.enqueueMessage(TOPIC_ID, createFinalEnvelope({ tokenUsage: createTokenUsage(99) }))
		advanceRendering()

		expect(getNode(store, SUPER_MESSAGE_ID)?.token_usage).toEqual(createTokenUsage(99))
	})

	it("final message 的 seqId 早于已有消息。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				appMessageId: "newer-message",
				superMessageId: "newer-super-message",
				correlationId: "newer-correlation",
				seqId: "10",
				content: "newer",
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				appMessageId: "older-final",
				superMessageId: "older-super-message",
				correlationId: "older-correlation",
				seqId: "2",
				content: "older but valid",
			}),
		)
		advanceRendering()

		expect(getNode(store, "older-super-message")?.content).toBe("older but valid")
		const storedOrder = getMessageRecords(store).map((message) => ({
			appMessageId: message.app_message_id,
			seqId: message.seq_id,
		}))
		expect(storedOrder).toEqual([
			{ appMessageId: "older-final", seqId: "2" },
			{ appMessageId: "newer-message", seqId: "10" },
		])
		expect(
			messagesConverter(getMessageRecords(store)).map((message) => ({
				appMessageId: message.app_message_id,
				seqId: message.seq_id,
			})),
		).toEqual(storedOrder)
		expect(store.getLatestMessageSeqId(TOPIC_ID)).toBe("10")
	})

	it("Final 保留真实 appMessageId，并以 super_message_id 接管流式占位 canonical。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ content: "draft" }))
		advanceRendering(32)
		const placeholder = getNode(store, SUPER_MESSAGE_ID)
		expect(placeholder).toBeDefined()

		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({ appMessageId: "real-app-id", content: "canonical" }),
		)
		advanceRendering()

		expect(getNode(store, SUPER_MESSAGE_ID)?.content).toBe("canonical")
		expect(getNode(store, SUPER_MESSAGE_ID)).toMatchObject({
			app_message_id: "real-app-id",
			super_message_id: SUPER_MESSAGE_ID,
			message_id: "node-real-app-id",
			content: "canonical",
		})
		const cards = getAssistantCards(store)
		expect(cards).toHaveLength(1)
		expect(cards[0]?.app_message_id).toBe("real-app-id")
		expect(getMessageNodeKey(cards[0])).toBe(SUPER_MESSAGE_ID)
		expect(store.messageMap.get(SUPER_MESSAGE_ID)).toBeDefined()
		expect(getMessageRecords(store)).toMatchObject([
			{ app_message_id: "real-app-id", correlation_id: CORRELATION_ID },
		])
		// D04/D05：真实 app_message_id 继续作为协议事实保留，但不再承担 Assistant canonical 身份。
	})

	it("Final 与流式占位在 UI projection 中收敛为一张 super_message_id 稳定卡片。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ content: "draft" }))
		advanceRendering(32)
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({ appMessageId: "real-app-id", content: "canonical" }),
		)
		advanceRendering()

		const cards = getAssistantCards(store)
		expect(cards).toHaveLength(1)
		expect(cards[0]?.correlation_id).toBe(CORRELATION_ID)
		expect(cards[0]?.super_message_id).toBe(SUPER_MESSAGE_ID)
		// app、correlation 与 super 三个 ID 刻意不同，避免旧 identity 实现让测试误通过。
		expect(getMessageNodeKey(cards[0])).toBe(SUPER_MESSAGE_ID)
	})

	it("super_message_id 查询暴露 Final canonical，同时保留真实 appMessageId。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({ appMessageId: "real-app-id", content: "canonical" }),
		)
		advanceRendering()

		expect(getNode(store, SUPER_MESSAGE_ID)).toMatchObject({
			app_message_id: "real-app-id",
			super_message_id: SUPER_MESSAGE_ID,
			message_id: "node-real-app-id",
			content: "canonical",
		})
	})

	it("Final projection 保留真实 appMessageId，同时逻辑卡片 key 使用 super_message_id。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({ appMessageId: "real-app-id", content: "canonical" }),
		)
		advanceRendering()

		const cards = getAssistantCards(store)
		expect(cards).toHaveLength(1)
		expect(cards[0]?.app_message_id).toBe("real-app-id")
		expect(cards[0]?.super_message_id).toBe(SUPER_MESSAGE_ID)
		expect(getMessageNodeKey(cards[0])).toBe(SUPER_MESSAGE_ID)
	})

	it("Final 权威结算后公开流式生命周期结束。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ content: "draft" }))
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeDefined()
		store.enqueueMessage(TOPIC_ID, createFinalEnvelope({ content: "canonical" }))
		advanceRendering()

		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
		expect(store.isTopicStreaming(TOPIC_ID)).toBe(false)
	})

	it("IM Final 在 reasoning timer 活跃时立即提交 canonical 并移除 StreamState。", () => {
		const store = createStore()
		const ended: MessageStreamEndedEvent[] = []
		store.subscribe("message.stream.ended", (event) => ended.push(event))
		store.receiveChunk(
			createChunk({
				reasoningContent: "reasoning draft",
			}),
		)

		expect(store.getStreamState(TOPIC_ID, SUPER_MESSAGE_ID)?.stage).toBe("reasoning_content")
		expect(store.topicMeta.get(TOPIC_ID)?.timer).not.toBeNull()

		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				content: "canonical answer after reasoning",
				nodeStatus: "running",
				nodeExtra: { reasoning_content: "canonical reasoning after draft" },
			}),
		)

		expect(store.getStreamState(TOPIC_ID, SUPER_MESSAGE_ID)).toBeUndefined()
		expect(store.topicMeta.get(TOPIC_ID)?.timer).toBeNull()
		expect(getNode(store, SUPER_MESSAGE_ID)).toMatchObject({
			content: "canonical answer after reasoning",
			reasoning_content: "canonical reasoning after draft",
			status: "running",
		})
		expect(store.getRenderedMessageNode(SUPER_MESSAGE_ID, TOPIC_ID)).toBeDefined()
		expect(ended).toHaveLength(1)
		expect(ended[0].payload).toMatchObject({
			reason: "authoritative_final",
			awaitingCanonicalMessage: false,
		})
	})

	it("finish_reason 的 awaiting=true 不会吞掉后续 canonical Final 的 awaiting=false。", () => {
		const store = createStore()
		const ended: MessageStreamEndedEvent[] = []
		store.subscribe("message.stream.ended", (event) => ended.push(event))

		store.receiveChunk(createChunk({ content: "draft", finishReason: "stop" }))
		advanceRendering()
		store.enqueueMessage(TOPIC_ID, createFinalEnvelope({ content: "canonical" }))

		expect(ended.map((event) => event.payload.awaitingCanonicalMessage)).toEqual([true, false])
		expect(ended[1].payload.reason).toBe("authoritative_final")
	})

	it("Final 后迟到 chunk 不得重新打开流或污染 canonical。", () => {
		const store = createStore()

		store.enqueueMessage(TOPIC_ID, createFinalEnvelope({ content: "canonical" }))
		advanceRendering()
		store.receiveChunk(createChunk({ i: 0, content: "late mutation" }))
		advanceRendering(100)

		expect(getNode(store, SUPER_MESSAGE_ID)?.content).toBe("canonical")
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
		expect(store.isTopicStreaming(TOPIC_ID)).toBe(false)
	})

	it("持久 Assistant 结算后，低序号 chunk、重复 chunk 和旧 Final 都不能删除或降级 canonical。", () => {
		const store = createStore()
		const canonicalEnvelope = createFinalEnvelope({
			appMessageId: "durable-app-id",
			seqId: "200",
			content: "durable canonical",
			nodeStatus: "finished",
		})
		const duplicateChunk = createChunk({ i: 1, content: " accepted before Final" })
		const expectDurableCanonical = () => {
			expect(getNode(store, SUPER_MESSAGE_ID)).toMatchObject({
				app_message_id: "durable-app-id",
				content: "durable canonical",
				status: "finished",
			})
			expect(getAssistantCards(store)).toMatchObject([{ app_message_id: "durable-app-id" }])
			expect(getMessageRecords(store)).toMatchObject([
				{
					app_message_id: "durable-app-id",
					correlation_id: CORRELATION_ID,
					seq_id: "200",
				},
			])
			expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
			expect(store.isTopicStreaming(TOPIC_ID)).toBe(false)
		}

		store.receiveChunk(createChunk({ i: 0, content: "draft" }))
		store.receiveChunk(duplicateChunk)
		store.enqueueMessage(TOPIC_ID, canonicalEnvelope)
		advanceRendering()
		expectDurableCanonical()

		// A stale sequence with mutated content must not be treated as a legitimate retry.
		store.receiveChunk(createChunk({ i: 0, content: "late low-sequence mutation" }))
		advanceRendering(100)
		expectDurableCanonical()

		// An exact replay of the last accepted chunk exercises deduplication independently.
		store.receiveChunk(createChunk({ i: 1, content: " accepted before Final" }))
		advanceRendering(100)
		expectDurableCanonical()

		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				appMessageId: "durable-app-id",
				seqId: "199",
				content: "stale Final",
				nodeStatus: "running",
			}),
		)
		advanceRendering()
		expectDurableCanonical()
	})

	it("更高 revision Final 已接受后立即关闭 StreamState，后续低 seq Final 不得回退。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ content: "active draft" }))
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				appMessageId: "higher-final",
				seqId: "200",
				content: "higher canonical",
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({
				appMessageId: "stale-final",
				seqId: "199",
				content: "stale canonical",
			}),
		)

		// Canonical Final 的业务结算不再等待 Buffer/render timer；低版本只需保持幂等拒绝。
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
		expect(getNode(store, SUPER_MESSAGE_ID)?.content).toBe("higher canonical")
		expect(store.getStreamState(TOPIC_ID, CORRELATION_ID)).toBeUndefined()
	})

	it("同一 super_message_id 的更高 seq Final 不得被重复判断跳过。", () => {
		const store = createStore()
		const arrivals = collectTopicArrivals(store)

		store.initializeMessages(TOPIC_ID, [
			createFinalEnvelope({
				appMessageId: "same-app",
				seqId: "100",
				content: "old snapshot",
			}),
		])
		store.enqueueMessage(
			TOPIC_ID,
			createFinalEnvelope({ appMessageId: "same-app", seqId: "101", content: "new final" }),
		)
		advanceRendering()

		expect(getNode(store, SUPER_MESSAGE_ID)?.content).toBe("new final")
		expect(store.getLatestMessageSeqId(TOPIC_ID)).toBe("101")
		expect(arrivals.events).toHaveLength(1)
		arrivals.unsubscribe()
	})

	it("final message 在 buffer 中被重复入队。", () => {
		const store = createStore()
		const arrivals = collectTopicArrivals(store)
		const finalMessage = createFinalEnvelope({ appMessageId: "buffer-duplicate" })

		store.enqueueMessage(TOPIC_ID, finalMessage)
		store.enqueueMessage(TOPIC_ID, cloneEnvelope(finalMessage))
		store.enqueueMessage(TOPIC_ID, cloneEnvelope(finalMessage))
		advanceRendering()

		expect(arrivals.events).toHaveLength(1)
		expect(getNode(store, SUPER_MESSAGE_ID)).toMatchObject({
			app_message_id: "buffer-duplicate",
			super_message_id: SUPER_MESSAGE_ID,
		})
		expect(getAssistantCards(store)).toHaveLength(1)
		arrivals.unsubscribe()
	})
})
