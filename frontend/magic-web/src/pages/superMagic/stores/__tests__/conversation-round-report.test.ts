import { afterEach, describe, expect, it, vi } from "vitest"
import { compareStreamRecordsForDisplay, db } from "@/pages/superMagic/stores/storage"
import {
	compressConversationRoundLogs,
	queryConversationRoundLogs,
	restoreConversationRoundLogs,
	type ConversationRoundReportItem,
	type StoredConversationRoundRecord,
} from "@/pages/superMagic/stores/conversation-round-report"

const TOPIC_ID = "topic-round-report"
const CORRELATION_ID = "correlation-round-report"

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T
}

function metadata(
	source: "super_magic_chunk" | "super_magic_message" | "conversation_message",
	writerId: string | undefined,
	writerSequence: number,
	receivedAt: number,
) {
	return {
		source,
		...(writerId ? { writer_id: writerId } : {}),
		writer_sequence: writerSequence,
		received_at: receivedAt,
		sent_at: Math.floor(receivedAt / 1000),
	}
}

function createUser({
	writerId,
	writerSequence,
	receivedAt,
}: {
	writerId?: string
	writerSequence: number
	receivedAt: number
}) {
	return {
		magic_id: "magic-user",
		seq_id: "100",
		message_id: "server-user",
		refer_message_id: "",
		sender_message_id: "",
		conversation_id: "conversation-1",
		organization_code: "organization-1",
		message: {
			magic_message_id: "magic-user-message",
			app_message_id: "user-1",
			sender_id: "user-1",
			send_time: 100,
			status: "read",
			unread_count: 0,
			topic_id: TOPIC_ID,
			type: "rich_text",
			rich_text: { content: "question" },
		},
		__websocket_record__: metadata(
			"conversation_message",
			writerId,
			writerSequence,
			receivedAt,
		),
	}
}

function createChunk({
	writerId,
	writerSequence,
	receivedAt,
	i,
	content = "",
	finishReason,
}: {
	writerId?: string
	writerSequence: number
	receivedAt: number
	i: number
	content?: string
	finishReason?: "stop" | "tool_calls" | "length"
}) {
	return {
		app_message_id: "stream-app-1",
		send_time: Math.floor(receivedAt / 1000),
		topic_id: TOPIC_ID,
		type: "super_magic_chunk",
		unread_count: 0,
		super_magic_chunk: {
			choices: [
				{
					delta: {
						...(content ? { content } : {}),
						role: "assistant",
					},
					...(finishReason ? { finish_reason: finishReason } : {}),
					index: 0,
				},
			],
			correlation_id: CORRELATION_ID,
			created: 100,
			i,
			id: "completion-1",
			model: "deepseek-v4-flash",
			object: "chat.completion.chunk",
		},
		__websocket_record__: metadata("super_magic_chunk", writerId, writerSequence, receivedAt),
	}
}

function createFinal({
	writerId,
	writerSequence,
	receivedAt,
	seqId,
	appMessageId,
	content,
}: {
	writerId?: string
	writerSequence: number
	receivedAt: number
	seqId: string
	appMessageId: string
	content: string
}) {
	return {
		magic_id: "magic-user",
		seq_id: seqId,
		message_id: `server-${seqId}`,
		refer_message_id: "",
		sender_message_id: "",
		conversation_id: "conversation-1",
		organization_code: "organization-1",
		message: {
			magic_message_id: `magic-${appMessageId}`,
			app_message_id: appMessageId,
			sender_id: "assistant-1",
			send_time: Math.floor(receivedAt / 1000),
			status: "read",
			unread_count: 0,
			topic_id: TOPIC_ID,
			type: "super_magic_message",
			super_magic_message: {
				message_id: appMessageId,
				super_message_id: "assistant-super-1",
				correlation_id: CORRELATION_ID,
				role: "assistant",
				status: "finished",
				content,
			},
		},
		__websocket_record__: metadata("super_magic_message", writerId, writerSequence, receivedAt),
	}
}

function stored(storageId: string, value: Record<string, unknown>): StoredConversationRoundRecord {
	return { storageId, value }
}

