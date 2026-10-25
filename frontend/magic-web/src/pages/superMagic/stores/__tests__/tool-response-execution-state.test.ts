import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SeqRecordType, type SeqRecord } from "@/apis/modules/chat/types"
import { SuperMagicStore } from "@/pages/superMagic/stores"
import type { MessageCommittedEvent, ToolCallSettledEvent } from "@/pages/superMagic/stores/events"
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

const TOPIC_ID = "topic-tool-response"
const CORRELATION_ID = "correlation-tool-response"
const RENDER_SETTLE_MS = 2_500
const RENDER_FRAME_MS = 16
const MAX_RENDER_TICKS = 400

type ChunkToolCall =
	SuperMagicChunkMessage["super_magic_chunk"]["choices"][number]["delta"]["tool_calls"][number]

interface ToolState {
	id?: string
	name?: string
	status?: string
	action?: string
	remark?: string
	detail?: unknown
	attachments?: unknown
	show_in_ui?: boolean
}

interface ProjectedToolCall {
	id?: string
	index?: number
	type?: string
	function?: {
		name?: string
		arguments?: string
	}
	tool?: ToolState
}

interface ProjectedNode {
	role?: string
	status?: string
	content?: string | null
	tool_call_id?: string
	tool?: ToolState | null
	tool_calls?: ProjectedToolCall[] | null
}

interface AssistantOptions {
	appMessageId?: string
	correlationId?: string
	seqId?: string
	content?: string
	status?: string
	toolCalls?: ProjectedToolCall[]
	event?: string
}

interface ToolEnvelopeOptions {
	appMessageId?: string
	superMessageId?: string
	correlationId?: string
	seqId?: string
	toolId?: string
	legacyToolCallId?: string
	name?: string
	status?: string
	detail?: unknown
	attachments?: unknown
	nodeStatus?: string
	tool?: unknown
	includeTool?: boolean
	includeLegacyToolCallId?: boolean
}

function createToolCall({
	id = "tool-1",
	name = "read_file",
	toolName = name,
	index = 0,
	arguments: argumentsValue = "{}",
	status = "running",
	showInUi = true,
}: {
	id?: string
	name?: string
	toolName?: string
	index?: number
	arguments?: string
	status?: string
	showInUi?: boolean
} = {}): ProjectedToolCall {
	return {
		id,
		index,
		type: "function",
		function: { name, arguments: argumentsValue },
		tool: {
			id,
			name: toolName,
			status,
			show_in_ui: showInUi,
		},
	}
}

