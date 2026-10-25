import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SeqRecordType, type SeqRecord } from "@/apis/modules/chat/types"
import { SuperMagicStore } from "@/pages/superMagic/stores"
import type {
	RawSuperMagicMessageEnvelope,
	StreamRecoveryRequestPayload,
} from "@/pages/superMagic/stores/types"
import {
	ConversationMessageStatus,
	ConversationMessageType,
	type SuperMagicConversationMessageV2,
} from "@/types/chat/conversation_message"
import {
	IntermediateMessageType,
	type SuperMagicChunkMessage,
} from "@/types/chat/intermediate_message"

const TOPIC_A = "topic-timer-a"
const TOPIC_B = "topic-timer-b"
const CORRELATION_A = "correlation-timer-a"
const CORRELATION_B = "correlation-timer-b"
const SUPER_MESSAGE_A = "super-message-timer-a"
const SUPER_MESSAGE_B = "super-message-timer-b"
const RENDER_SETTLE_MS = 2_000
const FINAL_SETTLING_OBSERVATION_MS = 1_600
const FINAL_SETTLING_SAFETY_MS = 3_600
const RECOVERY_TIMEOUT_MS = 5_100

type ChunkChoice = SuperMagicChunkMessage["super_magic_chunk"]["choices"][number]
type ChunkToolCall = ChunkChoice["delta"]["tool_calls"][number]
type FinishReason = ChunkChoice["finish_reason"]

interface ChunkOptions {
	topicId?: string
	correlationId?: string
	i?: number
	content?: string
	reasoningContent?: string
	finishReason?: FinishReason
	toolCalls?: ChunkToolCall[]
	choices?: ChunkChoice[]
}

interface ProjectedToolCall {
	id?: string
	type?: string
	index?: number
	function?: {
		name?: string
		label?: string
		arguments?: string
	}
	tool?: {
		status?: string
	}
}

interface ProjectedNode {
	content?: string | null
	reasoning_content?: string | null
	tool_calls?: ProjectedToolCall[] | null
}

function createChoice({
	content = "",
	reasoningContent = "",
	finishReason = null,
	toolCalls = [],
}: Omit<ChunkOptions, "topicId" | "correlationId" | "i" | "choices"> = {}): ChunkChoice {
	return {
		...({ index: 0 } as const),
		finish_reason: finishReason,
		delta: {
			content,
			role: "assistant",
			tool_calls: toolCalls,
			reasoning_content: reasoningContent,
			index: 0,
		},
	}
}

function createChunk({
	topicId = TOPIC_A,
	correlationId = CORRELATION_A,
	i = 0,
	content = "",
	reasoningContent = "",
	finishReason = null,
	toolCalls = [],
	choices,
}: ChunkOptions = {}): SuperMagicChunkMessage {
	return {
		magic_message_id: `magic-${topicId}-${correlationId}-${i}`,
		app_message_id: `chunk-${topicId}-${correlationId}-${i}`,
		type: IntermediateMessageType.SuperMagicChunk,
		project_id: "project-timers",
		topic_id: topicId,
		chat_topic_id: topicId,
		message_id: `completion-${correlationId}`,
		super_magic_chunk: {
			super_message_id: correlationId === CORRELATION_A ? SUPER_MESSAGE_A : SUPER_MESSAGE_B,
			task_id: `task-${correlationId}`,
			i,
			usage: null,
			correlation_id: correlationId,
			choices: choices ?? [
				createChoice({
					content,
					reasoningContent,
					finishReason,
					toolCalls,
				}),
			],
		},
	}
}

function createToolCall({
	id,
	index,
	name = "read_file",
	arguments: argumentsValue = "{}",
}: {
	id: string
	index: number
	name?: string
	arguments?: string
}): ChunkToolCall {
	return {
		id,
		type: "function",
		index,
		function: {
			name,
			arguments: argumentsValue,
		},
	}
}

function createFinalEnvelope({
	topicId = TOPIC_A,
	correlationId = CORRELATION_A,
	appMessageId = `final-${correlationId}`,
	seqId = "100",
	role = "assistant",
	content = "",
	reasoningContent = "",
	toolCalls = [],
}: {
	topicId?: string
	correlationId?: string
	appMessageId?: string
	seqId?: string
	role?: "assistant" | "user"
	content?: string
	reasoningContent?: string
	toolCalls?: ProjectedToolCall[]
} = {}): RawSuperMagicMessageEnvelope {
	const envelope = {
		type: SeqRecordType.seq,
		seq: {
			magic_id: "magic-user-timers",
			seq_id: seqId,
			message_id: `server-${appMessageId}`,
			refer_message_id: "",
			sender_message_id: "",
			conversation_id: "conversation-timers",
			organization_code: "organization-timers",
			message: {
				magic_message_id: `magic-${appMessageId}`,
				app_message_id: appMessageId,
				sender_id: role === "user" ? "user-timers" : "assistant-timers",
				send_time: Number(seqId),
				status: ConversationMessageStatus.Read,
				unread_count: 0,
				topic_id: topicId,
				type: ConversationMessageType.SuperMagicMessage,
				super_magic_message: {
					role,
					topic_id: topicId,
					message_id: `node-${appMessageId}`,
					super_message_id:
						role === "user"
							? appMessageId
							: correlationId === CORRELATION_A
								? SUPER_MESSAGE_A
								: SUPER_MESSAGE_B,
					correlation_id: correlationId,
					content,
					reasoning_content: reasoningContent,
					tool_calls: toolCalls,
					status: "finished",
					send_timestamp: Number(seqId),
				},
			},
		},
	} satisfies SeqRecord<SuperMagicConversationMessageV2>

	return envelope as unknown as RawSuperMagicMessageEnvelope
}

