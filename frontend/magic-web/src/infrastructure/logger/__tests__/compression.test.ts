// @vitest-environment node
import { gunzipSync } from "node:zlib"
import { afterEach, expect, it, vi } from "vitest"
import { encodeBatch, FetchTransport } from "../delivery/transport"
import { DeliveryQueue } from "../delivery/queue"
import { createRecord } from "../record"
import { normalLimits } from "../limits"

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

it("gzips tiny batches even when the gzip body is larger, and sends the encoding header", async () => {
	const json = "[]"
	const fallback = vi.fn()
	const batch = await encodeBatch(json, fallback)
	expect(batch.encoding).toBe("gzip")
	expect(batch.body.byteLength).toBeGreaterThan(new TextEncoder().encode(json).byteLength)
	expect(gunzipSync(batch.body).toString("utf8")).toBe(json)
	expect(fallback).not.toHaveBeenCalled()
	const fetcher = vi.fn(async () => new Response('{"code":1000,"accepted":0}'))
	expect(await new FetchTransport(fetcher).send(batch, 0)).toEqual({ ok: true })
	expect(fetcher).toHaveBeenCalledWith(
		"/log-report",
		expect.objectContaining({
			body: batch.body,
			headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" },
		}),
	)
})

it("delivers a single small log through the real queue as recoverable gzip", async () => {
	const item = createRecord(
		"report",
		{ namespace: "gzip-test", data: "小批次" },
		{},
		"session",
		"release",
	)
	expect(new TextEncoder().encode(JSON.stringify([item])).byteLength).toBeLessThan(1024)
	const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
		expect(new Headers(init?.headers).get("Content-Encoding")).toBe("gzip")
		expect(JSON.parse(gunzipSync(init?.body as Uint8Array).toString("utf8"))).toEqual([item])
		return new Response('{"code":1000,"accepted":1}')
	})
	const count = vi.fn()
	const queue = new DeliveryQueue(new FetchTransport(fetcher), count)
	try {
		queue.add(item)
		expect(await queue.flush({ timeoutMs: 1000 })).toBe(true)
		expect(fetcher).toHaveBeenCalledTimes(1)
		expect(count).toHaveBeenCalledWith("accepted", 1)
	} finally {
		queue.destroy()
	}
})

it.each(["unavailable", "failed"])(
	"falls back to JSON when gzip is %s and records why",
	async (reason) => {
		vi.stubGlobal(
			"CompressionStream",
			reason === "unavailable"
				? undefined
				: class {
						constructor() {
							throw new Error("compression unavailable")
						}
					},
		)
		const fallback = vi.fn()
		const json = '[{"message":"你好"}]'
		const batch = await encodeBatch(json, fallback)
		expect(batch.encoding).toBeUndefined()
		expect(new TextDecoder().decode(batch.body)).toBe(json)
		expect(fallback).toHaveBeenCalledWith(`gzip_${reason}`)
		const fetcher = vi.fn<typeof fetch>(async () => new Response('{"code":1000,"accepted":1}'))
		expect(await new FetchTransport(fetcher).send(batch, 1)).toEqual({ ok: true })
		expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).has("Content-Encoding")).toBe(false)
	},
)

it("falls back within the 2 MiB wire limit when compressed output expands past it", async () => {
	vi.stubGlobal(
		"CompressionStream",
		class {
			constructor() {
				return new TransformStream({
					transform(_chunk, controller) {
						controller.enqueue(new Uint8Array(normalLimits.batchBytes + 1))
					},
				})
			}
		},
	)
	const fallback = vi.fn()
	const batch = await encodeBatch("[]", fallback)
	expect(batch.encoding).toBeUndefined()
	expect(new TextDecoder().decode(batch.body)).toBe("[]")
	expect(fallback).toHaveBeenCalledWith("gzip_capacity")
})

it("prepares real gzip before hidden-page keepalive delivery", async () => {
	const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
		expect(init?.keepalive).toBe(true)
		expect(new Headers(init?.headers).get("Content-Encoding")).toBe("gzip")
		const records = JSON.parse(gunzipSync(init?.body as Uint8Array).toString("utf8"))
		expect(records[0].namespace).toBe("hidden-gzip")
		return new Response('{"code":1000,"accepted":1}')
	})
	const count = vi.fn()
	const queue = new DeliveryQueue(new FetchTransport(fetcher), count)
	try {
		queue.add(createRecord("report", { namespace: "hidden-gzip", data: "small" }, {}, "s", "r"))
		await vi.waitFor(
			async () => {
				await queue.hidden()
				expect(count).toHaveBeenCalledWith("accepted", 1)
			},
			{ timeout: 1000, interval: 10 },
		)
		expect(fetcher).toHaveBeenCalledTimes(1)
	} finally {
		queue.destroy()
	}
})
