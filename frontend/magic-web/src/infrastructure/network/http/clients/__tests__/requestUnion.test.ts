import { afterEach, describe, expect, it, vi } from "vitest"
import { createMagicClient } from "../createMagicClient"
import type { RequestConfig } from "../types"

const owners: ReturnType<typeof createMagicClient>[] = []
afterEach(() => owners.splice(0).forEach((owner) => owner.dispose()))

function setup() {
	const completions: ((response: Response) => void)[] = []
	const fetcher = vi.fn<typeof fetch>(() => new Promise((resolve) => completions.push(resolve)))
	let partition = "session-a"
	let nextId = 0
	const owner = createMagicClient({
		baseURL: "https://api.test",
		fetch: fetcher,
		context: {
			resolve: () => ({ partition }),
			isCurrent: () => true,
			getKey: (snapshot) => snapshot.partition,
		},
		readiness: { wait: () => Promise.resolve() },
		requestInterceptors: [
			(request) => {
				const headers = (request.headers ??= new Headers())
				if (!headers.has("authorization")) headers.set("authorization", "default-token")
				if (!headers.has("request-id")) headers.set("request-id", `generated-${++nextId}`)
				return request
			},
		],
	})
	owners.push(owner)
	return {
		client: owner.client,
		fetcher,
		setPartition: (value: string) => {
			partition = value
		},
		finish() {
			for (const resolve of completions.splice(0)) {
				resolve(
					new Response(JSON.stringify({ data: { ok: true } }), {
						headers: { "Content-Type": "application/json" },
					}),
				)
			}
		},
	}
}

