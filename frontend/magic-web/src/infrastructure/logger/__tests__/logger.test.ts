import { fingerprint } from "../deduplicate"
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LoggerRuntime } from "../logger"
import { createRecord } from "../record"
import { safeSnapshot, byteLength } from "../snapshot"
import { DeliveryQueue } from "../delivery/queue"
import { FetchTransport } from "../delivery/transport"

beforeEach(() => {
	// These tests advance retry/dedup clocks; native stream work uses real I/O time.
	// Actual gzip bytes and async preparation are covered in compression.test.ts.
	vi.stubGlobal("CompressionStream", undefined)
})
afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})
const record = (data: unknown = ["hello"], level: "error" | "report" = "report") =>
	createRecord(level, { namespace: "test", data }, {}, "session", "release")
const receipt = (accepted = 1) => new Response(JSON.stringify({ code: 1000, accepted }))

describe("public boundary and records", () => {
	it("imports the public entry without browser globals or automatic startup", async () => {
		const timers = vi.spyOn(globalThis, "setInterval")
		const canonical = await import("../index")
		expect(timers).not.toHaveBeenCalled()
		expect(Object.keys(canonical.logger).sort()).toEqual([
			"createLogger",
			"error",
			"log",
			"report",
			"warn",
		])
		expect(canonical.logger.report({ namespace: "module", data: "report" })).toBeUndefined()
		expect(() =>
			canonical.createLogger("module").error({ eventKey: "failed", errorKind: "test" }),
		).not.toThrow()
	})
	it("preserves Error code/cause and non-Error original values", () => {
		const error = Object.assign(new TypeError("broken"), {
			code: "E_IO",
			cause: new Error("cause"),
		})
		const item = record([{ eventKey: "save_failed", errorKind: "io", error }], "error")
		expect(item.error).toMatchObject({
			message: "broken",
			code: "E_IO",
			cause: { message: "cause" },
		})
		expect(
			record([{ eventKey: "failed", errorKind: "io", error: { code: 403 } }], "error")
				.errorValue,
		).toEqual({ code: 403 })
	})
	it("contains cycles, BigInt and accessors without executing getters", () => {
		const getter = vi.fn(() => {
			throw Error("unsafe")
		})
		const data: Record<string, unknown> = { big: 2n }
		data.self = data
		Object.defineProperty(data, "bad", { enumerable: true, get: getter })
		expect(safeSnapshot(data)).toEqual({ big: "2n", self: "[Circular]", bad: "[Accessor]" })
		expect(getter).not.toHaveBeenCalled()
	})
	it("bounds multi-byte strings and wide/deep records and marks truncation", () => {
		const item = record({
			text: "😀汉字".repeat(100000),
			more: Array(10000).fill("x".repeat(1000)),
		})
		expect(byteLength(JSON.stringify(item))).toBeLessThanOrEqual(32768)
		expect(item.truncation).toBeDefined()
	})
	it("enumerates own fields without Object.hasOwn, including null prototypes and shadowed methods", () => {
		const original = Object.getOwnPropertyDescriptor(Object, "hasOwn")
		const plain = Object.assign(Object.create(null), { own: 1 })
		const inherited = Object.assign(Object.create({ inherited: 2 }), {
			own: 3,
			hasOwnProperty: "shadowed",
		})
		let snapshots: unknown[] = []
		try {
			Object.defineProperty(Object, "hasOwn", { value: undefined, configurable: true })
			snapshots = [safeSnapshot(plain), safeSnapshot(inherited)]
		} finally {
			if (original) Object.defineProperty(Object, "hasOwn", original)
			else Reflect.deleteProperty(Object, "hasOwn")
		}
		expect(snapshots[0]).toEqual({ own: 1 })
		expect(snapshots[1]).toEqual({ own: 3, hasOwnProperty: "shadowed" })
	})
	it("redacts all remote context, credentials and query-string secrets", () => {
		const item = createRecord(
			"error",
			{
				data: [
					{
						eventKey: "api_token_failure",
						errorKind: "network",
						error: "?token=private",
						context: { cookie: "session-secret", email: "a@b.com", password: "pw" },
					},
				],
			},
			{ url: "https://a/?token=private", info: { uId: "id" } },
			"s",
			"r",
		)
		const json = JSON.stringify(item)
		expect(json).not.toContain("private")
		expect(json).not.toContain("session-secret")
		expect(item.eventKey).toBe("api_token_failure")
	})
	it("hashes object input independently of property order", () => {
		expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }))
		expect(fingerprint({ message: "error123" })).not.toBe(fingerprint({ message: "error456" }))
	})
})

