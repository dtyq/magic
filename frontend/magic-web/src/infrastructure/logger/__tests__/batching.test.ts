import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { DeliveryQueue } from "../delivery/queue"
import { encodeBatch, FetchTransport } from "../delivery/transport"
import { normalLimits } from "../limits"
import { byteLength } from "../snapshot"
import type { LogRecord } from "../types"

const limit = 2 * 1024 * 1024
const record = (id: number): LogRecord => ({
	schemaVersion: 2,
	eventId: String(id),
	timestamp: 1,
	namespace: "batch-test",
	level: "report",
	logType: "report",
	traceId: "session",
	release: "test",
	data: "",
})
let queue: DeliveryQueue
let batches: { count: number; bytes: number; records: LogRecord[] }[]
let count: ReturnType<typeof vi.fn>

beforeEach(() => {
	vi.useFakeTimers()
	// Inspect JSON batches independently from gzip availability in the test runtime.
	vi.stubGlobal("CompressionStream", undefined)
	batches = []
	count = vi.fn()
	const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
		const body = init?.body as Uint8Array
		const records: LogRecord[] = JSON.parse(new TextDecoder().decode(body))
		batches.push({ count: records.length, bytes: body.byteLength, records })
		return new Response(JSON.stringify({ code: 1000, accepted: records.length }))
	})
	queue = new DeliveryQueue(new FetchTransport(fetcher), count)
})
afterEach(() => {
	queue.destroy()
	vi.useRealTimers()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

it("chunks 250 queued records into 100, 100, 50 with stable order", async () => {
	for (let i = 0; i < 250; i++) queue.add(record(i))
	await vi.advanceTimersByTimeAsync(10)
	expect(batches.map((batch) => batch.count)).toEqual([100, 100, 50])
	expect(batches.flatMap((batch) => batch.records.map((item) => item.eventId))).toEqual(
		Array.from({ length: 250 }, (_, i) => String(i)),
	)
})

it("sends a partial batch at five seconds and a full batch immediately", async () => {
	for (let i = 0; i < 99; i++) queue.add(record(i))
	await vi.advanceTimersByTimeAsync(4999)
	expect(batches).toHaveLength(0)
	queue.add(record(99))
	await vi.advanceTimersByTimeAsync(0)
	expect(batches.map((batch) => batch.count)).toEqual([100])
	queue.add(record(100))
	await vi.advanceTimersByTimeAsync(4999)
	expect(batches).toHaveLength(1)
	await vi.advanceTimersByTimeAsync(1)
	expect(batches.map((batch) => batch.count)).toEqual([100, 1])
})

it("splits on the JSON byte budget including separators before reaching 100 records", async () => {
	for (let i = 0; i < 2; i++) {
		const item = record(i)
		item.data = "x".repeat(limit / 2 - 1 - byteLength(JSON.stringify(item)))
		queue.add(item)
	}
	const flushed = queue.flush()
	await vi.advanceTimersByTimeAsync(10)
	expect(await flushed).toBe(true)
	expect(batches.map((batch) => batch.count)).toEqual([1, 1])
	expect(batches.every((batch) => batch.bytes <= limit)).toBe(true)
	expect(count.mock.calls.some(([reason]) => reason === "queue_capacity")).toBe(false)
})

it("allows exactly 2 MiB including array brackets and does not stall behind an oversized record", async () => {
	const tooLarge = record(0)
	tooLarge.data = "x".repeat(limit)
	queue.add(tooLarge)
	const exact = record(1)
	exact.data = "x".repeat(limit - 2 - byteLength(JSON.stringify(exact)))
	queue.add(exact)
	const flushed = queue.flush()
	await vi.advanceTimersByTimeAsync(10)
	expect(await flushed).toBe(true)
	expect(count).toHaveBeenCalledWith("record_capacity")
	expect(batches.map((batch) => batch.bytes)).toEqual([limit])
	expect(batches[0].records[0].eventId).toBe("1")
})

it("rejects oversized UTF-8 content before compression and oversized wire bodies before Fetch", async () => {
	expect(normalLimits.batchBytes).toBe(limit)
	const compress = vi.fn()
	vi.stubGlobal("CompressionStream", compress)
	await expect(encodeBatch(JSON.stringify("汉".repeat(Math.ceil(limit / 3))))).rejects.toThrow(
		"log_batch_capacity",
	)
	expect(compress).not.toHaveBeenCalled()
	const fetcher = vi.fn()
	expect(await new FetchTransport(fetcher).send({ body: new Uint8Array(limit + 1) }, 1)).toEqual({
		ok: false,
		reason: "batch_capacity",
		retryable: false,
	})
	expect(fetcher).not.toHaveBeenCalled()
})
