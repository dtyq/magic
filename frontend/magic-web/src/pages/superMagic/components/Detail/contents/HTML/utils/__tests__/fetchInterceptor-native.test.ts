import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/pages/superMagic/utils/api", () => ({ getTemporaryDownloadUrl: vi.fn() }))
vi.mock("@/utils/env", () => ({ env: () => "https://cdn.example.test" }))
vi.mock("../index", () => ({
	rewriteHtmlCdnWithHost: (html: string) => new DOMParser().parseFromString(html, "text/html"),
}))

import { generateFetchInterceptorScript } from "../fetchInterceptor"

describe("resource interceptor native request semantics", () => {
	const originalFetch = window.fetch
	const prototype = XMLHttpRequest.prototype
	const originals = {
		open: prototype.open,
		send: prototype.send,
		abort: prototype.abort,
		setRequestHeader: prototype.setRequestHeader,
	}
	let requests: Array<{ requestId: string; relativePath: string }>
	let fetchSpy: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.useFakeTimers()
		requests = []
		fetchSpy = vi.fn(async () => new Response("ok"))
		window.fetch = fetchSpy as typeof fetch
		vi.spyOn(window, "postMessage").mockImplementation((message) => {
			if (message.type === "MAGIC_FETCH_URL_REQUEST") requests.push(message)
		})
	})

	afterEach(() => {
		// Settle pending resolver timers before restoring the injected window hooks.
		vi.clearAllTimers()
		vi.useRealTimers()
		vi.restoreAllMocks()
		Object.assign(prototype, originals)
		window.fetch = originalFetch
	})

	function respond(index: number, success = true) {
		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					type: "MAGIC_FETCH_URL_RESPONSE",
					requestId: requests[index].requestId,
					success,
					url: "https://download.example.test/resource.json",
					expires_at: "2099-01-01 00:00:00",
				},
			}),
		)
	}

	it("rejects an already aborted relative fetch without asking the parent", async () => {
		window.eval(generateFetchInterceptorScript())
		const controller = new AbortController()
		controller.abort(new Error("cancelled before fetch"))
		const result = window.fetch("./data.json", { signal: controller.signal })
		const rejection = expect(result).rejects.toBe(controller.signal.reason)
		await vi.runAllTimersAsync()
		await rejection
		expect(requests).toEqual([])
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	it("cancels one waiter immediately while another shares the URL resolution", async () => {
		window.eval(generateFetchInterceptorScript())
		const controller = new AbortController()
		const cancelled = window.fetch("./data.json", { signal: controller.signal })
		const active = window.fetch("./data.json")
		let outcome: unknown = "pending"
		void cancelled.catch((error) => {
			outcome = error
		})
		controller.abort()
		await vi.advanceTimersByTimeAsync(0)
		expect(outcome).toBe(controller.signal.reason)
		expect(requests).toHaveLength(1)
		respond(0)
		await active
		expect(fetchSpy).toHaveBeenCalledTimes(1)
		expect(await window.fetch("./data.json")).toBeInstanceOf(Response)
		expect(requests).toHaveLength(1)
	})

	it("does not convert cancellation into a 404 or poison the shared URL cache", async () => {
		window.eval(generateFetchInterceptorScript())
		const controller = new AbortController()
		const cancelled = window.fetch("./data.json", { signal: controller.signal })
		controller.abort()
		// Capture the actual reason after abort, before the asynchronous result settles.
		respond(0, false)
		await expect(cancelled).rejects.toBe(controller.signal.reason)
		const next = window.fetch("./data.json")
		expect(requests).toHaveLength(2)
		respond(1)
		await next
	})

	it("replays headers after reopening a resolved XHR", async () => {
		const sentHeaders: Array<Record<string, string>> = []
		const headers = new WeakMap<XMLHttpRequest, Record<string, string>>()
		const open = vi.spyOn(prototype, "open").mockImplementation(function (
			this: XMLHttpRequest,
		) {
			// Native open resets author request headers (WHATWG XHR §3.5.1).
			headers.set(this, {})
			Object.defineProperty(this, "readyState", { configurable: true, value: 1 })
		})
		vi.spyOn(prototype, "setRequestHeader").mockImplementation(function (
			this: XMLHttpRequest,
			key,
			value,
		) {
			const current = headers.get(this)
			if (!current) throw new Error("Expected native open before setting headers")
			current[key] = current[key] ? `${current[key]}, ${value}` : value
		})
		vi.spyOn(prototype, "send").mockImplementation(function (this: XMLHttpRequest) {
			sentHeaders.push({ ...headers.get(this) })
		})
		window.eval(generateFetchInterceptorScript())
		const xhr = new XMLHttpRequest()
		xhr.open("POST", "./data.json", true, "user", "password")
		xhr.setRequestHeader("X-Fixture", "one")
		xhr.setRequestHeader("X-Fixture", "two")
		xhr.send("body")
		const concurrent = new XMLHttpRequest()
		concurrent.open("GET", "./data.json")
		concurrent.setRequestHeader("X-Fixture", "concurrent")
		concurrent.send()
		respond(0)
		await vi.advanceTimersByTimeAsync(0)
		expect(sentHeaders).toEqual([{ "X-Fixture": "one, two" }, { "X-Fixture": "concurrent" }])
		expect(open).toHaveBeenCalledWith(
			"POST",
			"https://download.example.test/resource.json",
			true,
			"user",
			"password",
		)
		const cached = new XMLHttpRequest()
		cached.open("GET", "./data.json")
		cached.setRequestHeader("X-Fixture", "cached")
		cached.send()
		await vi.advanceTimersByTimeAsync(0)
		expect(sentHeaders[2]).toEqual({ "X-Fixture": "cached" })
		expect(requests).toHaveLength(1)
	})

	it("does not resurrect an aborted XHR when URL resolution finishes", async () => {
		const send = vi.spyOn(prototype, "send").mockImplementation(() => undefined)
		window.eval(generateFetchInterceptorScript())
		const xhr = new XMLHttpRequest()
		xhr.open("GET", "./data.json")
		const onabort = vi.fn()
		const abortListener = vi.fn()
		const onloadend = vi.fn()
		xhr.onabort = onabort
		xhr.onloadend = onloadend
		xhr.addEventListener("abort", abortListener)
		expect(xhr.send()).toBeUndefined()
		xhr.abort()
		xhr.abort()
		respond(0)
		await vi.advanceTimersByTimeAsync(0)
		expect(send).not.toHaveBeenCalled()
		expect(onabort).toHaveBeenCalledTimes(1)
		expect(abortListener).toHaveBeenCalledTimes(1)
		expect(onloadend).toHaveBeenCalledTimes(1)
	})

	it("does not send an older relative request after the XHR is reopened", async () => {
		const send = vi.spyOn(prototype, "send").mockImplementation(() => undefined)
		window.eval(generateFetchInterceptorScript())
		const xhr = new XMLHttpRequest()
		xhr.open("GET", "./old.json")
		xhr.send()
		xhr.open("POST", "https://api.example.test/current")
		xhr.send("current")
		respond(0)
		await vi.advanceTimersByTimeAsync(0)
		expect(send).toHaveBeenCalledExactlyOnceWith("current")
		expect(requests).toHaveLength(1)
	})

	it("does not deliver a synthetic failure after XHR cancellation", async () => {
		window.eval(generateFetchInterceptorScript())
		const xhr = new XMLHttpRequest()
		const onload = vi.fn()
		xhr.onload = onload
		xhr.open("GET", "./missing.json")
		xhr.send()
		xhr.abort()
		const stateAfterAbort = xhr.readyState
		respond(0, false)
		await vi.advanceTimersByTimeAsync(0)
		expect(onload).not.toHaveBeenCalled()
		expect(xhr.readyState).toBe(stateAfterAbort)
		expect(xhr.status).toBe(0)
	})

	it("preserves an explicit same-directory absolute Request instead of guessing its origin", async () => {
		window.eval(generateFetchInterceptorScript())
		const request = new Request(new URL("./data.json", document.baseURI))
		await window.fetch(request)
		expect(fetchSpy).toHaveBeenCalledExactlyOnceWith(request, undefined)
		expect(requests).toEqual([])
	})

	it("throws invalid-state errors synchronously before open and on duplicate send", async () => {
		vi.spyOn(prototype, "send").mockImplementation(function (this: XMLHttpRequest) {
			if (this.readyState !== 1) throw new DOMException("not opened", "InvalidStateError")
		})
		window.eval(generateFetchInterceptorScript())
		const xhr = new XMLHttpRequest()
		expect(() => xhr.send()).toThrowError(
			expect.objectContaining({ name: "InvalidStateError" }),
		)
		xhr.open("GET", "./data.json")
		expect(xhr.send()).toBeUndefined()
		expect(() => xhr.send()).toThrowError(
			expect.objectContaining({ name: "InvalidStateError" }),
		)
		expect(() => xhr.setRequestHeader("X-Late", "not allowed")).toThrowError(
			expect.objectContaining({ name: "InvalidStateError" }),
		)
		respond(0)
		await vi.advanceTimersByTimeAsync(0)
	})

	it("preserves synchronous native send failures for absolute and cached URLs", async () => {
		const failure = new DOMException("native failure", "InvalidStateError")
		const send = vi.spyOn(prototype, "send").mockImplementation(() => {
			throw failure
		})
		window.eval(generateFetchInterceptorScript())
		const absolute = new XMLHttpRequest()
		absolute.open("GET", "https://api.example.test/data")
		expect(() => absolute.send()).toThrow(
			expect.objectContaining({ name: failure.name, message: failure.message }),
		)
		const fetchResult = window.fetch("./data.json")
		respond(0)
		await fetchResult
		const cached = new XMLHttpRequest()
		cached.open("GET", "./data.json")
		expect(() => cached.send()).toThrow(
			expect.objectContaining({ name: failure.name, message: failure.message }),
		)
		expect(send).toHaveBeenCalledTimes(2)
	})

	it("leaves native abort event delivery to XHR once sending starts", async () => {
		vi.spyOn(prototype, "send").mockImplementation(() => undefined)
		vi.spyOn(prototype, "abort").mockImplementation(function (this: XMLHttpRequest) {
			this.dispatchEvent(new ProgressEvent("abort"))
			this.dispatchEvent(new ProgressEvent("loadend"))
		})
		window.eval(generateFetchInterceptorScript())
		const xhr = new XMLHttpRequest()
		xhr.open("GET", "./data.json")
		xhr.send()
		respond(0)
		await vi.advanceTimersByTimeAsync(0)
		const onabort = vi.fn()
		const onloadend = vi.fn()
		xhr.onabort = onabort
		xhr.onloadend = onloadend
		xhr.abort()
		expect(onabort).toHaveBeenCalledTimes(1)
		expect(onloadend).toHaveBeenCalledTimes(1)
	})

	it.each(["abort", "reopen"] as const)(
		"does not send stale headers/body after native open reenters with %s",
		async (action) => {
			vi.spyOn(prototype, "open").mockImplementation(function (
				this: XMLHttpRequest,
				_method,
				url,
			) {
				Object.defineProperty(this, "readyState", { configurable: true, value: 1 })
				if (String(url).includes("download.example.test"))
					this.dispatchEvent(new Event("readystatechange"))
			})
			const setHeader = vi
				.spyOn(prototype, "setRequestHeader")
				.mockImplementation(() => undefined)
			const send = vi.spyOn(prototype, "send").mockImplementation(() => undefined)
			window.eval(generateFetchInterceptorScript())
			const xhr = new XMLHttpRequest()
			xhr.open("POST", "./data.json")
			xhr.setRequestHeader("X-Stale", "old header")
			xhr.onreadystatechange = () => {
				if (action === "abort") xhr.abort()
				else xhr.open("GET", "https://api.example.test/reopened")
			}
			xhr.send("old body")
			respond(0)
			await vi.advanceTimersByTimeAsync(0)
			expect(send).not.toHaveBeenCalled()
			expect(setHeader).toHaveBeenCalledTimes(1)
		},
	)
	it.each([false, true])(
		"lookup failure dispatches events and allows reuse (abort first: %s)",
		async (abortFirst) => {
			const send = vi.spyOn(prototype, "send").mockImplementation(() => undefined)
			window.eval(generateFetchInterceptorScript())
			const xhr = new XMLHttpRequest()
			xhr.open("GET", "./missing.json")
			const events: string[] = []
			const onload = vi.fn()
			xhr.onload = onload
			for (const type of ["readystatechange", "load", "loadend"])
				xhr.addEventListener(type, () => events.push(type))
			xhr.send()
			respond(0, false)
			await vi.advanceTimersByTimeAsync(0)
			expect(events).toEqual(["readystatechange", "load", "loadend"])
			expect(onload).toHaveBeenCalledOnce()
			expect(xhr.status).toBe(404)
			expect(xhr.readyState).toBe(4)
			if (abortFirst) xhr.abort()
			xhr.open("GET", "./working.json")
			expect(xhr.readyState).toBe(1)
			expect(xhr.status).toBe(0)
			for (const name of ["status", "statusText", "responseText", "response", "readyState"])
				expect(Object.hasOwn(xhr, name)).toBe(false)
			expect(xhr.send()).toBeUndefined()
			respond(1)
			await vi.advanceTimersByTimeAsync(0)
			expect(send).toHaveBeenCalledOnce()
		},
	)

	it("preserves application response overrides when clearing its synthetic failure", async () => {
		window.eval(generateFetchInterceptorScript())
		const xhr = new XMLHttpRequest()
		xhr.open("GET", "./missing.json")
		Object.defineProperty(xhr, "statusText", { value: "app-owned", configurable: true })
		xhr.send()
		respond(0, false)
		await vi.advanceTimersByTimeAsync(0)
		Object.defineProperty(xhr, "response", { value: "later override", configurable: true })
		xhr.open("GET", "./working.json")
		expect(xhr.statusText).toBe("app-owned")
		expect(xhr.response).toBe("later override")
		expect(xhr.status).toBe(0)
	})
})
