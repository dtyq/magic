import { afterEach, describe, expect, it, vi } from "vitest"
import { createHttpClient } from "../createHttpClient"
import { createMagicClient } from "../clients/createMagicClient"
import { createIframeClient } from "../clients/createIframeClient"
import { createHttpClientSlot, http, startDefaultHttpRuntime } from "../runtime"
import type { ServiceClientBindings } from "../clients/types"
import { generateAuthApi } from "@/apis/modules/auth"
import { ServiceHttpClient } from "@/infrastructure/network/http/clients"

function json(value: unknown = { code: 1000, data: { ok: true } }, status = 200) {
	return new Response(JSON.stringify(value), {
		status,
		headers: { "Content-Type": "application/json" },
	})
}
interface TestScope {
	scopeId: string
	sessionEpoch: number
	language: string
	authorization?: string
	organizationCode?: string
}
function bindings(
	scopeId = "a",
	fetcher = vi.fn<typeof fetch>(async () => json()),
): ServiceClientBindings<TestScope> {
	return {
		baseURL: `https://${scopeId}.test`,
		fetch: fetcher,
		context: {
			resolve: () => ({
				scopeId,
				sessionEpoch: 0,
				authorization: `token-${scopeId}`,
				organizationCode: `org-${scopeId}`,
				language: "en_US",
			}),
			isCurrent: () => true,
			getKey: ({ scopeId, sessionEpoch, language }) =>
				JSON.stringify([scopeId, sessionEpoch, language]),
		},
		readiness: { wait: async () => {} },
		// A test application explicitly installs its header policy; the factory has none.
		requestInterceptors: [
			(config, snapshot) => {
				if (snapshot.authorization)
					config.headers!.set("authorization", snapshot.authorization)
				return config
			},
		],
	}
}
afterEach(() => vi.restoreAllMocks())