function createStore(activeTopicId = TOPIC_A): SuperMagicStore {
	const store = new SuperMagicStore()
	store.setActiveTopicId(activeTopicId)
	return store
}

function getProjectedNode(
	store: SuperMagicStore,
	superMessageId = SUPER_MESSAGE_A,
): ProjectedNode | undefined {
	// Render-state lookup is Topic-scoped; these helpers exercise the active Topic A unless a
	// test explicitly uses the store API with another Topic.
	const node = store.getRenderedMessageNode(superMessageId, TOPIC_A)
	return node && typeof node === "object" ? (node as ProjectedNode) : undefined
}

function collectRecoveryRequests(store: SuperMagicStore): {
	events: StreamRecoveryRequestPayload[]
	unsubscribe: () => void
} {
	const events: StreamRecoveryRequestPayload[] = []
	const unsubscribe = store.registerOnStreamRecoveryRequested((payload) => events.push(payload))
	return { events, unsubscribe }
}

function advanceRendering(milliseconds = RENDER_SETTLE_MS): void {
	vi.advanceTimersByTime(milliseconds)
}

function expectSettled(
	store: SuperMagicStore,
	{
		topicId = TOPIC_A,
		correlationId = CORRELATION_A,
		expected,
	}: {
		topicId?: string
		correlationId?: string
		expected: ProjectedNode
	},
): void {
	advanceRendering()
	const superMessageId = correlationId === CORRELATION_B ? SUPER_MESSAGE_B : SUPER_MESSAGE_A
	expect(getProjectedNode(store, superMessageId)).toMatchObject(expected)
	expect(store.getStreamState(topicId, correlationId)).toBeUndefined()
}