// Let both asynchronous preparation pipelines reach their deduplication decision.
const prepared = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("explicit in-flight request union", () => {
	it.each(["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"])(
		"shares equivalent %s executions when explicitly enabled",
		async (method) => {
			const { client, fetcher, finish } = setup()
			const config = {
				method,
				url: "/same",
				enableRequestUnion: true,
				...(["POST", "PUT", "PATCH", "DELETE"].includes(method)
					? { body: '{"value":1}' }
					: {}),
			}
			const calls = [client.request(config), client.request(config)]
			await prepared()
			expect(fetcher).toHaveBeenCalledTimes(1)
			finish()
			expect(await Promise.all(calls)).toEqual([{ ok: true }, { ok: true }])
		},
	)

	it.each(["post", "put", "patch", "delete"] as const)(
		"shares serialized bodies through %s",
		async (method) => {
			const { client, fetcher, finish } = setup()
			const calls = [1, 2].map(() =>
				client[method](
					"/same",
					{ value: 1 },
					{
						enableRequestUnion: true,
					},
				),
			)
			await prepared()
			expect(fetcher).toHaveBeenCalledTimes(1)
			expect(fetcher.mock.calls[0][1]?.body).toBe('{"value":1}')
			finish()
			await Promise.all(calls)
		},
	)

	it("compares final headers across omitted, empty, object and callback input", async () => {
		const { client, fetcher, finish } = setup()
		const headers: RequestConfig["headers"][] = [
			undefined,
			{},
			new Headers(),
			{ AUTHORIZATION: "default-token" },
			(value) => new Headers(value),
		]
		const calls = headers.map((value) =>
			client.get("/same", { headers: value, enableRequestUnion: true }),
		)
		await prepared()
		expect(fetcher).toHaveBeenCalledTimes(1)
		expect((fetcher.mock.calls[0][1]?.headers as Headers).get("request-id")).toMatch(
			/^generated-/,
		)
		finish()
		await Promise.all(calls)
	})

	it.each(["authorization", "organization-code", "language", "x-custom"])(
		"separates differing explicit %s headers, including callback overrides",
		async (name) => {
			const { client, fetcher, finish } = setup()
			const calls = ["a", "b"].map((value) =>
				client.get("/same", {
					enableRequestUnion: true,
					headers: (headers) => {
						headers.set(name, value)
						return new Headers(headers)
					},
				}),
			)
			await prepared()
			expect(fetcher).toHaveBeenCalledTimes(2)
			finish()
			await Promise.all(calls)
		},
	)

	it("preserves equal explicit request IDs and normalizes header casing/order", async () => {
		const { client, fetcher, finish } = setup()
		const headers: HeadersInit[] = [
			{ "Request-ID": "caller-id", "X-Custom": "same" },
			{ "x-custom": "same", "request-id": "caller-id" },
		]
		const calls = headers.map((value) =>
			client.get("/same", { headers: value, enableRequestUnion: true }),
		)
		await prepared()
		expect(fetcher).toHaveBeenCalledTimes(1)
		expect((fetcher.mock.calls[0][1]?.headers as Headers).get("request-id")).toBe("caller-id")
		finish()
		await Promise.all(calls)
	})

	it("compares headers added by interceptors after receiving identical caller headers", async () => {
		const { client, fetcher, finish } = setup()
		let sequence = 0
		client.addRequestInterceptor((request) => {
			request.headers?.set("x-response-variant", String(++sequence))
			return request
		})
		const calls = [1, 2].map(() =>
			client.get("/same", { headers: {}, enableRequestUnion: true }),
		)
		await prepared()
		expect(fetcher).toHaveBeenCalledTimes(2)
		finish()
		await Promise.all(calls)
	})

	it.each([
		{ method: "PUT", body: "a" },
		{ method: "POST", body: "b" },
		{ method: "POST", body: "a", credentials: "include" as const },
		{ method: "POST", body: "a", unwrapData: false },
	])("keeps distinct request semantics separate: %o", async (second) => {
		const { client, fetcher, finish } = setup()
		const base = {
			url: "/same",
			enableRequestUnion: true,
			headers: { "request-id": "same-operation" },
		}
		const calls = [
			client.request({ ...base, method: "POST", body: "a" }),
			client.request({ ...base, ...second }),
		]
		await prepared()
		expect(fetcher).toHaveBeenCalledTimes(2)
		finish()
		await Promise.all(calls)
	})

	it("does not merge by default or share across contexts or client instances", async () => {
		const first = setup(),
			second = setup()
		const calls = [first.client.get("/same"), first.client.get("/same")]
		calls.push(first.client.get("/same", { enableRequestUnion: true }))
		await prepared()
		first.setPartition("session-b")
		calls.push(first.client.get("/same", { enableRequestUnion: true }))
		calls.push(second.client.get("/same", { enableRequestUnion: true }))
		await prepared()
		expect(first.fetcher).toHaveBeenCalledTimes(4)
		expect(second.fetcher).toHaveBeenCalledTimes(1)
		first.finish()
		second.finish()
		await Promise.all(calls)
	})

	it("keeps caller cancellation independent even with identical headers and body", async () => {
		const { client, fetcher, finish } = setup()
		const controller = new AbortController()
		const cancelled = client.post(
			"/same",
			{ value: 1 },
			{
				enableRequestUnion: true,
				signal: controller.signal,
				headers: { "request-id": "same-operation" },
			},
		)
		const other = client.post(
			"/same",
			{ value: 1 },
			{
				enableRequestUnion: true,
				headers: { "request-id": "same-operation" },
			},
		)
		const result = Promise.allSettled([cancelled, other])
		await prepared()
		expect(fetcher).toHaveBeenCalledTimes(2)
		controller.abort()
		expect(fetcher.mock.calls[1][1]?.signal?.aborted).toBe(false)
		finish()
		const outcomes = await result
		expect(outcomes[0]).toMatchObject({ status: "rejected", reason: { name: "AbortError" } })
		expect(outcomes[1]).toMatchObject({ status: "fulfilled" })
	})

	it("starts a new execution after the previous shared execution completes", async () => {
		const { client, fetcher, finish } = setup()
		for (let round = 0; round < 2; round++) {
			const calls = [1, 2].map(() => client.get("/same", { enableRequestUnion: true }))
			await prepared()
			expect(fetcher).toHaveBeenCalledTimes(round + 1)
			finish()
			await Promise.all(calls)
		}
		expect((fetcher.mock.calls[0][1]?.headers as Headers).get("request-id")).not.toBe(
			(fetcher.mock.calls[1][1]?.headers as Headers).get("request-id"),
		)
	})

	it.each(["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"])(
		"ignores explicit IDs for %s requests",
		async (method) => {
			const { client, fetcher, finish } = setup()
			const calls = ["a", "b"].map((id) =>
				client.request({
					method,
					url: "/same",
					enableRequestUnion: true,
					headers: (headers) => {
						headers.set("request-id", id)
						return new Headers(headers)
					},
				}),
			)
			await prepared()
			expect(fetcher).toHaveBeenCalledTimes(1)
			finish()
			await Promise.all(calls)
		},
	)

	it.each(["POST", "PUT", "PATCH", "DELETE"])(
		"shares equivalent %s requests across generated and caller-supplied IDs",
		async (method) => {
			const { client, fetcher, finish } = setup()
			const calls = [undefined, undefined, "a", "b"].map((id) =>
				client.request({
					method,
					url: "/same",
					body: "same",
					enableRequestUnion: true,
					headers: id ? { "request-id": id } : undefined,
				}),
			)
			await prepared()
			expect(fetcher).toHaveBeenCalledTimes(1)
			finish()
			await Promise.all(calls)
		},
	)

	it.each([null, ""])("shares equivalent requests with an absent/empty ID (%s)", async (id) => {
		const { client, fetcher, finish } = setup()
		const calls = [1, 2].map(() =>
			client.post(
				"/same",
				{},
				{
					enableRequestUnion: true,
					headers: (headers) => {
						if (id === null) headers.delete("request-id")
						else headers.set("request-id", id)
						return headers
					},
				},
			),
		)
		await prepared()
		expect(fetcher).toHaveBeenCalledTimes(1)
		finish()
		await Promise.all(calls)
	})

	it.each(["GET", "POST", "PUT", "PATCH", "DELETE"])(
		"keeps %s requests independent unless explicitly enabled",
		async (method) => {
			const { client, fetcher, finish } = setup()
			const calls = [undefined, false, true].flatMap((enableRequestUnion) =>
				[1, 2].map(() =>
					client.request({
						url: "/same",
						method,
						enableRequestUnion,
						headers: { "request-id": "same-id" },
					}),
				),
			)
			await prepared()
			expect(fetcher).toHaveBeenCalledTimes(5)
			finish()
			await Promise.all(calls)
		},
	)
})