function createEnvelope({
	appMessageId,
	seqId,
	node,
}: {
	appMessageId: string
	seqId: string
	node: SuperMagicNode
}): RawSuperMagicMessageEnvelope {
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
				sender_id: node.role === "tool" ? "tool-runner" : "assistant-1",
				send_time: Number(seqId.replace(/\D/g, "")) || 1,
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

function createAssistantEnvelope({
	appMessageId = "assistant-final-1",
	correlationId = CORRELATION_ID,
	seqId = "100",
	content = "assistant response",
	status = "finished",
	toolCalls = [createToolCall()],
	event,
}: AssistantOptions = {}): RawSuperMagicMessageEnvelope {
	return createEnvelope({
		appMessageId,
		seqId,
		node: {
			role: "assistant",
			topic_id: TOPIC_ID,
			message_id: `node-${appMessageId}`,
			super_message_id: toAssistantSuperMessageId(correlationId),
			correlation_id: correlationId,
			content,
			reasoning_content: "",
			tool_calls: toolCalls,
			status,
			event,
			send_timestamp: 1,
		},
	})
}

function createToolEnvelope(options: ToolEnvelopeOptions = {}): RawSuperMagicMessageEnvelope {
	const {
		appMessageId = "tool-response-1",
		superMessageId = toToolSuperMessageId(appMessageId),
		correlationId = CORRELATION_ID,
		seqId = "101",
		toolId = "tool-1",
		legacyToolCallId = "legacy-tool-call-id",
		name = "read_file",
		status = "finished",
		detail = { type: "json", data: { ok: true } },
		attachments = [],
		nodeStatus = "finished",
		tool,
		includeTool = true,
		includeLegacyToolCallId = false,
	} = options
	const node: SuperMagicNode = {
		role: "tool",
		topic_id: TOPIC_ID,
		message_id: `node-${appMessageId}`,
		super_message_id: superMessageId,
		correlation_id: correlationId,
		content: null,
		reasoning_content: null,
		status: nodeStatus,
		send_timestamp: 1,
	}
	// Normal tool-response fixtures intentionally omit tool_call_id: canonical
	// association must be proven through tool.id rather than an equal legacy field.
	if (includeLegacyToolCallId) node.tool_call_id = legacyToolCallId
	if (includeTool) {
		// Explicit null/array payloads must reach the Store unchanged; otherwise the
		// fixture silently tests the default valid response instead of malformed input.
		node.tool = Object.prototype.hasOwnProperty.call(options, "tool")
			? (tool as SuperMagicNode["tool"])
			: ({
					id: toolId,
					name,
					action: `execute ${name}`,
					status,
					remark: `${name} result`,
					detail,
					attachments,
				} satisfies ToolState)
	}

	return createEnvelope({ appMessageId, seqId, node })
}

type SharedMessageFixture = Parameters<SuperMagicStore["loadSharedMessages"]>[0][number]

function createSharedAssistantMessage(options: {
	messageId: string
	correlationId: string
	toolCalls?: ProjectedToolCall[] | null
	topicId?: string
}): SharedMessageFixture {
	const { messageId, correlationId, toolCalls, topicId = TOPIC_ID } = options
	const rawNode: Record<string, unknown> = {
		role: "assistant",
		topic_id: topicId,
		correlation_id: correlationId,
		content: "shared assistant response",
		status: "running",
		message_id: messageId,
	}
	if (Object.prototype.hasOwnProperty.call(options, "toolCalls")) {
		rawNode.tool_calls = toolCalls
	}

	return {
		message_id: messageId,
		type: "super_magic_message",
		raw_content: {
			super_magic_message: rawNode,
		},
	}
}

function createSharedToolMessage({
	messageId,
	toolId,
	topicId = TOPIC_ID,
	correlationId = `tool-correlation-${toolId}`,
	status = "finished",
}: {
	messageId: string
	toolId: string
	topicId?: string
	correlationId?: string
	status?: string
}): SharedMessageFixture {
	return {
		message_id: messageId,
		type: "super_magic_message",
		raw_content: {
			super_magic_message: {
				role: "tool",
				topic_id: topicId,
				correlation_id: correlationId,
				tool_call_id: toolId,
				tool: {
					id: toolId,
					name: "list_dir",
					status,
					detail: { type: "json", data: { ok: true } },
				},
			},
		},
	}
}

function createToolHeaderChunk({
	correlationId = CORRELATION_ID,
	toolCall = createToolCall(),
}: {
	correlationId?: string
	toolCall?: ProjectedToolCall
} = {}): SuperMagicChunkMessage {
	return {
		magic_message_id: "magic-tool-header",
		app_message_id: "app-tool-header",
		type: IntermediateMessageType.SuperMagicChunk,
		project_id: "project-1",
		topic_id: TOPIC_ID,
		chat_topic_id: TOPIC_ID,
		message_id: `completion-${correlationId}`,
		super_magic_chunk: {
			super_message_id: `super-${correlationId}`,
			task_id: `task-${correlationId}`,
			i: 0,
			usage: null,
			correlation_id: correlationId,
			choices: [
				{
					...({ index: 0 } as const),
					finish_reason: null,
					delta: {
						content: "",
						role: "assistant",
						tool_calls: [toolCall as ChunkToolCall],
						reasoning_content: "",
						index: 0,
					},
				},
			],
		},
	}
}

function createAssistantContentChunk({
	correlationId,
	superMessageId = toAssistantSuperMessageId(correlationId),
	i = 0,
	content = "next assistant",
}: {
	correlationId: string
	superMessageId?: string
	i?: number
	content?: string
}): SuperMagicChunkMessage {
	return {
		magic_message_id: `magic-${correlationId}-${i}`,
		app_message_id: `app-${correlationId}-${i}`,
		type: IntermediateMessageType.SuperMagicChunk,
		project_id: "project-1",
		topic_id: TOPIC_ID,
		chat_topic_id: TOPIC_ID,
		message_id: `completion-${correlationId}`,
		super_magic_chunk: {
			super_message_id: superMessageId,
			task_id: `task-${correlationId}`,
			i,
			usage: null,
			correlation_id: correlationId,
			choices: [
				{
					...({ index: 0 } as const),
					finish_reason: null,
					delta: {
						content,
						role: "assistant",
						tool_calls: [],
						reasoning_content: "",
						index: 0,
					},
				},
			],
		},
	}
}

function createStore(): SuperMagicStore {
	const store = new SuperMagicStore()
	store.setActiveTopicId(TOPIC_ID)
	return store
}

function settleRendering(milliseconds = RENDER_SETTLE_MS): void {
	vi.advanceTimersByTime(milliseconds)
}

function advanceUntil(
	condition: () => boolean,
	description: string,
	maxTicks = MAX_RENDER_TICKS,
): void {
	// Rendering uses a self-scheduling 16ms timer. Bound the wait by an observable
	// postcondition instead of runAllTimers(), which could chase recovery timers forever.
	for (let tick = 0; tick < maxTicks; tick += 1) {
		if (condition()) return
		if (vi.getTimerCount() === 0) break
		vi.advanceTimersByTime(RENDER_FRAME_MS)
	}

	throw new Error(`Condition not reached: ${description}`)
}

function toAssistantSuperMessageId(correlationId = CORRELATION_ID): string {
	return `super-${correlationId}`
}

function toToolSuperMessageId(appMessageId: string): string {
	return `super-${appMessageId}`
}

function getNode(store: SuperMagicStore, superMessageId: string): ProjectedNode | undefined {
	const node = store.getMessageNode(superMessageId)
	return node && typeof node === "object" ? (node as ProjectedNode) : undefined
}

function getToolNode(store: SuperMagicStore, appMessageId: string): ProjectedNode | undefined {
	return getNode(store, toToolSuperMessageId(appMessageId))
}

function getAssistantNode(
	store: SuperMagicStore,
	correlationId = CORRELATION_ID,
): ProjectedNode | undefined {
	return getNode(store, toAssistantSuperMessageId(correlationId))
}

function getAssistantTool(
	store: SuperMagicStore,
	toolCallId = "tool-1",
	correlationId = CORRELATION_ID,
): ProjectedToolCall | undefined {
	return getAssistantNode(store, correlationId)?.tool_calls?.find(
		(toolCall) => toolCall.id === toolCallId,
	)
}

function getEmbeddedToolState(
	store: SuperMagicStore,
	toolCallId = "tool-1",
	correlationId = CORRELATION_ID,
): ToolState | undefined {
	return getAssistantTool(store, toolCallId, correlationId)?.tool
}

function getCanonicalToolState(
	store: SuperMagicStore,
	toolId: string,
	topicId = TOPIC_ID,
): ToolState | undefined {
	return store.toolResponseMap.get(topicId)?.get(toolId) as ToolState | undefined
}

function getEffectiveToolState(
	store: SuperMagicStore,
	toolId: string,
	correlationId = CORRELATION_ID,
	topicId = TOPIC_ID,
): ToolState | undefined {
	// Match the UI's precedence: an authoritative tool response map entry wins over the streamed assistant projection.
	return (
		getCanonicalToolState(store, toolId, topicId) ??
		getEmbeddedToolState(store, toolId, correlationId)
	)
}

function cloneEnvelope(envelope: RawSuperMagicMessageEnvelope): RawSuperMagicMessageEnvelope {
	return JSON.parse(JSON.stringify(envelope)) as RawSuperMagicMessageEnvelope
}

function getAssistantCardCount(store: SuperMagicStore): number {
	return (store.messages.get(TOPIC_ID) ?? []).filter((message) => message.role === "assistant")
		.length
}

function collectArrivals(store: SuperMagicStore): {
	events: MessageCommittedEvent[]
	unsubscribe: () => void
} {
	const events: MessageCommittedEvent[] = []
	const unsubscribe = store.subscribe("message.committed", (event) => events.push(event), {
		scope: { topicId: TOPIC_ID },
	})
	return { events, unsubscribe }
}

describe("SuperMagicStore / Tool response 与执行状态", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.clearAllTimers()
		vi.useRealTimers()
	})

	it("tool response 先于所属 Assistant call 到达时只保留 raw，不建立 canonical 关联。", () => {
		const store = createStore()

		store.enqueueMessage(TOPIC_ID, createToolEnvelope())
		expect(getToolNode(store, "tool-response-1")).toMatchObject({
			role: "tool",
			tool: {
				id: "tool-1",
				status: "finished",
			},
		})
		expect(
			(store.messages.get(TOPIC_ID) ?? []).filter((message) => message.role === "tool"),
		).toEqual([
			expect.objectContaining({
				role: "tool",
				app_message_id: "tool-response-1",
				super_message_id: toToolSuperMessageId("tool-response-1"),
			}),
		])
		expect(Array.from(store.toolResponseMap.get(TOPIC_ID)?.keys() ?? [])).toEqual([])
		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope())
		settleRendering()

		expect.soft(getToolNode(store, "tool-response-1")).toMatchObject({
			role: "tool",
			tool: {
				id: "tool-1",
				status: "finished",
			},
		})
		expect.soft(getAssistantNode(store)).toMatchObject({
			role: "assistant",
			content: "assistant response",
		})
		const messages = store.messages.get(TOPIC_ID) ?? []
		expect.soft(messages).toHaveLength(2)
		expect.soft(messages.filter((message) => message.role === "tool")).toEqual([
			expect.objectContaining({
				role: "tool",
				app_message_id: "tool-response-1",
				super_message_id: toToolSuperMessageId("tool-response-1"),
			}),
		])
		expect.soft(messages.filter((message) => message.role === "assistant")).toEqual([
			expect.objectContaining({
				role: "assistant",
				app_message_id: "assistant-final-1",
				super_message_id: toAssistantSuperMessageId(),
			}),
		])
		expect.soft(getEmbeddedToolState(store)?.status).toBe("running")
		expect.soft(getCanonicalToolState(store, "tool-1")).toMatchObject({
			id: "tool-1",
			status: "response_missing",
		})
		expect.soft(getEffectiveToolState(store, "tool-1")?.status).toBe("response_missing")
		expect.soft(getAssistantCardCount(store)).toBe(1)
	})

	it("tool response 先于工具头到达时不得被后续 Assistant call 追认。", () => {
		const store = createStore()

		store.enqueueMessage(TOPIC_ID, createToolEnvelope())
		store.receiveChunk(createToolHeaderChunk())
		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope())
		settleRendering()

		expect(getAssistantTool(store)?.id).toBe("tool-1")
		expect(getEmbeddedToolState(store)?.status).toBe("running")
		expect(getCanonicalToolState(store, "tool-1")?.status).toBe("response_missing")
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("response_missing")
	})

	it("普通 tool response 在任何 Assistant call 前到达时不进入 canonical Map。", () => {
		const store = createStore()

		store.enqueueMessage(TOPIC_ID, createToolEnvelope())

		expect(getToolNode(store, "tool-response-1")).toMatchObject({
			role: "tool",
			tool: { id: "tool-1", status: "finished" },
		})
		expect(getToolNode(store, "tool-response-1")?.tool_call_id).toBeUndefined()
		expect(getCanonicalToolState(store, "tool-1")).toBeUndefined()
		expect(store.isTopicStreaming(TOPIC_ID)).toBe(false)
	})

	it("普通 tool response 的所属 call 从未出现时只保留 raw。", () => {
		const store = createStore()

		store.enqueueMessage(TOPIC_ID, createToolEnvelope({ toolId: "orphan-tool" }))
		settleRendering(100)

		expect(getToolNode(store, "tool-response-1")?.tool).toMatchObject({
			id: "orphan-tool",
			status: "finished",
		})
		expect(getCanonicalToolState(store, "orphan-tool")).toBeUndefined()
		expect(getAssistantNode(store)).toBeUndefined()
	})

	it("任务仍在运行且没有完成屏障时，缺失的 tool response 保持等待态。", () => {
		const store = createStore()

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope({ status: "running" }))
		settleRendering()

		expect(getAssistantTool(store)).toBeDefined()
		expect(getEmbeddedToolState(store)?.status).toBe("running")
		expect(getCanonicalToolState(store, "tool-1")).toBeUndefined()
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("running")
		expect(getToolNode(store, "tool-response-1")).toBeUndefined()
	})

	it("活动 Assistant 渲染期间，response_missing 兜底也必须立即取消 Tool loading。", () => {
		const store = createStore()
		const ownerSuperMessageId = toAssistantSuperMessageId(CORRELATION_ID)
		const embeddedTool = createToolCall({ status: "running" })

		store.receiveChunk(createToolHeaderChunk())
		expect(store.getStreamState(TOPIC_ID, ownerSuperMessageId)).toBeDefined()
		expect(
			(
				store.getToolResponseForRendering(
					TOPIC_ID,
					ownerSuperMessageId,
					embeddedTool,
				) as ToolState
			)?.status,
		).toBe("running")

		store.toolResponseMap.set(
			TOPIC_ID,
			new Map([
				[
					"tool-1",
					{
						id: "tool-1",
						name: "read_file",
						status: "response_missing",
					},
				],
			]),
		)

		expect(
			(
				store.getToolResponseForRendering(
					TOPIC_ID,
					ownerSuperMessageId,
					embeddedTool,
				) as ToolState
			)?.status,
		).toBe("response_missing")
	})

	it("同一个 tool response 重复到达。", () => {
		const store = createStore()
		const arrivals = collectArrivals(store)
		const response = createToolEnvelope()

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope({ status: "running" }))
		store.enqueueMessage(TOPIC_ID, response)
		store.enqueueMessage(TOPIC_ID, cloneEnvelope(response))
		settleRendering(100)

		const toolArrivals = arrivals.events.filter(
			(event) => event.payload.message.appMessageId === "tool-response-1",
		)
		expect(toolArrivals).toHaveLength(1)
		expect(getToolNode(store, "tool-response-1")?.tool?.status).toBe("finished")
		expect(getCanonicalToolState(store, "tool-1")?.status).toBe("finished")
		arrivals.unsubscribe()
	})

	it("同一个 tool id 的低 seq response 不覆盖已到达的高 seq response。", () => {
		const store = createStore()
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const arrivals = collectArrivals(store)

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope())
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-response-latest",
				seqId: "102",
				detail: { type: "text", data: "latest" },
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-response-stale",
				seqId: "101",
				detail: { type: "text", data: "old" },
			}),
		)
		settleRendering()

		expect(getToolNode(store, "tool-response-latest")?.tool?.detail).toEqual({
			type: "text",
			data: "latest",
		})
		expect(getToolNode(store, "tool-response-stale")?.tool?.detail).toEqual({
			type: "text",
			data: "old",
		})
		expect(getCanonicalToolState(store, "tool-1")?.detail).toEqual({
			type: "text",
			data: "latest",
		})
		expect(getEffectiveToolState(store, "tool-1")?.detail).toEqual({
			type: "text",
			data: "latest",
		})
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("stale tool response"),
			expect.objectContaining({
				toolCallId: "tool-1",
				incomingSeqId: "101",
				latestSeqId: "102",
			}),
		)
		expect(
			arrivals.events.some(
				(event) => event.payload.message.appMessageId === "tool-response-stale",
			),
		).toBe(true)
		arrivals.unsubscribe()
		warnSpy.mockRestore()
	})

	it("同一个 tool id 的高 seq response 覆盖先到达的低 seq response。", () => {
		const store = createStore()

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope({ status: "running" }))
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-response-old",
				seqId: "101",
				detail: { type: "text", data: "old" },
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-response-latest",
				seqId: "102",
				detail: { type: "text", data: "latest" },
			}),
		)
		settleRendering()

		expect(getCanonicalToolState(store, "tool-1")?.detail).toEqual({
			type: "text",
			data: "latest",
		})
	})

	it("同 seq 且内容等价的重复 response 不覆盖 canonical 状态。", () => {
		const store = createStore()
		const settled: ToolCallSettledEvent[] = []
		store.subscribe("toolCall.settled", (event) => settled.push(event), {
			scope: { topicId: TOPIC_ID, toolCallId: "tool-1" },
		})

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope({ status: "running" }))
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-response-first",
				seqId: "101",
				detail: { type: "text", data: "same" },
			}),
		)
		expect(getCanonicalToolState(store, "tool-1")).toEqual(
			expect.objectContaining({
				id: "tool-1",
				status: "finished",
				detail: { type: "text", data: "same" },
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			cloneEnvelope(
				createToolEnvelope({
					appMessageId: "tool-response-duplicate",
					seqId: "101",
					detail: { type: "text", data: "same" },
				}),
			),
		)

		expect(getCanonicalToolState(store, "tool-1")).toEqual(
			expect.objectContaining({
				id: "tool-1",
				status: "finished",
				detail: { type: "text", data: "same" },
			}),
		)
		expect(settled).toHaveLength(1)
		expect(settled[0]).toMatchObject({
			meta: { toolCallId: "tool-1" },
			payload: {
				response: { status: "finished", detail: { type: "text", data: "same" } },
				strength: "strong",
				replaceable: false,
			},
		})
	})

	it("同 seq 但内容冲突的 response 保留首次结果并记录冲突。", () => {
		const store = createStore()
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope({ status: "running" }))
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-response-first",
				seqId: "101",
				detail: { type: "text", data: "first" },
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-response-conflict",
				seqId: "101",
				detail: { type: "text", data: "conflict" },
			}),
		)

		expect(getCanonicalToolState(store, "tool-1")?.detail).toEqual({
			type: "text",
			data: "first",
		})
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("conflicting tool response"),
			expect.objectContaining({
				toolCallId: "tool-1",
				seqId: "101",
			}),
		)
		warnSpy.mockRestore()
	})

	it("同 seq 的 response 允许只补齐此前缺失的字段。", () => {
		const store = createStore()

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope({ status: "running" }))
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-response-without-attachments",
				seqId: "101",
				tool: {
					id: "tool-1",
					name: "read_file",
					status: "finished",
					detail: { type: "text", data: "same" },
				},
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-response-with-attachments",
				seqId: "101",
				tool: {
					id: "tool-1",
					name: "read_file",
					status: "finished",
					detail: { type: "text", data: "same" },
					attachments: [{ file_id: "file-1" }],
				},
			}),
		)

		expect(getCanonicalToolState(store, "tool-1")?.attachments).toEqual([{ file_id: "file-1" }])
	})

	it("initializeMessages 的低 seq tool response 不覆盖已有 canonical 状态。", () => {
		const store = createStore()

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope({ status: "running" }))
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-response-latest",
				seqId: "102",
				detail: { type: "text", data: "latest" },
			}),
		)
		store.initializeMessages(TOPIC_ID, [
			createToolEnvelope({
				appMessageId: "tool-response-stale-from-http",
				seqId: "101",
				detail: { type: "text", data: "old" },
			}),
		])

		expect(getToolNode(store, "tool-response-stale-from-http")?.tool?.detail).toEqual({
			type: "text",
			data: "old",
		})
		expect(getCanonicalToolState(store, "tool-1")?.detail).toEqual({
			type: "text",
			data: "latest",
		})
	})

	it("HTTP 历史快照倒序返回 Tool 后 Assistant 时，仍先建立 owner 再恢复真实终态。", () => {
		const store = createStore()

		store.initializeMessages(
			TOPIC_ID,
			[
				createToolEnvelope({ appMessageId: "historical-tool-desc", seqId: "101" }),
				createAssistantEnvelope({
					appMessageId: "historical-assistant-desc",
					seqId: "100",
					status: "running",
				}),
			],
			{ mode: "merge" },
		)

		expect(getCanonicalToolState(store, "tool-1")).toMatchObject({
			id: "tool-1",
			status: "finished",
		})
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("finished")
	})

	it("HTTP 历史分页跨页先到 Tool、后到 Assistant 时，后续 owner 建立后重放待关联响应。", () => {
		const store = createStore()

		store.initializeMessages(
			TOPIC_ID,
			[createToolEnvelope({ appMessageId: "historical-tool-page-1", seqId: "101" })],
			{ mode: "merge" },
		)
		expect(getCanonicalToolState(store, "tool-1")).toBeUndefined()

		store.initializeMessages(
			TOPIC_ID,
			[
				createAssistantEnvelope({
					appMessageId: "historical-assistant-page-2",
					seqId: "100",
					status: "running",
				}),
			],
			{ mode: "merge" },
		)

		expect(getCanonicalToolState(store, "tool-1")).toMatchObject({
			id: "tool-1",
			status: "finished",
		})
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("finished")
	})

	it.each([
		{
			name: "缺失",
			tool: {
				id: "tool-1",
				name: "read_file",
				detail: { type: "text", data: "partial result" },
			},
		},
		{
			name: "未知",
			tool: {
				id: "tool-1",
				name: "read_file",
				status: "unknown_status",
				detail: { type: "text", data: "partial result" },
			},
		},
	])("HTTP 历史 Tool status $name 时投影为 response_missing，并保留已有载荷。", ({ tool }) => {
		const store = createStore()

		store.initializeMessages(TOPIC_ID, [
			createAssistantEnvelope({ status: "running" }),
			createToolEnvelope({ tool }),
		])

		expect(getCanonicalToolState(store, "tool-1")).toMatchObject({
			id: "tool-1",
			status: "response_missing",
			detail: { type: "text", data: "partial result" },
		})
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("response_missing")
	})

	it("HTTP canonical Final 即使 status=running 也结束同一 SuperMessage 的活跃本地流。", () => {
		const store = createStore()
		const activeToolCall = createToolCall({ id: "active-local-tool", status: "running" })
		store.receiveChunk(
			createToolHeaderChunk({
				correlationId: "active-local-correlation",
				toolCall: activeToolCall,
			}),
		)
		expect(store.isTopicStreaming(TOPIC_ID)).toBe(true)

		const historicalAssistant = createAssistantEnvelope({
			appMessageId: "active-local-assistant",
			correlationId: "active-local-correlation",
			status: "running",
			toolCalls: [activeToolCall],
		})

		store.initializeMessages(TOPIC_ID, [historicalAssistant], {
			mode: "merge",
			assistantSnapshotPolicy: "canonical_final",
			toolProjectionPolicy: "historical_terminal",
		})

		expect(getCanonicalToolState(store, "active-local-tool")).toMatchObject({
			id: "active-local-tool",
			status: "response_missing",
		})
		expect(
			getEffectiveToolState(store, "active-local-tool", "active-local-correlation")?.status,
		).toBe("response_missing")
		expect(store.isTopicStreaming(TOPIC_ID)).toBe(false)
	})

	it("tool response 先是 `finished`，后又收到 `running`。", () => {
		const store = createStore()

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope())
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({ appMessageId: "tool-finished", status: "finished", seqId: "101" }),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({ appMessageId: "tool-running", status: "running", seqId: "102" }),
		)
		settleRendering()

		expect(getCanonicalToolState(store, "tool-1")?.status).toBe("finished")
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("finished")
	})

	it("tool response 已是 `running`，后到的 `waiting` 只补载荷、不回滚状态。", () => {
		const store = createStore()
		const attachments = [{ file_id: "late-file" }]

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope({ status: "running" }))
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-running",
				status: "running",
				seqId: "101",
				detail: { type: "text", data: "started" },
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-waiting",
				status: "waiting",
				seqId: "102",
				detail: { type: "text", data: "late detail" },
				attachments,
			}),
		)
		settleRendering()

		expect(getCanonicalToolState(store, "tool-1")).toMatchObject({
			status: "running",
			detail: { type: "text", data: "late detail" },
			attachments,
		})
	})

	it("tool response 先是 `error`，后又收到 `finished`。", () => {
		const store = createStore()

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope())
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({ appMessageId: "tool-error", status: "error", seqId: "101" }),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-retry-finished",
				status: "finished",
				seqId: "102",
			}),
		)
		settleRendering()

		expect(getCanonicalToolState(store, "tool-1")?.status).toBe("finished")
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("finished")
	})

	it("tool response 先是占位 `response_missing`，后收到真实结果。", () => {
		const store = createStore()

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope())
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-missing",
				status: "response_missing",
				seqId: "101",
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({ appMessageId: "tool-real", status: "finished", seqId: "102" }),
		)
		settleRendering()

		expect(getCanonicalToolState(store, "tool-1")?.status).toBe("finished")
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("finished")
	})

	it("真实结果先到，后又被弱终态占位覆盖。", () => {
		const store = createStore()

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope())
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({ appMessageId: "tool-real", status: "finished", seqId: "101" }),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-missing-late",
				status: "response_missing",
				seqId: "102",
			}),
		)
		settleRendering()

		expect(getCanonicalToolState(store, "tool-1")?.status).toBe("finished")
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("finished")
	})

	it("tool_call_id 与 tool.id 冲突时，以 tool.id 作为关联主键。", () => {
		const store = createStore()
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope())
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				toolId: "tool-1",
				legacyToolCallId: "wrong-legacy-tool-id",
				includeLegacyToolCallId: true,
			}),
		)
		settleRendering()

		expect(getToolNode(store, "tool-response-1")).toMatchObject({
			tool_call_id: "wrong-legacy-tool-id",
			tool: { id: "tool-1", status: "finished" },
		})
		expect(getCanonicalToolState(store, "tool-1")).toMatchObject({
			id: "tool-1",
			status: "finished",
		})
		expect(getCanonicalToolState(store, "wrong-legacy-tool-id")).toBeUndefined()
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("finished")
		expect(warnSpy).toHaveBeenCalledWith(
			"[SuperMagicStore] tool response id conflict",
			expect.objectContaining({
				topicId: TOPIC_ID,
				toolId: "tool-1",
				toolCallId: "wrong-legacy-tool-id",
			}),
		)
		warnSpy.mockRestore()
	})

	it("tool.id 与 assistant tool call id 不一致时，不使用 tool_call_id 兜底关联。", () => {
		const store = createStore()

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope({ status: "running" }))
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				toolId: "orphan-tool-id",
				legacyToolCallId: "tool-1",
				includeLegacyToolCallId: true,
			}),
		)
		settleRendering()

		expect(getCanonicalToolState(store, "orphan-tool-id")).toBeUndefined()
		expect(getCanonicalToolState(store, "tool-1")).toBeUndefined()
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("running")
	})

	it("tool response 只有 `tool_call_id`，`tool.id` 缺失。", () => {
		const store = createStore()
		const toolWithoutId = {
			name: "read_file",
			status: "finished",
			detail: { type: "json", data: { ok: true } },
		}

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope({ status: "running" }))
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				tool: toolWithoutId,
				legacyToolCallId: "tool-1",
				includeLegacyToolCallId: true,
			}),
		)
		settleRendering()

		expect(getToolNode(store, "tool-response-1")).toMatchObject({
			tool_call_id: "tool-1",
			tool: { status: "finished" },
		})
		expect(getCanonicalToolState(store, "tool-1")).toBeUndefined()
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("running")
	})

	it("tool response 只有 `tool.id`，`tool_call_id` 缺失。", () => {
		const store = createStore()

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope())
		store.enqueueMessage(TOPIC_ID, createToolEnvelope())
		settleRendering()

		expect(getCanonicalToolState(store, "tool-1")).toMatchObject({
			id: "tool-1",
			status: "finished",
		})
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("finished")
	})

	it("initializeMessages 中 ID 冲突时仍以 tool.id 建立 canonical 关联。", () => {
		const store = createStore()

		store.initializeMessages(TOPIC_ID, [
			createAssistantEnvelope({
				appMessageId: "http-assistant-with-tool",
				status: "running",
			}),
			createToolEnvelope({
				appMessageId: "http-tool-response",
				toolId: "tool-1",
				legacyToolCallId: "wrong-http-tool-call-id",
				includeLegacyToolCallId: true,
			}),
		])

		expect(getCanonicalToolState(store, "tool-1")).toMatchObject({
			id: "tool-1",
			status: "finished",
		})
		expect(getCanonicalToolState(store, "wrong-http-tool-call-id")).toBeUndefined()
	})

	it("loadSharedMessages 中 ID 冲突时仍以 tool.id 建立 canonical 关联。", () => {
		const store = createStore()
		const sharedCorrelationId = "shared-tool-correlation"
		const sharedToolMessage = {
			message_id: "shared-tool-response",
			topic_id: TOPIC_ID,
			type: "super_magic_message",
			raw_content: {
				super_magic_message: {
					role: "tool",
					topic_id: TOPIC_ID,
					correlation_id: sharedCorrelationId,
					tool_call_id: "wrong-shared-tool-call-id",
					tool: {
						id: "tool-1",
						name: "read_file",
						status: "finished",
					},
				},
			},
		} as unknown as Parameters<SuperMagicStore["loadSharedMessages"]>[0][number]

		store.loadSharedMessages([
			createSharedAssistantMessage({
				messageId: "shared-assistant-with-tool",
				correlationId: sharedCorrelationId,
				toolCalls: [createToolCall()],
			}),
			sharedToolMessage,
		])

		expect(getCanonicalToolState(store, "tool-1")).toMatchObject({
			id: "tool-1",
			status: "finished",
		})
		expect(getCanonicalToolState(store, "wrong-shared-tool-call-id")).toBeUndefined()
	})

	it("分享流水缺少 tool response 时由下一 Assistant 结算，迟到真实响应仍可覆盖。", () => {
		const store = createStore()
		const toolId = "shared-lost-list-dir"

		store.loadSharedMessages([
			createSharedAssistantMessage({
				messageId: "1000",
				correlationId: "shared-list-dir-correlation",
				toolCalls: [createToolCall({ id: toolId, name: "list_dir" })],
			}),
		])

		expect(getCanonicalToolState(store, toolId)).toBeUndefined()
		expect(getCanonicalToolState(store, toolId, "")).toBeUndefined()

		store.loadSharedMessages([
			createSharedAssistantMessage({
				messageId: "1001",
				correlationId: "shared-following-correlation",
				toolCalls: [],
			}),
		])

		expect(getCanonicalToolState(store, toolId)).toMatchObject({
			id: toolId,
			name: "list_dir",
			status: "response_missing",
		})
		expect(getCanonicalToolState(store, toolId, "")).toBeUndefined()
		expect(getNode(store, "1000")?.tool_calls?.[0]?.tool?.status).toBe("running")

		store.loadSharedMessages([
			createSharedToolMessage({
				messageId: "1002",
				toolId,
				correlationId: "shared-list-dir-correlation",
			}),
		])

		expect(getCanonicalToolState(store, toolId)).toMatchObject({
			id: toolId,
			status: "finished",
			detail: { type: "json", data: { ok: true } },
		})
	})

	it("重复回放旧 Assistant 不会把最新 Assistant 的工具误判为 response_missing。", () => {
		const store = createStore()

		const firstAssistant = createSharedAssistantMessage({
			messageId: "2000",
			correlationId: "shared-first-correlation",
			toolCalls: [createToolCall({ id: "shared-first-tool" })],
		})
		const latestAssistant = createSharedAssistantMessage({
			messageId: "2001",
			correlationId: "shared-latest-correlation",
			toolCalls: [createToolCall({ id: "shared-latest-tool" })],
		})

		store.loadSharedMessages([firstAssistant, latestAssistant])

		expect(getCanonicalToolState(store, "shared-first-tool")?.status).toBe("response_missing")
		expect(getCanonicalToolState(store, "shared-latest-tool")).toBeUndefined()

		store.loadSharedMessages([firstAssistant])

		expect(getCanonicalToolState(store, "shared-latest-tool")).toBeUndefined()
	})

	it("tool response 的 tool 字段为数组时，不污染 canonical 状态。", () => {
		const store = createStore()
		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope({ status: "running" }))

		expect(() =>
			store.enqueueMessage(
				TOPIC_ID,
				createToolEnvelope({
					appMessageId: "invalid-array-response",
					tool: [{ id: "tool-1", status: "finished" }],
				}),
			),
		).not.toThrow()
		settleRendering()
		expect(getCanonicalToolState(store, "tool-1")).toBeUndefined()
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("running")

		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({ appMessageId: "valid-tool-response", seqId: "102" }),
		)
		settleRendering()
		expect(getCanonicalToolState(store, "tool-1")?.status).toBe("finished")
	})

	it("tool response 的 tool 字段为 null 时，不污染 canonical 状态。", () => {
		const store = createStore()
		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope({ status: "running" }))

		expect(() =>
			store.enqueueMessage(
				TOPIC_ID,
				createToolEnvelope({ appMessageId: "invalid-null-response", tool: null }),
			),
		).not.toThrow()
		settleRendering()
		expect(getCanonicalToolState(store, "tool-1")).toBeUndefined()
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("running")

		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({ appMessageId: "valid-tool-response", seqId: "102" }),
		)
		settleRendering()
		expect(getCanonicalToolState(store, "tool-1")?.status).toBe("finished")
	})

	it("未知 tool status 保留载荷，并在没有 canonical 状态时回退为 running。", () => {
		const store = createStore()
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

		// Keep the assistant non-terminal so this test starts without a synthetic response_missing state.
		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope({ status: "running" }))
		store.enqueueMessage(TOPIC_ID, createToolEnvelope({ status: "teleporting" }))
		settleRendering()

		expect(getToolNode(store, "tool-response-1")?.tool?.status).toBe("teleporting")
		expect(getCanonicalToolState(store, "tool-1")).toMatchObject({
			id: "tool-1",
			status: "running",
			detail: { type: "json", data: { ok: true } },
			attachments: [],
		})
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("running")
		expect(warnSpy).toHaveBeenCalledWith(
			"[SuperMagicStore] unknown tool response status",
			expect.objectContaining({
				topicId: TOPIC_ID,
				toolId: "tool-1",
				incomingStatus: "teleporting",
				fallbackStatus: "running",
			}),
		)
		warnSpy.mockRestore()
	})

	it("未知 tool status 补齐载荷时，不回滚已有 finished 状态。", () => {
		const store = createStore()
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const updatedAttachments = [{ file_id: "late-file" }]

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope({ status: "running" }))
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({ appMessageId: "finished-response", seqId: "101" }),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "unknown-response",
				seqId: "102",
				status: "teleporting",
				detail: { type: "text", data: "late detail" },
				attachments: updatedAttachments,
			}),
		)
		settleRendering()

		expect(getCanonicalToolState(store, "tool-1")).toMatchObject({
			id: "tool-1",
			status: "finished",
			detail: { type: "text", data: "late detail" },
			attachments: updatedAttachments,
		})
		expect(warnSpy).toHaveBeenCalledWith(
			"[SuperMagicStore] unknown tool response status",
			expect.objectContaining({
				toolId: "tool-1",
				incomingStatus: "teleporting",
				fallbackStatus: "finished",
			}),
		)
		warnSpy.mockRestore()
	})

	it("assistant 内嵌 tool 状态为 `running`，后到 canonical response 为 `finished`。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				status: "running",
				toolCalls: [createToolCall({ status: "running" })],
			}),
		)
		store.enqueueMessage(TOPIC_ID, createToolEnvelope({ status: "finished" }))
		settleRendering()

		expect(getEmbeddedToolState(store)?.status).toBe("running")
		expect(getCanonicalToolState(store, "tool-1")?.status).toBe("finished")
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("finished")
	})

	it("tool response 有 finished 状态，但 detail 缺失。", () => {
		const store = createStore()
		const toolWithoutDetail = { id: "tool-1", name: "read_file", status: "finished" }

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope())
		store.enqueueMessage(TOPIC_ID, createToolEnvelope({ tool: toolWithoutDetail }))
		settleRendering()

		expect(getCanonicalToolState(store, "tool-1")?.status).toBe("finished")
		expect(getCanonicalToolState(store, "tool-1")?.detail).toBeUndefined()
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("finished")
		expect(getToolNode(store, "tool-response-1")?.tool?.detail).toBeUndefined()
	})

	it("detail-only tool response 在没有历史状态时规范化为 running，并只记录一次 warning。", () => {
		const store = createStore()
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const toolWithoutStatus = {
			id: "tool-1",
			name: "read_file",
			detail: { type: "text", data: "result" },
		}

		try {
			// Keep the assistant non-terminal so the detail-only response is the first canonical payload.
			store.enqueueMessage(TOPIC_ID, createAssistantEnvelope({ status: "running" }))
			const detailOnlyEnvelope = createToolEnvelope({
				appMessageId: "detail-only-response",
				tool: toolWithoutStatus,
			})
			const replayEnvelope = cloneEnvelope(detailOnlyEnvelope)
			store.enqueueMessage(TOPIC_ID, detailOnlyEnvelope)
			store.enqueueMessage(TOPIC_ID, replayEnvelope)
			settleRendering()

			expect.soft(getToolNode(store, "detail-only-response")?.tool?.status).toBeUndefined()
			expect.soft(getCanonicalToolState(store, "tool-1")).toMatchObject({
				id: "tool-1",
				status: "running",
				detail: { type: "text", data: "result" },
			})
			expect.soft(getEffectiveToolState(store, "tool-1")).toMatchObject({
				status: "running",
				detail: { type: "text", data: "result" },
			})

			// enqueueMessage and buffer consumption both visit recordToolResponse; one malformed
			// revision must still emit only one stable protocol warning.
			const missingStatusWarnings = warnSpy.mock.calls.filter(
				([, payload]) =>
					(payload as { code?: string } | undefined)?.code ===
					"tool-response-missing-status",
			)
			expect.soft(missingStatusWarnings).toHaveLength(1)
			if (missingStatusWarnings[0]) {
				expect.soft(missingStatusWarnings[0]).toEqual([
					"[SuperMagicStore] tool response missing status",
					expect.objectContaining({
						code: "tool-response-missing-status",
						topicId: TOPIC_ID,
						toolId: "tool-1",
						fallbackStatus: "running",
						resolution: "default-running",
					}),
				])
			}
		} finally {
			warnSpy.mockRestore()
		}
	})

	it.each(["waiting", "running", "finished", "error", "suspended"] as const)(
		"detail-only tool response 保留已有合法状态 %s、合并 detail，并只记录一次 warning。",
		(historyStatus) => {
			const store = createStore()
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
			const lateDetail = { type: "text", data: `late-${historyStatus}` }

			try {
				store.enqueueMessage(TOPIC_ID, createAssistantEnvelope({ status: "running" }))
				store.enqueueMessage(
					TOPIC_ID,
					createToolEnvelope({
						appMessageId: `tool-${historyStatus}`,
						seqId: "101",
						status: historyStatus,
						detail: { type: "text", data: "initial" },
					}),
				)
				const detailOnlyEnvelope = createToolEnvelope({
					appMessageId: `detail-only-${historyStatus}`,
					seqId: "102",
					tool: {
						id: "tool-1",
						name: "read_file",
						detail: lateDetail,
					},
				})
				const replayEnvelope = cloneEnvelope(detailOnlyEnvelope)
				store.enqueueMessage(TOPIC_ID, detailOnlyEnvelope)
				store.enqueueMessage(TOPIC_ID, replayEnvelope)
				settleRendering()

				expect
					.soft(getToolNode(store, `detail-only-${historyStatus}`)?.tool?.status)
					.toBeUndefined()
				expect.soft(getCanonicalToolState(store, "tool-1")).toMatchObject({
					status: historyStatus,
					detail: lateDetail,
				})
				expect.soft(getEffectiveToolState(store, "tool-1")).toMatchObject({
					status: historyStatus,
					detail: lateDetail,
				})

				const missingStatusWarnings = warnSpy.mock.calls.filter(
					([, payload]) =>
						(payload as { code?: string } | undefined)?.code ===
						"tool-response-missing-status",
				)
				expect.soft(missingStatusWarnings).toHaveLength(1)
				if (missingStatusWarnings[0]) {
					expect.soft(missingStatusWarnings[0]).toEqual([
						"[SuperMagicStore] tool response missing status",
						expect.objectContaining({
							code: "tool-response-missing-status",
							topicId: TOPIC_ID,
							toolId: "tool-1",
							fallbackStatus: historyStatus,
							resolution: "preserve-current-status",
						}),
					])
				}
			} finally {
				warnSpy.mockRestore()
			}
		},
	)

	it("detail-only tool response 保留真实屏障生成的 response_missing、合并 detail，并只记录一次 warning。", () => {
		const store = createStore()
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const lateDetail = { type: "text", data: "late-response-missing-detail" }

		try {
			store.enqueueMessage(
				TOPIC_ID,
				createAssistantEnvelope({
					appMessageId: "unanswered-assistant-for-detail-only",
					correlationId: "unanswered-correlation-for-detail-only",
					seqId: "100",
					status: "running",
					toolCalls: [
						createToolCall({
							id: "unanswered-tool-for-detail-only",
							status: "running",
						}),
					],
				}),
			)
			store.enqueueMessage(
				TOPIC_ID,
				createAssistantEnvelope({
					appMessageId: "following-assistant-for-detail-only",
					correlationId: "following-correlation-for-detail-only",
					seqId: "102",
					status: "running",
					toolCalls: [],
				}),
			)
			settleRendering()

			expect
				.soft(getCanonicalToolState(store, "unanswered-tool-for-detail-only")?.status)
				.toBe("response_missing")

			const detailOnlyEnvelope = createToolEnvelope({
				appMessageId: "detail-only-after-response-missing",
				correlationId: "unanswered-correlation-for-detail-only",
				seqId: "103",
				tool: {
					id: "unanswered-tool-for-detail-only",
					name: "read_file",
					detail: lateDetail,
				},
			})
			const replayEnvelope = cloneEnvelope(detailOnlyEnvelope)
			store.enqueueMessage(TOPIC_ID, detailOnlyEnvelope)
			store.enqueueMessage(TOPIC_ID, replayEnvelope)
			settleRendering()

			expect
				.soft(getToolNode(store, "detail-only-after-response-missing")?.tool?.status)
				.toBeUndefined()
			expect
				.soft(getCanonicalToolState(store, "unanswered-tool-for-detail-only"))
				.toMatchObject({
					status: "response_missing",
					detail: lateDetail,
				})
			expect
				.soft(
					getEffectiveToolState(
						store,
						"unanswered-tool-for-detail-only",
						"unanswered-correlation-for-detail-only",
					),
				)
				.toMatchObject({
					status: "response_missing",
					detail: lateDetail,
				})

			const missingStatusWarnings = warnSpy.mock.calls.filter(
				([, payload]) =>
					(payload as { code?: string } | undefined)?.code ===
					"tool-response-missing-status",
			)
			expect.soft(missingStatusWarnings).toHaveLength(1)
			if (missingStatusWarnings[0]) {
				expect.soft(missingStatusWarnings[0]).toEqual([
					"[SuperMagicStore] tool response missing status",
					expect.objectContaining({
						code: "tool-response-missing-status",
						topicId: TOPIC_ID,
						toolId: "unanswered-tool-for-detail-only",
						fallbackStatus: "response_missing",
						resolution: "preserve-current-status",
					}),
				])
			}
		} finally {
			warnSpy.mockRestore()
		}
	})

	it("tool response 的 attachments 延迟到达。", () => {
		const store = createStore()
		const attachments = [{ file_id: "file-1", file_name: "report.pdf" }]

		store.enqueueMessage(TOPIC_ID, createAssistantEnvelope())
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-without-attachments",
				attachments: [],
				seqId: "101",
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-with-attachments",
				attachments,
				seqId: "102",
			}),
		)
		settleRendering()

		expect(getCanonicalToolState(store, "tool-1")?.attachments).toEqual(attachments)
		expect(getEffectiveToolState(store, "tool-1")?.attachments).toEqual(attachments)
	})

	it("tool response 的 attachments 与 assistant 内嵌 tool 不一致。", () => {
		const store = createStore()
		const authoritativeAttachments = [{ file_id: "final-file" }]

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				toolCalls: [
					{
						...createToolCall(),
						tool: {
							id: "tool-1",
							status: "running",
							attachments: [{ file_id: "draft" }],
						},
					},
				],
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({ attachments: authoritativeAttachments }),
		)
		settleRendering()

		expect(getEmbeddedToolState(store)?.attachments).toEqual([{ file_id: "draft" }])
		expect(getCanonicalToolState(store, "tool-1")?.attachments).toEqual(
			authoritativeAttachments,
		)
		expect(getEffectiveToolState(store, "tool-1")?.attachments).toEqual(
			authoritativeAttachments,
		)
	})

	it("工具执行完成，但 buffer 被前一个 assistant 动画阻塞。", () => {
		const store = createStore()
		const arrivals = collectArrivals(store)
		const longArguments = `{"value":"${"x".repeat(30_000)}"}`
		const timerOwnerCorrelationId = `${CORRELATION_ID}-timer-owner`

		// A long Final-only payload no longer creates a StreamState. Use two real streams:
		// the first owns the topic timer, while the second leaves its Final at the queue head.
		store.receiveChunk(
			createToolHeaderChunk({
				correlationId: timerOwnerCorrelationId,
				toolCall: createToolCall({
					id: "timer-owner-tool",
					arguments: longArguments,
				}),
			}),
		)
		store.receiveChunk(
			createToolHeaderChunk({
				correlationId: CORRELATION_ID,
				toolCall: createToolCall({ arguments: longArguments }),
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "slow-assistant",
				toolCalls: [createToolCall({ arguments: longArguments })],
			}),
		)
		store.enqueueMessage(TOPIC_ID, createToolEnvelope({ appMessageId: "fast-tool-response" }))
		settleRendering(32)

		expect(getCanonicalToolState(store, "tool-1")?.status).toBe("finished")
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("finished")
		expect(getToolNode(store, "fast-tool-response")?.tool?.status).toBe("finished")
		expect(
			arrivals.events.filter(
				(event) => event.payload.message.appMessageId === "fast-tool-response",
			),
		).toHaveLength(1)

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "timer-owner-final",
				correlationId: timerOwnerCorrelationId,
				seqId: "99",
				content: "",
				toolCalls: [
					createToolCall({
						id: "timer-owner-tool",
						arguments: longArguments,
					}),
				],
			}),
		)
		advanceUntil(
			() => getToolNode(store, "fast-tool-response")?.tool?.status === "finished",
			"queued tool response reaches the raw message layer",
		)

		expect(getToolNode(store, "fast-tool-response")?.tool?.status).toBe("finished")
		expect(
			arrivals.events.filter(
				(event) => event.payload.message.appMessageId === "fast-tool-response",
			),
		).toHaveLength(1)
		arrivals.unsubscribe()
	})

	it("任务结束时仍有未结算工具。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				status: "finished",
				toolCalls: [createToolCall({ status: "running" })],
			}),
		)
		settleRendering()

		expect(store.isTopicStreaming(TOPIC_ID)).toBe(false)
		expect(getEmbeddedToolState(store)?.status).toBe("running")
		expect(getCanonicalToolState(store, "tool-1")).toMatchObject({
			id: "tool-1",
			status: "response_missing",
		})
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("response_missing")
	})

	it("task-level agent_suspended 事件将普通未完成工具结算为 suspended。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({ status: "running", toolCalls: [createToolCall()] }),
		)
		settleRendering()
		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "task-suspended-event",
				correlationId: "task-suspended-correlation",
				seqId: "102",
				content: "",
				status: "suspended",
				event: "agent_suspended",
				toolCalls: [],
			}),
		)
		settleRendering()

		expect(getCanonicalToolState(store, "tool-1")).toMatchObject({
			id: "tool-1",
			status: "suspended",
		})
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("suspended")
	})

	it("权威 topic 状态为 suspended 时，将普通未完成工具结算为 suspended。", () => {
		const store = createStore()
		const generation = store.beginTopicSync(TOPIC_ID)

		store.initializeMessages(TOPIC_ID, [
			createAssistantEnvelope({ status: "running", toolCalls: [createToolCall()] }),
		])

		expect(
			store.completeTopicSync(TOPIC_ID, generation, {
				succeeded: true,
				taskStatus: "suspended",
				latestSeqId: "100",
			}),
		).toBe(true)
		expect(getCanonicalToolState(store, "tool-1")).toMatchObject({
			id: "tool-1",
			status: "suspended",
		})
	})

	it("单个 tool message 的 suspended 状态不得中断同 topic 的其他工具。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				status: "running",
				toolCalls: [createToolCall(), createToolCall({ id: "other-tool", index: 1 })],
			}),
		)
		settleRendering()
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "individual-suspended-tool",
				toolId: "other-tool",
				status: "suspended",
				nodeStatus: "suspended",
			}),
		)
		settleRendering()

		expect(getCanonicalToolState(store, "tool-1")).toBeUndefined()
		expect(getEffectiveToolState(store, "tool-1")?.status).toBe("running")
		expect(getCanonicalToolState(store, "other-tool")?.status).toBe("suspended")
	})

	it.each(["finished", "error"])("迟到的真实 %s response 可以覆盖合成的 suspended", (status) => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({ status: "running", toolCalls: [createToolCall()] }),
		)
		settleRendering()
		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "task-suspended-event",
				correlationId: "task-suspended-correlation",
				seqId: "102",
				content: "",
				status: "suspended",
				event: "agent_suspended",
				toolCalls: [],
			}),
		)
		settleRendering()
		expect(getCanonicalToolState(store, "tool-1")?.status).toBe("suspended")

		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({ appMessageId: `late-${status}`, seqId: "103", status }),
		)
		settleRendering()

		expect(getCanonicalToolState(store, "tool-1")?.status).toBe(status)
	})

	it("ask_user 没有普通 tool response 时保持等待态，不伪造普通工具终态。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				status: "suspended",
				event: "agent_suspended",
				toolCalls: [createToolCall({ id: "ask-1", name: "ask_user", status: "running" })],
			}),
		)
		settleRendering()

		expect(getAssistantTool(store, "ask-1")).toBeDefined()
		expect(getEmbeddedToolState(store, "ask-1")?.status).toBe("running")
		expect(getCanonicalToolState(store, "ask-1")).toBeUndefined()
		expect(getEffectiveToolState(store, "ask-1")?.status).toBe("running")
		expect(store.isTopicStreaming(TOPIC_ID)).toBe(false)
	})

	it("ask_user 响应晚于新一轮 assistant。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "ask-assistant",
				correlationId: "ask-correlation",
				toolCalls: [createToolCall({ id: "ask-1", name: "ask_user" })],
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "next-assistant",
				correlationId: "next-correlation",
				seqId: "102",
				content: "continued",
				toolCalls: [],
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "late-ask-response",
				correlationId: "ask-correlation",
				toolId: "ask-1",
				name: "ask_user",
				seqId: "103",
			}),
		)
		settleRendering()

		expect(getAssistantNode(store, "next-correlation")?.content).toBe("continued")
		expect(getToolNode(store, "late-ask-response")?.tool?.id).toBe("ask-1")
		expect(getCanonicalToolState(store, "ask-1")).toMatchObject({
			id: "ask-1",
			status: "finished",
		})
		expect(getEffectiveToolState(store, "ask-1", "ask-correlation")?.status).toBe("finished")
	})

	it("MCP 工具真实名称位于 `tool.name`，但 function.name 是方法名。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				toolCalls: [createToolCall({ name: "call_tool", toolName: "mcp_tool_call" })],
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({ name: "mcp.browser.search", status: "finished" }),
		)
		settleRendering()

		expect(getAssistantTool(store)?.function?.name).toBe("call_tool")
		expect(getEmbeddedToolState(store)?.name).toBe("mcp_tool_call")
		expect(getCanonicalToolState(store, "tool-1")?.name).toBe("mcp.browser.search")
		expect(getEffectiveToolState(store, "tool-1")?.name).toBe("mcp.browser.search")
	})

	it("show_in_ui=false 不影响未结算工具的 canonical 结算。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				status: "finished",
				toolCalls: [
					createToolCall({ id: "hidden-tool", status: "running", showInUi: false }),
				],
			}),
		)
		settleRendering()

		expect(store.isTopicStreaming(TOPIC_ID)).toBe(false)
		expect(getEmbeddedToolState(store, "hidden-tool")?.show_in_ui).toBe(false)
		expect(getEmbeddedToolState(store, "hidden-tool")?.status).toBe("running")
		expect(getCanonicalToolState(store, "hidden-tool")).toMatchObject({
			id: "hidden-tool",
			status: "response_missing",
		})
		expect(getEffectiveToolState(store, "hidden-tool")?.status).toBe("response_missing")
	})

	it("多工具 response 按 tool.id 绑定，不受数组 index 和 tool_call_id 干扰。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				status: "running",
				toolCalls: [
					createToolCall({ id: "tool-a", index: 0, status: "running" }),
					createToolCall({ id: "tool-b", index: 1, status: "running" }),
				],
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				toolId: "tool-b",
				legacyToolCallId: "tool-a",
				includeLegacyToolCallId: true,
				name: "second-tool",
			}),
		)
		settleRendering()

		expect(getCanonicalToolState(store, "tool-b")?.status).toBe("finished")
		expect(getCanonicalToolState(store, "tool-a")).toBeUndefined()
		expect(getEffectiveToolState(store, "tool-b")?.status).toBe("finished")
		expect(getEffectiveToolState(store, "tool-a")?.status).toBe("running")
	})

	it("buffer 中错误的 tool_call_id 不得掩盖按 tool.id 判断的缺失响应。", () => {
		const store = createStore()
		const longArguments = `{"value":"${"x".repeat(30_000)}"}`

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "buffered-assistant",
				correlationId: "buffered-correlation",
				status: "running",
				toolCalls: [
					createToolCall({
						id: "expected-tool",
						arguments: longArguments,
						status: "running",
					}),
				],
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "orphan-buffered-response",
				correlationId: "buffered-correlation",
				toolId: "orphan-tool",
				legacyToolCallId: "expected-tool",
				includeLegacyToolCallId: true,
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "following-buffered-assistant",
				correlationId: "following-buffered-correlation",
				seqId: "102",
				content: "continued",
				toolCalls: [],
			}),
		)

		expect(getCanonicalToolState(store, "orphan-tool")).toBeUndefined()
		expect(getCanonicalToolState(store, "expected-tool")).toMatchObject({
			id: "expected-tool",
			status: "response_missing",
		})
	})

	it("页面刷新载入 HTTP 历史快照时，缺少 role=tool 的工具调用立即进入 response_missing。", () => {
		const store = createStore()
		const generation = store.beginTopicSync(TOPIC_ID)
		const assistant = createAssistantEnvelope({
			appMessageId: "refresh-assistant",
			correlationId: "refresh-correlation",
			seqId: "100",
			content: "refresh answer",
			status: "finished",
			toolCalls: [
				createToolCall({
					id: "lost-refresh-tool",
					arguments: '{"path":"README.md"}',
					status: "running",
				}),
			],
		})

		store.initializeMessages(TOPIC_ID, [assistant])

		expect(getAssistantNode(store, "refresh-correlation")).toBeDefined()
		expect(getAssistantTool(store, "lost-refresh-tool", "refresh-correlation")).toBeDefined()
		expect(getCanonicalToolState(store, "lost-refresh-tool")).toMatchObject({
			id: "lost-refresh-tool",
			status: "response_missing",
		})
		expect(
			getEffectiveToolState(store, "lost-refresh-tool", "refresh-correlation")?.status,
		).toBe("response_missing")

		expect(
			store.completeTopicSync(TOPIC_ID, generation, {
				succeeded: true,
				taskStatus: "finished",
				latestSeqId: "100",
			}),
		).toBe(true)

		expect(store.isTopicStreaming(TOPIC_ID)).toBe(false)
		expect(getAssistantCardCount(store)).toBe(1)
		expect(getAssistantNode(store, "refresh-correlation")?.content).toBe("refresh answer")
		expect(
			getEmbeddedToolState(store, "lost-refresh-tool", "refresh-correlation")?.status,
		).toBe("running")
		expect(getCanonicalToolState(store, "lost-refresh-tool")).toMatchObject({
			id: "lost-refresh-tool",
			status: "response_missing",
		})
		expect(
			getEffectiveToolState(store, "lost-refresh-tool", "refresh-correlation")?.status,
		).toBe("response_missing")
	})

	it("历史 generation_progress 即使 correlation_id 采用工具上下文值也应保留详情", () => {
		const store = createStore()
		store.initializeMessages(TOPIC_ID, [
			createAssistantEnvelope({
				correlationId: "outer-correlation",
				toolCalls: [
					createToolCall({ id: "generation-tool", name: "generate_canvas_images" }),
				],
			}),
			createToolEnvelope({
				appMessageId: "generation-pending",
				toolId: "generation-tool",
				correlationId: "tool-context-correlation",
				status: "running",
				nodeStatus: "running",
				detail: {
					type: "generation_progress",
					data: {
						task_id: "IGT-history",
						started_at: "2026-01-01T00:00:00Z",
						expected_finished_at: "2026-01-01T00:01:30Z",
					},
				},
			}),
		])

		expect(getCanonicalToolState(store, "generation-tool")).toMatchObject({
			status: "running",
			detail: { type: "generation_progress" },
		})
	})

	it("legacy general_agent_card 的 progress tool 也能在刷新后恢复", () => {
		const store = createStore()
		const pending = createToolEnvelope({
			appMessageId: "legacy-generation-pending",
			toolId: "legacy-generation-tool",
			correlationId: CORRELATION_ID,
			status: "running",
			nodeStatus: "running",
			detail: {
				type: "generation_progress",
				data: {
					task_id: "IGT-legacy-history",
					started_at: "2026-01-01T00:00:00Z",
					expected_finished_at: "2026-01-01T00:01:30Z",
				},
			},
		})
		const message = pending.seq.message as Record<string, unknown>
		const node = message.super_magic_message as Record<string, unknown>
		node.role = "assistant"
		message.type = "general_agent_card"
		message.general_agent_card = node
		delete message.super_magic_message

		store.initializeMessages(TOPIC_ID, [
			createAssistantEnvelope({
				toolCalls: [createToolCall({ id: "legacy-generation-tool" })],
			}),
			pending,
		])

		expect(getCanonicalToolState(store, "legacy-generation-tool")).toMatchObject({
			status: "running",
			detail: { type: "generation_progress" },
		})
	})

	it("Topic error 终态也会结束没有 role=tool 响应的工具 loading。", () => {
		const store = createStore()
		const correlationId = "vm-init-correlation"
		const superMessageId = toAssistantSuperMessageId(correlationId)
		const toolCall = createToolCall({
			id: "vm-init-tool",
			name: "initialize_virtual_machine",
			arguments: '{"image":"default"}',
			status: "running",
		})

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "vm-init-assistant",
				correlationId,
				status: "running",
				toolCalls: [toolCall],
			}),
		)
		settleRendering()

		const generation = store.beginTopicSync(TOPIC_ID)
		expect(getCanonicalToolState(store, "vm-init-tool")).toBeUndefined()
		expect(
			store.completeTopicSync(TOPIC_ID, generation, {
				succeeded: true,
				taskStatus: "error",
			}),
		).toBe(true)

		expect(getCanonicalToolState(store, "vm-init-tool")).toMatchObject({
			id: "vm-init-tool",
			status: "response_missing",
		})
		expect(
			store.getToolResponseForRendering(TOPIC_ID, superMessageId, toolCall) as ToolState,
		).toMatchObject({ status: "response_missing" })
	})

	it("页面常驻增量轮询没有新消息但任务已结束时，缺少 role=tool 的工具调用进入 response_missing。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "incremental-assistant",
				correlationId: "incremental-correlation",
				seqId: "100",
				status: "running",
				toolCalls: [createToolCall({ id: "lost-incremental-tool", status: "running" })],
			}),
		)
		settleRendering()

		expect(getCanonicalToolState(store, "lost-incremental-tool")).toBeUndefined()
		expect(
			getEffectiveToolState(store, "lost-incremental-tool", "incremental-correlation")
				?.status,
		).toBe("running")

		const generation = store.beginTopicSync(TOPIC_ID)
		// An empty incremental HTTP page adds no messages and must not reinitialize
		// existing cards; the authoritative task status is the only completion barrier.
		expect(
			store.completeTopicSync(TOPIC_ID, generation, {
				succeeded: true,
				taskStatus: "finished",
				latestSeqId: "100",
			}),
		).toBe(true)

		expect(getAssistantCardCount(store)).toBe(1)
		expect(
			getEmbeddedToolState(store, "lost-incremental-tool", "incremental-correlation")?.status,
		).toBe("running")
		expect(getCanonicalToolState(store, "lost-incremental-tool")).toMatchObject({
			id: "lost-incremental-tool",
			status: "response_missing",
		})
		expect(
			getEffectiveToolState(store, "lost-incremental-tool", "incremental-correlation")
				?.status,
		).toBe("response_missing")
	})

	it("下一轮 running assistant 到达后，上一轮缺少 role=tool 的工具调用退出 loading。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "unanswered-assistant",
				correlationId: "unanswered-correlation",
				seqId: "100",
				status: "running",
				toolCalls: [
					createToolCall({
						id: "unanswered-tool",
						arguments: '{"path":"README.md"}',
						status: "running",
					}),
				],
			}),
		)
		settleRendering()

		expect(getAssistantTool(store, "unanswered-tool", "unanswered-correlation")).toBeDefined()
		expect(
			getEffectiveToolState(store, "unanswered-tool", "unanswered-correlation")?.status,
		).toBe("running")
		expect(
			getEffectiveToolState(store, "unanswered-tool", "unanswered-correlation")?.status,
		).not.toBe("response_missing")

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "following-assistant",
				correlationId: "following-correlation",
				seqId: "102",
				content: "next answer",
				status: "running",
				toolCalls: [],
			}),
		)
		settleRendering()

		expect(getAssistantNode(store, "following-correlation")?.content).toBe("next answer")
		expect(getAssistantNode(store, "following-correlation")?.status).toBe("running")
		expect(getAssistantCardCount(store)).toBe(2)
		expect(
			getEmbeddedToolState(store, "unanswered-tool", "unanswered-correlation")?.status,
		).toBe("running")
		expect(getCanonicalToolState(store, "unanswered-tool")).toMatchObject({
			id: "unanswered-tool",
			status: "response_missing",
		})
		expect(
			getEffectiveToolState(store, "unanswered-tool", "unanswered-correlation")?.status,
		).toBe("response_missing")
	})

	it("下一逻辑 Assistant 的首个有效 Chunk 只触发一次上一条工具恢复屏障。", () => {
		const store = createStore()
		const recoveryRequests: Array<{
			topicId: string
			correlationId: string
			reason?: string
			anchorAppMessageId?: string
		}> = []
		store.registerOnStreamRecoveryRequested((payload) => recoveryRequests.push(payload))

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "previous-assistant",
				correlationId: "previous-correlation",
				seqId: "100",
				status: "running",
				toolCalls: [createToolCall({ id: "previous-tool", status: "running" })],
			}),
		)
		settleRendering()

		store.receiveChunk(
			createAssistantContentChunk({ correlationId: "following-correlation", i: 0 }),
		)
		for (let i = 1; i <= 500; i += 1) {
			store.receiveChunk(
				createAssistantContentChunk({
					correlationId: "following-correlation",
					i,
					content: "x",
				}),
			)
		}

		expect(getCanonicalToolState(store, "previous-tool")).toMatchObject({
			id: "previous-tool",
			status: "response_missing",
		})
		expect(
			store.getToolResponseRecoveryState(
				TOPIC_ID,
				toAssistantSuperMessageId("previous-correlation"),
				"previous-tool",
			),
		).toMatchObject({
			phase: "execution_settled_pending_response",
			ownerAppMessageId: "previous-assistant",
			anchorSeqId: "100",
		})
		expect(recoveryRequests).toEqual([
			expect.objectContaining({
				topicId: TOPIC_ID,
				correlationId: "previous-correlation",
				reason: "tool_response",
				anchorAppMessageId: "previous-assistant",
			}),
		])
	})

	it("canonical Tool Response 已入账时仍受所属 Assistant FinalRenderState 展示门控。", () => {
		const store = createStore()
		const correlationId = "render-gated-correlation"
		const superMessageId = toAssistantSuperMessageId(correlationId)
		const toolCall = createToolCall({ id: "render-gated-tool", status: "running" })

		store.receiveChunk(
			createAssistantContentChunk({
				correlationId,
				content: "visible prefix",
			}),
		)
		vi.advanceTimersByTime(RENDER_FRAME_MS)
		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "render-gated-final",
				correlationId,
				seqId: "100",
				content: `visible prefix ${"canonical tail ".repeat(80)}`,
				status: "running",
				toolCalls: [toolCall],
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "render-gated-tool-response",
				correlationId,
				seqId: "101",
				toolId: "render-gated-tool",
				status: "finished",
			}),
		)

		expect(getCanonicalToolState(store, "render-gated-tool")?.status).toBe("finished")
		expect(store.getToolResponseForRendering(TOPIC_ID, superMessageId, toolCall)?.status).toBe(
			"running",
		)

		advanceUntil(
			() =>
				store.getToolResponseForRendering(TOPIC_ID, superMessageId, toolCall)?.status ===
				"finished",
			"FinalRenderState opens the canonical Tool Response gate",
		)
		expect(store.getToolResponseForRendering(TOPIC_ID, superMessageId, toolCall)).toMatchObject(
			{
				id: "render-gated-tool",
				status: "finished",
				detail: { type: "json", data: { ok: true } },
			},
		)
	})

	it("Final 仅补齐 ToolCall arguments 时仍保持 Tool Response 展示门控。", () => {
		const store = createStore()
		const correlationId = "tool-only-render-gated-correlation"
		const superMessageId = toAssistantSuperMessageId(correlationId)
		const toolId = "tool-only-render-gated-tool"
		const streamedToolCall = createToolCall({
			id: toolId,
			arguments: '{"value":"prefix',
			status: "running",
		})
		const finalToolCall = createToolCall({
			id: toolId,
			arguments: `{"value":"${"canonical-tail-".repeat(300)}"}`,
			status: "running",
		})

		store.receiveChunk(createToolHeaderChunk({ correlationId, toolCall: streamedToolCall }))
		vi.advanceTimersByTime(RENDER_FRAME_MS)
		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "tool-only-render-gated-final",
				correlationId,
				seqId: "100",
				content: "",
				status: "running",
				toolCalls: [finalToolCall],
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "tool-only-render-gated-response",
				correlationId,
				seqId: "101",
				toolId,
				status: "finished",
			}),
		)

		expect(getCanonicalToolState(store, toolId)?.status).toBe("finished")
		expect(
			store.getToolResponseForRendering(TOPIC_ID, superMessageId, streamedToolCall)?.status,
		).toBe("running")

		advanceUntil(
			() =>
				store.getToolResponseForRendering(TOPIC_ID, superMessageId, finalToolCall)
					?.status === "finished",
			"ToolCall-only FinalRenderState opens the canonical Tool Response gate",
		)
	})

	it("权威 membership 删除 Assistant 时同步清理其 Tool recovery sidecar。", () => {
		const store = createStore()
		const correlationId = "removed-recovery-correlation"
		const superMessageId = toAssistantSuperMessageId(correlationId)
		const toolId = "removed-recovery-tool"

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "removed-recovery-assistant",
				correlationId,
				seqId: "100",
				status: "running",
				toolCalls: [createToolCall({ id: toolId, status: "running" })],
			}),
		)
		settleRendering()
		expect(store.getToolResponseRecoveryState(TOPIC_ID, superMessageId, toolId)).toBeDefined()

		store.initializeMessages(TOPIC_ID, [], { mode: "replace" })

		expect(store.getToolResponseRecoveryState(TOPIC_ID, superMessageId, toolId)).toBeUndefined()
		expect(store.getToolResponseRecoveryRequest(TOPIC_ID)).toBeUndefined()
	})

	it("live HTTP 投影策略下，任务仍在运行且没有后续消息时不提前生成 response_missing。", () => {
		const store = createStore()
		const generation = store.beginTopicSync(TOPIC_ID)

		store.initializeMessages(
			TOPIC_ID,
			[
				createAssistantEnvelope({
					appMessageId: "running-assistant",
					correlationId: "running-correlation",
					seqId: "100",
					status: "running",
					toolCalls: [createToolCall({ id: "still-running-tool", status: "running" })],
				}),
			],
			{
				assistantSnapshotPolicy: "progress_snapshot",
				toolProjectionPolicy: "preserve_live",
			},
		)
		expect(
			store.completeTopicSync(TOPIC_ID, generation, {
				succeeded: true,
				taskStatus: "running",
				latestSeqId: "100",
			}),
		).toBe(true)
		settleRendering()

		expect(getCanonicalToolState(store, "still-running-tool")).toBeUndefined()
		expect(
			getEffectiveToolState(store, "still-running-tool", "running-correlation")?.status,
		).toBe("running")
		expect(
			getEffectiveToolState(store, "still-running-tool", "running-correlation")?.status,
		).not.toBe("response_missing")
	})

	it("HTTP preserve_live 同批倒序包含 Tool 与 Assistant 时，真实 Tool Response 先入 canonical。", () => {
		const store = createStore()
		const assistant = createAssistantEnvelope({
			appMessageId: "preserve-live-assistant",
			correlationId: "preserve-live-correlation",
			seqId: "100",
			status: "running",
			toolCalls: [createToolCall({ id: "preserve-live-tool", status: "running" })],
		})
		const tool = createToolEnvelope({
			appMessageId: "preserve-live-tool-response",
			correlationId: "preserve-live-correlation",
			seqId: "101",
			toolId: "preserve-live-tool",
			status: "finished",
		})

		store.initializeMessages(TOPIC_ID, [tool, assistant], {
			mode: "merge",
			toolProjectionPolicy: "preserve_live",
		})

		expect(getCanonicalToolState(store, "preserve-live-tool")).toMatchObject({
			id: "preserve-live-tool",
			status: "finished",
			detail: { type: "json", data: { ok: true } },
		})
		expect(getAssistantNode(store, "preserve-live-correlation")?.tool_calls).toHaveLength(1)
	})

	it("response_missing 弱终态生成后，迟到的真实 tool message 可以覆盖。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "unanswered-assistant",
				correlationId: "unanswered-correlation",
				seqId: "100",
				status: "running",
				toolCalls: [
					createToolCall({
						id: "unanswered-tool",
						arguments: '{"path":"README.md"}',
						status: "running",
					}),
				],
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "following-assistant",
				correlationId: "following-correlation",
				seqId: "102",
				content: "next answer",
				toolCalls: [],
			}),
		)
		settleRendering()

		expect(getAssistantNode(store, "following-correlation")?.content).toBe("next answer")
		expect(getAssistantCardCount(store)).toBe(2)
		expect(
			getEmbeddedToolState(store, "unanswered-tool", "unanswered-correlation")?.status,
		).toBe("running")
		expect(getCanonicalToolState(store, "unanswered-tool")).toMatchObject({
			id: "unanswered-tool",
			status: "response_missing",
		})
		expect(
			getEffectiveToolState(store, "unanswered-tool", "unanswered-correlation")?.status,
		).toBe("response_missing")

		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "late-tool-response",
				correlationId: "unanswered-correlation",
				seqId: "103",
				toolId: "unanswered-tool",
				status: "finished",
				detail: { type: "json", data: { source: "late-real-response" } },
			}),
		)
		settleRendering()

		expect(
			getEffectiveToolState(store, "unanswered-tool", "unanswered-correlation")?.status,
		).toBe("finished")
		expect(
			getEffectiveToolState(store, "unanswered-tool", "unanswered-correlation")?.status,
		).not.toBe("response_missing")
		expect(
			getEffectiveToolState(store, "unanswered-tool", "unanswered-correlation")?.detail,
		).toEqual({ type: "json", data: { source: "late-real-response" } })

		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "stale-tool-response",
				correlationId: "unanswered-correlation",
				seqId: "101",
				toolId: "unanswered-tool",
				status: "finished",
				detail: { type: "json", data: { source: "stale-response" } },
			}),
		)
		settleRendering()

		expect(
			getEffectiveToolState(store, "unanswered-tool", "unanswered-correlation")?.detail,
		).toEqual({ type: "json", data: { source: "late-real-response" } })
		expect(getAssistantCardCount(store)).toBe(2)
	})

	it("多个工具调用中只有缺失响应的工具进入 response_missing。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "multi-tool-assistant",
				correlationId: "multi-tool-correlation",
				seqId: "100",
				status: "running",
				toolCalls: [
					createToolCall({ id: "completed-tool", index: 0, status: "running" }),
					createToolCall({ id: "missing-tool", index: 1, status: "running" }),
				],
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "completed-tool-response",
				correlationId: "multi-tool-correlation",
				seqId: "101",
				toolId: "completed-tool",
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "multi-tool-following-assistant",
				correlationId: "multi-tool-following-correlation",
				seqId: "102",
				content: "continued after one tool",
				toolCalls: [],
			}),
		)
		settleRendering()

		expect(getAssistantNode(store, "multi-tool-following-correlation")?.content).toBe(
			"continued after one tool",
		)
		expect(getAssistantCardCount(store)).toBe(2)
		expect(getCanonicalToolState(store, "completed-tool")?.status).toBe("finished")
		expect(
			getEffectiveToolState(store, "completed-tool", "multi-tool-correlation")?.status,
		).toBe("finished")
		expect(getCanonicalToolState(store, "missing-tool")).toMatchObject({
			id: "missing-tool",
			status: "response_missing",
		})
		expect(getEffectiveToolState(store, "missing-tool", "multi-tool-correlation")?.status).toBe(
			"response_missing",
		)
	})

	it("finished 多工具轮次已有部分 response 时，仍逐 tool.id 结算剩余缺失项。", () => {
		const store = createStore()

		store.enqueueMessage(
			TOPIC_ID,
			createAssistantEnvelope({
				appMessageId: "finished-multi-tool-assistant",
				correlationId: "finished-multi-tool-correlation",
				seqId: "100",
				status: "finished",
				toolCalls: [
					createToolCall({ id: "completed-tool", index: 0, status: "running" }),
					createToolCall({ id: "missing-tool", index: 1, status: "running" }),
				],
			}),
		)
		store.enqueueMessage(
			TOPIC_ID,
			createToolEnvelope({
				appMessageId: "completed-tool-response",
				correlationId: "finished-multi-tool-correlation",
				toolId: "completed-tool",
				seqId: "101",
			}),
		)
		settleRendering()

		expect(getCanonicalToolState(store, "completed-tool")?.status).toBe("finished")
		expect(getCanonicalToolState(store, "missing-tool")).toMatchObject({
			id: "missing-tool",
			status: "response_missing",
		})
	})
})