function roundMessages() {
	return [
		{
			app_message_id: "user-1",
			super_message_id: "user-1",
			role: "user",
			seq_id: "100",
			correlation_id: "",
			debug: { role: "user", content: "question" },
		},
		{
			app_message_id: "final-1",
			super_message_id: "assistant-super-1",
			role: "assistant",
			seq_id: "200",
			correlation_id: CORRELATION_ID,
			debug: { role: "assistant", correlation_id: CORRELATION_ID },
		},
		{
			app_message_id: "final-2",
			super_message_id: "assistant-super-1",
			role: "assistant",
			seq_id: "201",
			correlation_id: CORRELATION_ID,
			debug: { role: "assistant", correlation_id: CORRELATION_ID },
		},
	]
}

function reportKinds(items: ConversationRoundReportItem[]) {
	return items.map((item) => (item.type === "super_magic_chunk" ? "chunk" : item.message.type))
}

describe("conversation round WebSocket report codec", () => {
	afterEach(() => vi.restoreAllMocks())

	it("keeps User -> Chunk -> Final -> Chunk -> Final order while removing cross-tab copies", () => {
		const writerA = [
			createUser({ writerId: "tab-a", writerSequence: 1, receivedAt: 1_000 }),
			createChunk({
				writerId: "tab-a",
				writerSequence: 2,
				receivedAt: 1_010,
				i: 0,
				content: "A",
			}),
			createFinal({
				writerId: "tab-a",
				writerSequence: 3,
				receivedAt: 1_020,
				seqId: "200",
				appMessageId: "final-1",
				content: "A",
			}),
			createChunk({
				writerId: "tab-a",
				writerSequence: 4,
				receivedAt: 1_030,
				i: 1,
				content: "B",
			}),
			createFinal({
				writerId: "tab-a",
				writerSequence: 5,
				receivedAt: 1_040,
				seqId: "201",
				appMessageId: "final-2",
				content: "AB",
			}),
		]
		const writerB = writerA.map((value, index) => ({
			...clone(value),
			__websocket_record__: metadata(
				value.__websocket_record__.source,
				"tab-b",
				index + 1,
				value.__websocket_record__.received_at + 2,
			),
		}))
		const records = [...writerB, ...writerA].map((value, index) =>
			stored(`record-${index}`, value),
		)

		const report = compressConversationRoundLogs({
			records,
			roundMessages: roundMessages(),
			preferredWriterId: "tab-a",
		})

		expect(reportKinds(report)).toEqual([
			"rich_text",
			"chunk",
			"super_magic_message",
			"chunk",
			"super_magic_message",
		])
		expect(report.filter((item) => item.type === "super_magic_chunk")).toHaveLength(2)
		expect(report[1]).toEqual({
			app_message_id: "stream-app-1",
			send_time: 1,
			super_magic_chunks: [
				{
					choices: [{ delta: { content: "A", role: "assistant" }, index: 0 }],
					correlation_id: CORRELATION_ID,
					i: 0,
				},
			],
			topic_id: TOPIC_ID,
			type: "super_magic_chunk",
		})
		expect(report[0]).not.toHaveProperty("__websocket_record__")
	})

	it("retains the maximum same-writer Chunk occurrence count and marks real duplicates", () => {
		const records = [
			stored(
				"a-1",
				createChunk({
					writerId: "tab-a",
					writerSequence: 1,
					receivedAt: 1_000,
					i: 0,
					content: "A",
				}),
			),
			stored(
				"a-2",
				createChunk({
					writerId: "tab-a",
					writerSequence: 2,
					receivedAt: 1_001,
					i: 0,
					content: "A",
				}),
			),
			stored(
				"b-1",
				createChunk({
					writerId: "tab-b",
					writerSequence: 1,
					receivedAt: 1_002,
					i: 0,
					content: "A",
				}),
			),
			stored(
				"b-2",
				createChunk({
					writerId: "tab-b",
					writerSequence: 2,
					receivedAt: 1_003,
					i: 0,
					content: "A",
				}),
			),
		]

		const report = compressConversationRoundLogs({
			records,
			roundMessages: roundMessages(),
			preferredWriterId: "tab-a",
		})
		const group = report.find((item) => item.type === "super_magic_chunk")

		expect(group?.super_magic_chunks).toHaveLength(2)
		expect(group?.super_magic_chunks[0]).not.toHaveProperty("duplicate")
		expect(group?.super_magic_chunks[1]).toHaveProperty("duplicate", true)
	})

	it("preserves conflicting payload variants for the same Chunk index", () => {
		const records = [
			stored(
				"a",
				createChunk({
					writerId: "tab-a",
					writerSequence: 1,
					receivedAt: 1_000,
					i: 0,
					content: "A",
				}),
			),
			stored(
				"b",
				createChunk({
					writerId: "tab-b",
					writerSequence: 1,
					receivedAt: 1_001,
					i: 0,
					content: "B",
				}),
			),
		]

		const report = compressConversationRoundLogs({
			records,
			roundMessages: roundMessages(),
			preferredWriterId: "tab-a",
		})
		const group = report.find((item) => item.type === "super_magic_chunk")

		expect(group?.super_magic_chunks).toHaveLength(2)
		expect(group?.super_magic_chunks.every((chunk) => chunk.conflict)).toBe(true)
	})

	it("keeps legacy records and marks their deduplication as uncertain", () => {
		const value = createChunk({ writerSequence: 1, receivedAt: 1_000, i: 0, content: "A" })
		const records = [stored("legacy-a", value), stored("legacy-b", clone(value))]

		const report = compressConversationRoundLogs({
			records,
			roundMessages: roundMessages(),
			preferredWriterId: "tab-a",
		})
		const group = report.find((item) => item.type === "super_magic_chunk")

		expect(group?.super_magic_chunks).toHaveLength(2)
		expect(group?.super_magic_chunks.every((chunk) => chunk.dedupe_uncertain)).toBe(true)
	})

	it("restores compacted groups into individual persisted-flow messages", () => {
		const records = [
			stored("user", createUser({ writerId: "tab-a", writerSequence: 1, receivedAt: 1_000 })),
			stored(
				"chunk-a",
				createChunk({
					writerId: "tab-a",
					writerSequence: 2,
					receivedAt: 1_010,
					i: 0,
					content: "A",
				}),
			),
			stored(
				"final-a",
				createFinal({
					writerId: "tab-a",
					writerSequence: 3,
					receivedAt: 1_020,
					seqId: "200",
					appMessageId: "final-1",
					content: "A",
				}),
			),
			stored(
				"chunk-b",
				createChunk({
					writerId: "tab-a",
					writerSequence: 4,
					receivedAt: 1_030,
					i: 1,
					content: "B",
				}),
			),
		]
		const report = compressConversationRoundLogs({
			records,
			roundMessages: roundMessages(),
			preferredWriterId: "tab-a",
		})

		const restored = restoreConversationRoundLogs(report)

		expect(
			restored.map((value) =>
				value.type === "super_magic_chunk"
					? `chunk:${value.super_magic_chunk.i}`
					: value.message.type,
			),
		).toEqual(["rich_text", "chunk:0", "super_magic_message", "chunk:1"])
		expect(restored[1]).toMatchObject({
			app_message_id: "stream-app-1",
			topic_id: TOPIC_ID,
			type: "super_magic_chunk",
			super_magic_chunk: {
				correlation_id: CORRELATION_ID,
				i: 0,
				choices: [{ delta: { content: "A", role: "assistant" }, index: 0 }],
			},
		})
	})

	it("queries IndexedDB values with storage IDs in deterministic arrival order", async () => {
		const later = createChunk({
			writerId: "tab-a",
			writerSequence: 2,
			receivedAt: 2_000,
			i: 1,
			content: "B",
		})
		const earlier = createChunk({
			writerId: "tab-a",
			writerSequence: 1,
			receivedAt: 1_000,
			i: 0,
			content: "A",
		})
		vi.spyOn(db, "queryAllFromTable").mockResolvedValue([
			{ id: "later", value: later },
			{ id: "earlier", value: earlier },
		])

		const records = await queryConversationRoundLogs(TOPIC_ID)

		expect(records.map((record) => record.storageId)).toEqual(["earlier", "later"])
	})

	it("orders same-millisecond records by writer sequence before storage ID", () => {
		const records = [
			{
				id: "z-record",
				value: createChunk({
					writerId: "tab-a",
					writerSequence: 2,
					receivedAt: 1_000,
					i: 1,
					content: "B",
				}),
			},
			{
				id: "a-record",
				value: createChunk({
					writerId: "tab-a",
					writerSequence: 1,
					receivedAt: 1_000,
					i: 0,
					content: "A",
				}),
			},
		]

		expect(records.sort(compareStreamRecordsForDisplay).map((record) => record.id)).toEqual([
			"a-record",
			"z-record",
		])
	})
})