describe("HTTP migration contracts", () => {
	it("runs raw HTTP without a business provider and keeps legacy envelope unwrapping", async () => {
		const fetcher = vi.fn<typeof fetch>(async () => json())
		const raw = createHttpClient({ baseURL: "https://a.test", fetch: fetcher })
		expect(await raw.get("/raw")).toMatchObject({ status: 200, data: { code: 1000 } })
		const legacy = new ServiceHttpClient({ baseURL: "https://a.test", fetch: fetcher })
		expect(await legacy.get("/legacy")).toEqual({ ok: true })
		expect((fetcher.mock.calls[0][1]?.headers as Headers).has("authorization")).toBe(false)
	})

	it("allows API objects created before initialization and preserves their client identity", async () => {
		const api = generateAuthApi(http)
		await expect(api.getAccountDeployCode()).rejects.toMatchObject({
			name: "HttpNotInitializedError",
		})
		const runtime = startDefaultHttpRuntime({
			magic: createMagicClient(bindings()),
			iframe: createIframeClient(bindings()),
		})
		try {
			expect(await api.getAccountDeployCode()).toEqual({ ok: true })
		} finally {
			runtime.dispose()
		}
		await expect(api.getAccountDeployCode()).rejects.toMatchObject({
			name: "HttpNotInitializedError",
		})
	})

	it("old owners cannot dispose a replacement and independent clients outlive defaults", async () => {
		const slot = createHttpClientSlot("test")
		const old = slot.bind(createMagicClient(bindings("a")))
		const nextFetch = vi.fn<typeof fetch>(async () => json())
		const next = slot.bind(createMagicClient(bindings("b", nextFetch)))
		old.dispose()
		await slot.client.get("/next")
		expect(nextFetch).toHaveBeenCalledWith("https://b.test/next", expect.anything())
		const independent = createMagicClient(bindings("c"))
		next.dispose()
		expect(await independent.client.get("/independent")).toEqual({ ok: true })
		independent.dispose()
	})

	it("keeps credentials, cancellation and error effects isolated between factory instances", async () => {
		let resolveA!: (value: Response) => void
		const fetchA = vi.fn<typeof fetch>(
			() =>
				new Promise((resolve) => {
					resolveA = resolve
				}),
		)
		const fetchB = vi.fn<typeof fetch>(async () => json())
		const effectA = vi.fn(async (value) => value)
		const a = createMagicClient({ ...bindings("a", fetchA), responseInterceptors: [effectA] })
		const b = createMagicClient(bindings("b", fetchB))
		const pending = a.client.get("/pending")
		const rejected = expect(pending).rejects.toMatchObject({ name: "HttpDisposedError" })
		await vi.waitFor(() => expect(fetchA).toHaveBeenCalledOnce())
		a.dispose()
		expect(fetchA.mock.calls[0][1]?.signal?.aborted).toBe(true)
		await b.client.get("/ok")
		expect((fetchB.mock.calls[0][1]?.headers as Headers).get("authorization")).toBe("token-b")
		resolveA(json())
		await rejected
		expect(effectA).not.toHaveBeenCalled()
		b.dispose()
	})

	it("cancels a waiting gate without waiting for bootstrap to finish", async () => {
		const options = bindings()
		const owned = createMagicClient({
			...options,
			readiness: { wait: () => new Promise(() => {}) },
		})
		const controller = new AbortController()
		const pending = owned.client.get("/wait", { signal: controller.signal })
		controller.abort()
		await expect(pending).rejects.toMatchObject({ name: "AbortError" })
		expect(options.fetch).not.toHaveBeenCalled()
		owned.dispose()
	})

	it("owner cancellation still applies when a caller supplies a signal", async () => {
		const options = bindings()
		const owned = createMagicClient({
			...options,
			readiness: { wait: () => new Promise(() => {}) },
		})
		const caller = new AbortController()
		const pending = owned.client.get("/wait", { signal: caller.signal })
		owned.dispose()
		await expect(pending).rejects.toMatchObject({
			name: expect.stringMatching(/AbortError|HttpDisposedError/),
		})
		expect(caller.signal.aborted).toBe(false)
		expect(options.fetch).not.toHaveBeenCalled()
	})

	it("deduplicates equivalent queries only within the same identity and locale", async () => {
		const responses: ((value: Response) => void)[] = []
		const fetcher = vi.fn<typeof fetch>(() => new Promise((resolve) => responses.push(resolve)))
		let language = "en_US"
		const original = bindings("a", fetcher)
		const owned = createMagicClient({
			...original,
			context: {
				...original.context,
				resolve: () => ({ ...original.context.resolve(), language }),
				isCurrent: () => true,
			},
		})
		const one = owned.client.get("/list", { enableRequestUnion: true, params: { page: 1 } })
		const two = owned.client.get("/list", {
			enableRequestUnion: true,
			params: { page: 1, absent: null },
		})
		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
		language = "zh_CN"
		const three = owned.client.get("/list", { enableRequestUnion: true, params: { page: 1 } })
		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
		responses.forEach((resolve) => resolve(json()))
		await Promise.all([one, two, three])
		owned.dispose()
	})

	it("rejects stale responses before any application response effect", async () => {
		let resolve!: (value: Response) => void
		let epoch = 0
		const effect = vi.fn(async (value) => value)
		const fetcher = vi.fn<typeof fetch>(
			() =>
				new Promise((done) => {
					resolve = done
				}),
		)
		const owned = createMagicClient({
			...bindings("a", fetcher),
			context: {
				resolve: () => ({ scopeId: "a", sessionEpoch: epoch, language: "en_US" }),
				isCurrent: (snapshot) => snapshot.sessionEpoch === epoch,
			},
			responseInterceptors: [effect],
		})
		const pending = owned.client.get("/old")
		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
		epoch++
		resolve(json({ code: 40101 }))
		await expect(pending).rejects.toMatchObject({ name: "AbortError" })
		expect(effect).not.toHaveBeenCalled()
		owned.dispose()
	})

	it("keeps iframe HTTP and business failures local", async () => {
		const fetcher = vi.fn<typeof fetch>(async () =>
			json({ code: 40101, message: "invalid org" }),
		)
		const owned = createIframeClient(bindings("iframe", fetcher))
		await expect(owned.client.get("/failure")).rejects.toThrow("invalid org")
		owned.dispose()
	})

	it("retains scope validation when a header callback returns a new Headers object", async () => {
		let epoch = 0
		let complete!: (value: Response) => void
		const fetcher = vi.fn<typeof fetch>(
			() =>
				new Promise((resolve) => {
					complete = resolve
				}),
		)
		const owned = createMagicClient({
			...bindings("a", fetcher),
			context: {
				resolve: () => ({ scopeId: "a", sessionEpoch: epoch, language: "en_US" }),
				isCurrent: (snapshot) => snapshot.sessionEpoch === epoch,
			},
		})
		const pending = owned.client.get("/headers", { headers: (headers) => new Headers(headers) })
		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
		epoch++
		complete(json())
		await expect(pending).rejects.toMatchObject({ name: "AbortError" })
		owned.dispose()
	})

	it("does not retry with a new identity after the readiness gate resumes", async () => {
		let epoch = 0
		let openGate!: () => void
		const fetcher = vi.fn<typeof fetch>(async () => json())
		const owned = createMagicClient({
			...bindings("a", fetcher),
			context: {
				resolve: () => ({
					scopeId: "a",
					sessionEpoch: epoch,
					authorization: `token-${epoch}`,
					language: "en_US",
				}),
				isCurrent: (snapshot) => snapshot.sessionEpoch === epoch,
			},
			readiness: {
				wait: () =>
					fetcher.mock.calls.length
						? new Promise((resolve) => {
								openGate = resolve
							})
						: Promise.resolve(),
			},
		})
		owned.client.addResponseInterceptor(async (context) => {
			await context.http.retry({ ...context.request, authRetryAttempt: 1 })
			return context
		})
		const pending = owned.client.get("/retry")
		await vi.waitFor(() => expect(openGate).toBeTypeOf("function"))
		epoch++
		openGate()
		await expect(pending).rejects.toMatchObject({ name: "AbortError" })
		expect(fetcher).toHaveBeenCalledOnce()
		owned.dispose()
	})

	it("does not interpret business snapshot fields without application interceptors", async () => {
		const options = bindings()
		const owned = createMagicClient({ ...options, requestInterceptors: [] })
		await owned.client.request({
			url: "/upload",
			method: "POST",
			body: new FormData(),
			enableAuthorization: false,
		})
		const headers = vi.mocked(options.fetch!).mock.calls[0][1]?.headers as Headers
		expect(headers.has("authorization")).toBe(false)
		expect(headers.has("Content-Type")).toBe(false)
		expect(headers.has("language")).toBe(false)
		expect(headers.has("organization-code")).toBe(false)
		expect(headers.has("request-id")).toBe(false)
		owned.dispose()
	})

	it("runs final diagnostics once for a shared failed execution", async () => {
		let reject!: (error: Error) => void
		const fetcher = vi.fn<typeof fetch>(
			() =>
				new Promise((_resolve, fail) => {
					reject = fail
				}),
		)
		const onError = vi.fn()
		const owned = createMagicClient({ ...bindings("a", fetcher), onError })
		const requests = [1, 2].map(() => owned.client.get("/same", { enableRequestUnion: true }))
		const settled = Promise.allSettled(requests)
		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
		const error = new Error("offline")
		reject(error)
		expect((await settled).every((result) => result.status === "rejected")).toBe(true)
		expect(onError).toHaveBeenCalledExactlyOnceWith(error)
		owned.dispose()
	})

	it("allows cleanup requests after abort and preserves legacy cleanup-failure handling", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {})
		const options = bindings()
		const owned = createMagicClient(options)
		await expect(
			owned.client.abort(async () => {
				await owned.client.get("/logout", { signal: new AbortController().signal })
				throw new Error("cleanup failed")
			}),
		).resolves.toBeUndefined()
		expect(options.fetch).toHaveBeenCalledOnce()
		owned.dispose()
	})
})