describe("SuperMagicStore / 渲染状态机与 Timer", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		// Self-scheduling render loops are deliberately never drained without a bound.
		vi.clearAllTimers()
		vi.restoreAllMocks()
		vi.useRealTimers()
	})

	it("`currentToolIndex` 大于最终 tool_calls 长度。", () => {
		const store = createStore()
		const streamedTools = [
			createToolCall({ id: "tool-a", index: 0 }),
			createToolCall({ id: "tool-b", index: 1 }),
			createToolCall({ id: "tool-c", index: 2 }),
		]

		store.receiveChunk(createChunk({ toolCalls: streamedTools }))
		advanceRendering(200)
		store.enqueueMessage(TOPIC_A, createFinalEnvelope({ toolCalls: [streamedTools[0]] }))

		expectSettled(store, {
			expected: { tool_calls: [{ id: "tool-a" }] },
		})
		expect(getProjectedNode(store)?.tool_calls).toHaveLength(1)
	})

	it("`currentToolIndex` 指向已经被 final 删除的工具。", () => {
		const store = createStore()
		const toolA = createToolCall({ id: "tool-a", index: 0, arguments: '{"a":1}' })
		const toolB = createToolCall({ id: "tool-b", index: 1, arguments: '{"b":2}' })

		store.receiveChunk(createChunk({ toolCalls: [toolA, toolB] }))
		advanceRendering(200)
		store.enqueueMessage(TOPIC_A, createFinalEnvelope({ toolCalls: [toolA] }))

		expectSettled(store, { expected: { tool_calls: [{ id: "tool-a" }] } })
		expect(getProjectedNode(store)?.tool_calls?.some((tool) => tool.id === "tool-b")).toBe(
			false,
		)
	})

	it("tool_calls 顺序变化后 `currentToolIndex` 未重置。", () => {
		const store = createStore()
		const toolA = createToolCall({ id: "tool-a", index: 0 })
		const toolB = createToolCall({ id: "tool-b", index: 1 })

		store.receiveChunk(createChunk({ toolCalls: [toolA, toolB] }))
		advanceRendering(100)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				toolCalls: [
					{ ...toolB, index: 0 },
					{ ...toolA, index: 1 },
				],
			}),
		)

		expectSettled(store, { expected: { tool_calls: [{ id: "tool-b" }, { id: "tool-a" }] } })
		expect(getProjectedNode(store)?.tool_calls?.map((tool) => tool.id)).toEqual([
			"tool-b",
			"tool-a",
		])
	})

	it("当前 arguments 更长，算法只检查 `<`，无法回退。", () => {
		const store = createStore()

		store.receiveChunk(
			createChunk({
				toolCalls: [
					createToolCall({
						id: "tool-a",
						index: 0,
						arguments: '{"path":"draft-with-extra-data"}',
					}),
				],
			}),
		)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				toolCalls: [createToolCall({ id: "tool-a", index: 0, arguments: "{}" })],
			}),
		)

		expectSettled(store, {
			expected: { tool_calls: [{ function: { arguments: "{}" } }] },
		})
	})

	it("当前 arguments 内容分叉但长度较短，继续从错误偏移追加。", () => {
		const store = createStore()
		const finalArguments = '{"path":"right.txt"}'

		store.receiveChunk(
			createChunk({
				toolCalls: [createToolCall({ id: "tool-a", index: 0, arguments: '{"path":"bad' })],
			}),
		)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				toolCalls: [createToolCall({ id: "tool-a", index: 0, arguments: finalArguments })],
			}),
		)

		expectSettled(store, {
			expected: { tool_calls: [{ function: { arguments: finalArguments } }] },
		})
	})

	it("当前 arguments 内容分叉且长度相同，永久不相等。", () => {
		const store = createStore()
		const streamedArguments = '{"x":"old"}'
		const finalArguments = '{"x":"new"}'

		expect(streamedArguments).toHaveLength(finalArguments.length)
		store.receiveChunk(
			createChunk({
				toolCalls: [
					createToolCall({ id: "tool-a", index: 0, arguments: streamedArguments }),
				],
			}),
		)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				toolCalls: [createToolCall({ id: "tool-a", index: 0, arguments: finalArguments })],
			}),
		)

		expectSettled(store, {
			expected: { tool_calls: [{ function: { arguments: finalArguments } }] },
		})
	})

	it("`isToolCallsEqual()` 永远为 false。", () => {
		const store = createStore()
		const tool = createToolCall({ id: "tool-a", index: 0, arguments: '{"path":"a"}' })

		store.receiveChunk(createChunk({ toolCalls: [tool] }))
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				toolCalls: [
					{
						...tool,
						function: { ...tool.function, label: "读取文件" },
						tool: { status: "finished" },
					},
				],
			}),
		)

		expectSettled(store, {
			expected: {
				tool_calls: [
					{
						id: "tool-a",
						function: { label: "读取文件", arguments: '{"path":"a"}' },
					},
				],
			},
		})
	})

	it('`stage="tool"` 永远无法进入 `"done"`。', () => {
		const store = createStore()

		store.receiveChunk(
			createChunk({
				toolCalls: [createToolCall({ id: "tool-a", index: 0 })],
				finishReason: "tool_calls",
			}),
		)

		expectSettled(store, { expected: { tool_calls: [{ id: "tool-a" }] } })
		expect(store.isTopicStreaming(TOPIC_A)).toBe(false)
	})

	it("`isFinalMessageReceived=true`，但 stage 仍不是 done。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ i: 0, reasoningContent: "reasoning" }))
		store.receiveChunk(createChunk({ i: 1, content: "draft" }))
		store.receiveChunk(
			createChunk({
				i: 2,
				toolCalls: [createToolCall({ id: "tool-a", index: 0 })],
			}),
		)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				content: "final",
				reasoningContent: "reasoning",
				toolCalls: [createToolCall({ id: "tool-a", index: 0 })],
			}),
		)

		expectSettled(store, {
			expected: { content: "final", reasoning_content: "reasoning" },
		})
	})

	it("final 状态下 `progressed=false`，仍然每 16ms 创建 timer。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ content: "draft" }))
		store.enqueueMessage(TOPIC_A, createFinalEnvelope({ content: "final" }))
		advanceRendering()

		expect(getProjectedNode(store)?.content).toBe("final")
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(vi.getTimerCount()).toBe(0)
	})

	it("timer 回调持续运行但每次没有任何数据变化。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ content: "stable" }))
		advanceRendering(1_000)
		const firstProjection = getProjectedNode(store)?.content

		expect(firstProjection).toBe("stable")
		expect(vi.getTimerCount()).toBeLessThanOrEqual(1)

		advanceRendering(1_000)
		expect(getProjectedNode(store)?.content).toBe(firstProjection)
		expect(vi.getTimerCount()).toBeLessThanOrEqual(1)
	})

	it("timer 被清理，但 StreamState 仍保留。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ content: "done", finishReason: "stop" }))
		advanceRendering()

		expect(getProjectedNode(store)?.content).toBe("done")
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(store.isTopicStreaming(TOPIC_A)).toBe(false)
		expect(vi.getTimerCount()).toBe(0)
	})

	it("StreamState 被删除，但 timer 未清理。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ content: "draft" }))
		store.enqueueMessage(TOPIC_A, createFinalEnvelope({ content: "canonical" }))
		advanceRendering()

		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(getProjectedNode(store)?.content).toBe("canonical")
		expect(vi.getTimerCount()).toBe(0)
	})

	it("timer 回调执行时 topic 已经切换。", () => {
		const store = createStore()
		const content = "A".repeat(4_096)

		store.receiveChunk(createChunk({ content, finishReason: "stop" }))
		store.setActiveTopicId(TOPIC_B)
		advanceRendering()

		// A queued callback may finish canonical bookkeeping, but it must not render into topic B.
		expect(store.isTopicStreaming(TOPIC_B)).toBe(false)
		expect(getProjectedNode(store, SUPER_MESSAGE_B)).toBeUndefined()

		store.setActiveTopicId(TOPIC_A)
		advanceRendering()
		expect(getProjectedNode(store)?.content).toBe(content)
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
	})

	it("timer 回调执行时 correlation 已经 finalized。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ content: "draft" }))
		store.enqueueMessage(TOPIC_A, createFinalEnvelope({ content: "canonical" }))
		advanceRendering()

		expect(getProjectedNode(store)?.content).toBe("canonical")
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(vi.getTimerCount()).toBe(0)
	})

	it("tool arguments 已全部投影且 buffer 为空时，没有 finish_reason 仍必须保留 StreamState 并触发 watchdog。", () => {
		const store = createStore()
		const recovery = collectRecoveryRequests(store)
		const completeArguments = JSON.stringify({
			path: "workspace/generated/very-long-file.md",
			content: "argument-body".repeat(256),
		})

		store.receiveChunk(
			createChunk({
				toolCalls: [
					createToolCall({
						id: "write-file-complete",
						index: 0,
						name: "write_file",
						arguments: completeArguments,
					}),
				],
			}),
		)
		advanceRendering()

		const streamState = store.getStreamState(TOPIC_A, CORRELATION_A)
		expect(streamState?.stage).toBe("tool")
		expect(streamState?.tool_calls[0]?.function.arguments).toBe(completeArguments)
		expect(getProjectedNode(store)?.tool_calls?.[0]?.function?.arguments).toBe(
			completeArguments,
		)
		expect(store.buffer.get(TOPIC_A)?.messages ?? []).toHaveLength(0)
		expect(store.isTopicStreaming(TOPIC_A)).toBe(true)

		// Watchdog is anchored at chunk receipt, not after argument projection finishes.
		vi.advanceTimersByTime(RECOVERY_TIMEOUT_MS - RENDER_SETTLE_MS - 101)
		expect(recovery.events).toHaveLength(0)

		vi.advanceTimersByTime(101)

		expect(recovery.events).toEqual([{ topicId: TOPIC_A, correlationId: CORRELATION_A }])
		expect(store.buffer.get(TOPIC_A)?.messages ?? []).toHaveLength(0)
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeDefined()
		recovery.unsubscribe()
	})

	it("渲染 timer 存在且 tool arguments 尚未投影完成时，watchdog 仍按 correlation 独立触发一次。", () => {
		const store = createStore()
		const recovery = collectRecoveryRequests(store)
		const completeArguments = JSON.stringify({ content: "streaming-tool".repeat(8_192) })

		store.receiveChunk(
			createChunk({
				toolCalls: [
					createToolCall({
						id: "write-file-pending",
						index: 0,
						name: "write_file",
						arguments: completeArguments,
					}),
				],
			}),
		)
		const topicMeta = store.topicMeta.get(TOPIC_A)
		const renderTimer = topicMeta?.timer
		expect(renderTimer).not.toBeNull()
		expect(store.getStreamRecoveryState(TOPIC_A, CORRELATION_A)).toMatchObject({
			status: "waiting",
			attempts: 0,
		})

		vi.advanceTimersByTime(RECOVERY_TIMEOUT_MS)

		expect(recovery.events).toEqual([{ topicId: TOPIC_A, correlationId: CORRELATION_A }])
		expect(
			recovery.events.filter((event) => event.correlationId === CORRELATION_A),
		).toHaveLength(1)
		expect(getProjectedNode(store)?.tool_calls?.[0]?.function?.arguments).not.toBe(
			completeArguments,
		)
		expect(store.getStreamRecoveryState(TOPIC_A, CORRELATION_A)).toMatchObject({
			status: "recovering",
			attempts: 1,
		})
		expect(store.topicMeta.get(TOPIC_A)?.timer).not.toBeNull()
		recovery.unsubscribe()
	})

	it("recovery timer 属于旧 correlation，却恢复新 correlation。", () => {
		const store = createStore()
		const recovery = collectRecoveryRequests(store)

		store.receiveChunk(createChunk({ correlationId: CORRELATION_A, content: "old" }))
		vi.advanceTimersByTime(4_000)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({ correlationId: CORRELATION_A, content: "old-final" }),
		)
		store.receiveChunk(createChunk({ correlationId: CORRELATION_B, content: "new" }))

		vi.advanceTimersByTime(1_200)
		expect(recovery.events).toHaveLength(0)

		vi.advanceTimersByTime(4_000)
		expect(recovery.events).toEqual([{ topicId: TOPIC_A, correlationId: CORRELATION_B }])
		recovery.unsubscribe()
	})

	it("final 状态不触发 recovery watchdog。", () => {
		const store = createStore()
		const recovery = collectRecoveryRequests(store)

		store.receiveChunk(createChunk({ content: "draft" }))
		store.enqueueMessage(TOPIC_A, createFinalEnvelope({ content: "final" }))
		advanceRendering()
		vi.advanceTimersByTime(RECOVERY_TIMEOUT_MS * 2)

		expect(recovery.events).toHaveLength(0)
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		recovery.unsubscribe()
	})

	it("非 final 状态持续有无意义 heartbeat，导致 recovery 一直被延后。", () => {
		const store = createStore()
		const recovery = collectRecoveryRequests(store)

		store.receiveChunk(createChunk({ content: "waiting" }))
		for (let index = 1; index <= 6; index += 1) {
			vi.advanceTimersByTime(1_000)
			store.receiveChunk(createChunk({ i: index, choices: [] }))
		}

		expect(recovery.events).toEqual([{ topicId: TOPIC_A, correlationId: CORRELATION_A }])
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeDefined()
		recovery.unsubscribe()
	})

	it("一个 topic 多个 StreamState，但只有一个 topic timer。", () => {
		const store = createStore()

		store.receiveChunk(
			createChunk({ correlationId: CORRELATION_A, content: "A", finishReason: "stop" }),
		)
		store.receiveChunk(
			createChunk({ correlationId: CORRELATION_B, content: "B", finishReason: "stop" }),
		)
		advanceRendering()

		expect(getProjectedNode(store, SUPER_MESSAGE_A)?.content).toBe("A")
		expect(getProjectedNode(store, SUPER_MESSAGE_B)?.content).toBe("B")
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(store.getStreamState(TOPIC_A, CORRELATION_B)).toBeUndefined()
	})

	it("第一个 StreamState 永不完成，后续 StreamState 永远饥饿。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ correlationId: CORRELATION_A, content: "A pending" }))
		store.receiveChunk(
			createChunk({ correlationId: CORRELATION_B, content: "B done", finishReason: "stop" }),
		)
		advanceRendering()

		expect(getProjectedNode(store, SUPER_MESSAGE_B)?.content).toBe("B done")
		expect(store.getStreamState(TOPIC_A, CORRELATION_B)).toBeUndefined()
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeDefined()
	})

	it("content Map 的插入顺序与消息顺序不同。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ correlationId: CORRELATION_B, content: "draft-b" }))
		store.receiveChunk(createChunk({ correlationId: CORRELATION_A, content: "draft-a" }))
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				correlationId: CORRELATION_B,
				appMessageId: "final-b",
				seqId: "20",
				content: "final-b",
			}),
		)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				correlationId: CORRELATION_A,
				appMessageId: "final-a",
				seqId: "10",
				content: "final-a",
			}),
		)
		advanceRendering()

		expect(getProjectedNode(store, SUPER_MESSAGE_A)?.content).toBe("final-a")
		expect(getProjectedNode(store, SUPER_MESSAGE_B)?.content).toBe("final-b")
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(store.getStreamState(TOPIC_A, CORRELATION_B)).toBeUndefined()
	})

	it("`completeStreamRendering()` 清除了错误的 correlation。", () => {
		const store = createStore()

		store.receiveChunk(
			createChunk({ correlationId: CORRELATION_A, content: "A", finishReason: "stop" }),
		)
		store.receiveChunk(createChunk({ correlationId: CORRELATION_B, content: "B pending" }))
		advanceRendering()

		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(store.getStreamState(TOPIC_A, CORRELATION_B)).toBeDefined()
		expect(getProjectedNode(store, SUPER_MESSAGE_B)?.content).toBe("B pending")

		store.receiveChunk(
			createChunk({
				correlationId: CORRELATION_B,
				i: 1,
				content: " done",
				finishReason: "stop",
			}),
		)
		expectSettled(store, {
			correlationId: CORRELATION_B,
			expected: { content: "B pending done" },
		})
	})

	it("complete 后 buffer 没有继续消费。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ content: "draft-a" }))
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({ correlationId: CORRELATION_A, content: "final-a" }),
		)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				correlationId: CORRELATION_B,
				appMessageId: "final-b",
				seqId: "101",
				content: "final-b",
			}),
		)
		advanceRendering()

		expect(getProjectedNode(store, SUPER_MESSAGE_A)?.content).toBe("final-a")
		expect(getProjectedNode(store, SUPER_MESSAGE_B)?.content).toBe("final-b")
	})

	it("complete 后立即被晚到 chunk 重新创建。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ content: "draft" }))
		store.enqueueMessage(TOPIC_A, createFinalEnvelope({ content: "final" }))
		advanceRendering()
		store.receiveChunk(createChunk({ i: 1, content: " late" }))
		advanceRendering(200)

		expect(getProjectedNode(store)?.content).toBe("final")
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(store.isTopicStreaming(TOPIC_A)).toBe(false)
	})

	it("后台标签页 timer 被浏览器降频，导致追平极慢。", () => {
		const store = createStore()
		const content = "background".repeat(2_048)

		store.receiveChunk(createChunk({ content, finishReason: "stop" }))
		store.setActiveTopicId(TOPIC_B)
		vi.advanceTimersByTime(30_000)
		store.setActiveTopicId(TOPIC_A)
		advanceRendering()

		expect(getProjectedNode(store)?.content).toBe(content)
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
	})

	it("大量同步 MobX 更新造成渲染阻塞。", () => {
		const store = createStore()
		const fragments = Array.from({ length: 128 }, (_, index) => `${index},`)

		fragments.forEach((content, index) => {
			store.receiveChunk(
				createChunk({
					i: index,
					content,
					finishReason: index === fragments.length - 1 ? "stop" : null,
				}),
			)
		})
		advanceRendering()

		expect(getProjectedNode(store)?.content).toBe(fragments.join(""))
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
	})

	it("final 内容很大，逐字追平耗时过长，业务看上去像卡死。", () => {
		const store = createStore()
		const finalContent = "最终正文".repeat(16_384)

		store.receiveChunk(createChunk({ content: "draft" }))
		store.enqueueMessage(TOPIC_A, createFinalEnvelope({ content: finalContent }))
		advanceRendering()

		expect(getProjectedNode(store)?.content).toBe(finalContent)
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
	})

	it("Final 单独到达时立即结束 StreamState，并由 render-only 状态温和补齐正文。", () => {
		const store = createStore()
		const finalContent = `draft${"F".repeat(100_000)}`

		store.receiveChunk(createChunk({ content: "draft" }))
		advanceRendering(32)
		store.enqueueMessage(TOPIC_A, createFinalEnvelope({ content: finalContent }))

		advanceRendering(FINAL_SETTLING_OBSERVATION_MS)
		const projectedLength = getProjectedNode(store)?.content?.length || 0
		expect(projectedLength).toBeGreaterThan("draft".length)
		expect(projectedLength).toBeLessThan(finalContent.length)
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(store.isTopicStreaming(TOPIC_A)).toBe(false)

		advanceRendering(FINAL_SETTLING_SAFETY_MS)
		expect(getProjectedNode(store)?.content).toBe(finalContent)
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
	})

	it("不同 super_message_id 的后继 Chunk 不会把已 Final 的 render-only 状态重建为 StreamState。", () => {
		const store = createStore()
		const finalContent = `draft-a${"A".repeat(100_000)}`

		store.receiveChunk(createChunk({ content: "draft-a" }))
		advanceRendering(32)
		store.enqueueMessage(TOPIC_A, createFinalEnvelope({ content: finalContent }))
		advanceRendering(FINAL_SETTLING_OBSERVATION_MS)
		expect(getProjectedNode(store)?.content).not.toBe(finalContent)

		store.receiveChunk(createChunk({ correlationId: CORRELATION_B, content: "next-stream" }))
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(store.getStreamState(TOPIC_A, CORRELATION_B)).toMatchObject({
			renderPace: "live",
		})

		advanceRendering(100)
		store.receiveChunk(
			createChunk({ correlationId: CORRELATION_B, i: 1, content: " continues" }),
		)
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(getProjectedNode(store)?.content).not.toBe(finalContent)
		advanceRendering(FINAL_SETTLING_SAFETY_MS)

		expect(getProjectedNode(store)?.content).toBe(finalContent)
		expect(getProjectedNode(store, SUPER_MESSAGE_B)?.content).toBe("next-stream continues")
	})

	it("不同 super_message_id 的后继 Final 不会恢复前一条消息的 StreamState。", () => {
		const store = createStore()
		const finalContent = `draft-a${"A".repeat(100_000)}`

		store.receiveChunk(createChunk({ content: "draft-a" }))
		advanceRendering(32)
		store.enqueueMessage(TOPIC_A, createFinalEnvelope({ content: finalContent }))
		advanceRendering(FINAL_SETTLING_OBSERVATION_MS)

		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				correlationId: CORRELATION_B,
				appMessageId: "final-b",
				seqId: "101",
				content: "next final",
			}),
		)

		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		advanceRendering(FINAL_SETTLING_SAFETY_MS)
		expect(getProjectedNode(store)?.content).toBe(finalContent)
		expect(getProjectedNode(store, SUPER_MESSAGE_B)?.content).toBe("next final")
	})

	it("Final 后只有 User 消息时 render-only 补齐不影响消息级流状态。", () => {
		const store = createStore()
		const finalContent = `draft-a${"A".repeat(100_000)}`

		store.receiveChunk(createChunk({ content: "draft-a" }))
		advanceRendering(32)
		store.enqueueMessage(TOPIC_A, createFinalEnvelope({ content: finalContent }))
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "user-next",
				correlationId: "user-next-correlation",
				seqId: "101",
				role: "user",
				content: "next question",
			}),
		)

		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		advanceRendering(FINAL_SETTLING_OBSERVATION_MS)
		expect(getProjectedNode(store)?.content).not.toBe(finalContent)
	})

	it("相同 super_message_id 的迟到 Chunk 被 Final barrier 拒绝。", () => {
		const store = createStore()
		const finalContent = `draft-a${"A".repeat(100_000)}`

		store.receiveChunk(createChunk({ content: "draft-a" }))
		advanceRendering(32)
		store.enqueueMessage(TOPIC_A, createFinalEnvelope({ content: finalContent }))
		store.receiveChunk(createChunk({ i: 1, content: " late" }))

		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(store.isTopicStreaming(TOPIC_A)).toBe(false)
	})

	it("其他 Topic 的 Chunk 不得恢复当前 Topic 已 Final 的 StreamState。", () => {
		const store = createStore()
		const finalContent = `draft-a${"A".repeat(100_000)}`

		store.receiveChunk(createChunk({ content: "draft-a" }))
		advanceRendering(32)
		store.enqueueMessage(TOPIC_A, createFinalEnvelope({ content: finalContent }))
		store.receiveChunk(
			createChunk({
				topicId: TOPIC_B,
				correlationId: CORRELATION_B,
				content: "other-topic",
			}),
		)

		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(store.getStreamState(TOPIC_B, CORRELATION_B)).toBeDefined()
	})

	it("后继压力晚到时从压力发生时重新计算预算，不能因旧 deadline 过期而单帧写完。", () => {
		let monotonicNow = 0
		vi.spyOn(performance, "now").mockImplementation(() => monotonicNow)
		const store = createStore()
		const finalContent = `draft-a${"A".repeat(100_000)}`

		store.receiveChunk(createChunk({ content: "draft-a" }))
		advanceRendering(32)
		store.enqueueMessage(TOPIC_A, createFinalEnvelope({ content: finalContent }))
		const beforePressureLength = getProjectedNode(store)?.content?.length || 0

		monotonicNow = 2_000
		store.receiveChunk(createChunk({ correlationId: CORRELATION_B, content: "next-stream" }))
		advanceRendering(16)

		const afterFirstCatchupFrameLength = getProjectedNode(store)?.content?.length || 0
		expect(afterFirstCatchupFrameLength).toBeGreaterThan(beforePressureLength)
		expect(afterFirstCatchupFrameLength).toBeLessThan(finalContent.length)
	})

	it("Final 的 render-only 状态让 reasoning 与 content 共享同一帧预算。", () => {
		const store = createStore()
		const contentOnlyStore = createStore()

		store.receiveChunk(createChunk({ content: "draft" }))
		contentOnlyStore.receiveChunk(createChunk({ content: "draft" }))
		advanceRendering(32)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				reasoningContent: "R".repeat(100),
				content: `draft${"C".repeat(10_000)}`,
			}),
		)
		contentOnlyStore.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({ content: `draft${"C".repeat(10_000)}` }),
		)
		const beforeFrame = getProjectedNode(store)
		const beforeReasoningLength = beforeFrame?.reasoning_content?.length || 0
		const beforeContentLength = beforeFrame?.content?.length || 0
		const beforeContentOnlyLength = getProjectedNode(contentOnlyStore)?.content?.length || 0
		advanceRendering(16)

		const afterFrame = getProjectedNode(store)
		const reasoningDelta = (afterFrame?.reasoning_content?.length || 0) - beforeReasoningLength
		const contentDelta = (afterFrame?.content?.length || 0) - beforeContentLength
		const contentOnlyDelta =
			(getProjectedNode(contentOnlyStore)?.content?.length || 0) - beforeContentOnlyLength
		expect(reasoningDelta).toBe(100)
		expect(contentDelta).toBeGreaterThan(0)
		expect(contentOnlyDelta).toBeGreaterThan(0)
		expect(reasoningDelta + contentDelta).toBe(contentOnlyDelta)
		advanceRendering(16)
		expect(getProjectedNode(store)?.content?.length || 0).toBeGreaterThan(beforeContentLength)
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
	})

	it("提高字符批量时仍保持 16ms 的渲染 timer 间隔。", () => {
		const store = createStore()
		const finalContent = `draft${"A".repeat(10_000)}`

		store.receiveChunk(createChunk({ content: "draft" }))
		advanceRendering(32)
		store.enqueueMessage(TOPIC_A, createFinalEnvelope({ content: finalContent }))
		const firstFrameLength = getProjectedNode(store)?.content?.length || 0

		advanceRendering(15)
		expect(getProjectedNode(store)?.content?.length).toBe(firstFrameLength)
		advanceRendering(1)
		expect(getProjectedNode(store)?.content?.length).toBeGreaterThan(firstFrameLength)
	})

	it("Final 插入活动 transport 时保留 StreamState，直到 finish_reason 后再结算。", () => {
		const store = createStore()

		for (let index = 0; index < 5; index += 1) {
			store.receiveChunk(createChunk({ i: index, content: String(index + 1) }))
		}
		advanceRendering(32)
		expect(getProjectedNode(store)?.content).toBe("12345")

		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({
				appMessageId: "higher-final",
				correlationId: CORRELATION_A,
				seqId: "100",
				content: "123456789",
			}),
		)

		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeDefined()
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)?.content).toBe("12345")
		expect(store.buffer.get(TOPIC_A)?.messages).toHaveLength(0)
		store.receiveChunk(
			createChunk({
				i: 5,
				correlationId: CORRELATION_A,
				content: "6789",
				finishReason: "stop",
			}),
		)

		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(store.getMessageNode(SUPER_MESSAGE_A)).toMatchObject({ content: "123456789" })
		advanceRendering(200)

		expect(getProjectedNode(store)?.content).toBe("123456789")
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(store.buffer.get(TOPIC_A)?.messages).toHaveLength(0)
	})

	it("`renderPolicy` 在 live、catchup、instant 间错误切换。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ correlationId: CORRELATION_A, content: "draft-a" }))
		store.setActiveTopicId(TOPIC_B)
		store.enqueueMessage(
			TOPIC_A,
			createFinalEnvelope({ correlationId: CORRELATION_A, content: "final-a" }),
		)
		advanceRendering()

		expect(getProjectedNode(store, SUPER_MESSAGE_A)?.content).toBe("final-a")
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()

		store.setActiveTopicId(TOPIC_A)
		store.receiveChunk(createChunk({ correlationId: CORRELATION_B, content: "new-live" }))
		advanceRendering(200)

		expect(getProjectedNode(store, SUPER_MESSAGE_B)?.content).toBe("new-live")
		expect(store.getStreamState(TOPIC_A, CORRELATION_B)).toBeDefined()
	})

	it("catchup 结束后没有恢复 live。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ correlationId: CORRELATION_A, content: "A" }))
		store.setActiveTopicId(TOPIC_B)
		store.receiveChunk(
			createChunk({
				correlationId: CORRELATION_A,
				i: 1,
				content: "B",
				finishReason: "stop",
			}),
		)
		store.setActiveTopicId(TOPIC_A)
		advanceRendering()

		expect(getProjectedNode(store, SUPER_MESSAGE_A)?.content).toBe("AB")
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()

		store.receiveChunk(createChunk({ correlationId: CORRELATION_B, content: "live-again" }))
		advanceRendering(200)
		expect(store.getStreamState(TOPIC_A, CORRELATION_B)).toBeDefined()
		expect(getProjectedNode(store, SUPER_MESSAGE_B)?.content).toBe("live-again")
	})

	it("完整成功的空 authoritative snapshot 终结旧流并拒绝在途晚包。", () => {
		const store = createStore()

		store.receiveChunk(createChunk({ content: "A" }))
		expect(getProjectedNode(store)).toBeDefined()
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeDefined()
		expect(store.isTopicStreaming(TOPIC_A)).toBe(true)
		const generation = store.beginTopicSync(TOPIC_A)
		store.initializeMessages(TOPIC_A, [])
		expect(
			store.completeTopicSync(TOPIC_A, generation, {
				succeeded: true,
				taskStatus: "finished",
				latestSeqId: "100",
			}),
		).toBe(true)
		expect(getProjectedNode(store)).toBeUndefined()
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(
			(store.messages.get(TOPIC_A) ?? []).filter(
				(message) => message.super_message_id === SUPER_MESSAGE_A,
			),
		).toHaveLength(0)
		expect(store.isTopicStreaming(TOPIC_A)).toBe(false)

		store.receiveChunk(createChunk({ i: 1, content: "B", finishReason: "stop" }))
		advanceRendering()

		expect(getProjectedNode(store)).toBeUndefined()
		expect(store.getStreamState(TOPIC_A, CORRELATION_A)).toBeUndefined()
		expect(
			(store.messages.get(TOPIC_A) ?? []).filter(
				(message) => message.super_message_id === SUPER_MESSAGE_A,
			),
		).toHaveLength(0)
		expect(store.isTopicStreaming(TOPIC_A)).toBe(false)
	})
})