describe("runtime", () => {
	it("snapshots identity at write time, deduplicates by identity and emits counts", async () => {
		vi.useFakeTimers()
		const sent: unknown[] = []
		const transport = vi
			.spyOn(FetchTransport.prototype, "send")
			.mockImplementation(async (batch, count) => {
				sent.push(batch)
				return { ok: count > 0 }
			})
		const runtime = new LoggerRuntime()
		let user = "a"
		runtime.start({ fetcher: fetch, remote: true, getContext: () => ({ info: { uId: user } }) })
		const data = [{ eventKey: "failed", errorKind: "test", error: "bad" }]
		runtime.write("error", { data })
		runtime.write("error", { data })
		user = "b"
		runtime.write("error", { data })
		await vi.advanceTimersByTimeAsync(15001)
		expect(runtime.stats()).toMatchObject({ suppressed: 1, admitted: 3, accepted: 3 })
		expect(transport).toHaveBeenCalled()
		await runtime.shutdown({ timeoutMs: 0 })
	})
	it("honors false, is idempotent and contains broken providers and shutdown calls", async () => {
		const runtime = new LoggerRuntime()
		const context = vi.fn(() => {
			throw Error("store")
		})
		expect(runtime.start({ fetcher: fetch, getContext: context, enabled: false })).toBe(true)
		expect(runtime.start({ fetcher: fetch })).toBe(false)
		runtime.write("error", { data: "x" })
		expect(context).not.toHaveBeenCalled()
		runtime.configure({ enabled: true })
		runtime.write("error", { data: "x" }, { error: false })
		expect(context).not.toHaveBeenCalled()
		runtime.write("error", { data: "x" })
		expect(runtime.stats()).toMatchObject({ context_failed: 1 })
		await runtime.shutdown()
		runtime.write("error", { data: "x" })
		expect(runtime.stats()).toMatchObject({ state: "closed", after_shutdown: 1 })
	})
	it("bounds pre-start buffering and does not buffer informational calls", async () => {
		const runtime = new LoggerRuntime()
		for (let i = 0; i < 110; i++) runtime.write("report", { data: [i] })
		runtime.write("info", { data: "ignore" })
		expect(runtime.stats()).toMatchObject({ early_capacity: 10 })
		runtime.start({ fetcher: fetch, remote: false })
		await runtime.shutdown()
	})
})

describe("delivery", () => {
	it("enforces the queue bound and cancels outstanding entries on shutdown", async () => {
		vi.useFakeTimers()
		const count = vi.fn()
		const queue = new DeliveryQueue(new FetchTransport(fetch), count)
		for (let i = 0; i < 1005; i++) queue.add(record([i]))
		expect(count.mock.calls.filter(([reason]) => reason === "queue_capacity")).toHaveLength(5)
		queue.destroy()
		expect(count.mock.calls.find(([reason]) => reason === "shutdown")?.[1]).toBe(1000)
	})
	it("does not retry a hidden-page 413 and uses keepalive only for hidden delivery", async () => {
		vi.useFakeTimers()
		const send = vi
			.spyOn(FetchTransport.prototype, "send")
			.mockResolvedValue({ ok: false, retryable: false, reason: "http_413" })
		const queue = new DeliveryQueue(new FetchTransport(fetch), vi.fn())
		queue.add(record())
		await Promise.resolve()
		await Promise.resolve()
		await queue.hidden()
		await vi.advanceTimersByTimeAsync(10000)
		expect(send).toHaveBeenCalledTimes(1)
		expect(send.mock.calls[0][2]).toEqual({ keepalive: true })
		queue.destroy()
	})
	it("flush timeout does not wait forever on an unresolved request", async () => {
		vi.useFakeTimers()
		vi.spyOn(FetchTransport.prototype, "send").mockImplementation(() => new Promise(() => {}))
		const queue = new DeliveryQueue(new FetchTransport(fetch), vi.fn())
		queue.add(record())
		const flushed = queue.flush({ timeoutMs: 20 })
		await vi.advanceTimersByTimeAsync(21)
		expect(await flushed).toBe(false)
		queue.destroy()
	})
	it.each([400, 401, 413])("does not retry HTTP %s", async (status) => {
		const transport = new FetchTransport(vi.fn(async () => new Response("", { status })))
		expect(await transport.send({ body: new Uint8Array() }, 1)).toMatchObject({
			ok: false,
			retryable: false,
		})
	})
	it.each([429, 500, 503])("allows retry for HTTP %s", async (status) => {
		const transport = new FetchTransport(
			vi.fn(async () => new Response("", { status, headers: { "Retry-After": "2" } })),
		)
		expect(await transport.send({ body: new Uint8Array() }, 1)).toMatchObject({
			ok: false,
			retryable: true,
			retryAfterMs: 2000,
		})
	})
	it("rejects old/inaccurate acknowledgements", async () => {
		for (const response of [
			new Response('{"code":1000}'),
			receipt(2),
			new Response("<html>"),
		]) {
			const transport = new FetchTransport(vi.fn(async () => response))
			expect(await transport.send({ body: new Uint8Array() }, 1)).toMatchObject({
				ok: false,
				reason: "invalid_receipt",
			})
		}
	})
	it("aborts an actual request on timeout", async () => {
		vi.useFakeTimers()
		const transport = new FetchTransport(
			vi.fn(
				(_, init) =>
					new Promise<Response>((_, reject) =>
						init?.signal?.addEventListener("abort", () => reject(Error("aborted"))),
					),
			),
		)
		const result = transport.send({ body: new Uint8Array() }, 1)
		await vi.advanceTimersByTimeAsync(5001)
		expect(await result).toMatchObject({ ok: false, reason: "timeout" })
	})
	it("retries twice using the identical encoded batch and settles flush", async () => {
		vi.useFakeTimers()
		vi.spyOn(Math, "random").mockReturnValue(0)
		const send = vi
			.spyOn(FetchTransport.prototype, "send")
			.mockResolvedValue({ ok: false, retryable: true, reason: "network" })
		const queue = new DeliveryQueue(new FetchTransport(fetch), vi.fn())
		queue.add(record())
		const flushed = queue.flush({ timeoutMs: 10000 })
		await vi.advanceTimersByTimeAsync(3500)
		expect(send).toHaveBeenCalledTimes(3)
		expect(send.mock.calls[0][0]).toBe(send.mock.calls[2][0])
		expect(await flushed).toBe(true)
		queue.destroy()
	})
	it("honors zero retry and rejects keepalive over its aggregate budget", async () => {
		vi.useFakeTimers()
		const send = vi
			.spyOn(FetchTransport.prototype, "send")
			.mockResolvedValue({ ok: false, retryable: true })
		const queue = new DeliveryQueue(new FetchTransport(fetch), vi.fn(), 0)
		queue.add(record())
		const flushed = queue.flush()
		await vi.advanceTimersByTimeAsync(1)
		expect(await flushed).toBe(true)
		expect(send).toHaveBeenCalledTimes(1)
		queue.destroy()
		send.mockRestore()
		expect(
			await new FetchTransport(fetch).send({ body: new Uint8Array(49 * 1024) }, 1, {
				keepalive: true,
			}),
		).toMatchObject({ reason: "keepalive_budget" })
	})
})
