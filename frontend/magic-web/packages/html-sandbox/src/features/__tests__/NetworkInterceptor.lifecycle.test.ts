import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NetworkInterceptor } from "../NetworkInterceptor"

describe("NetworkInterceptor native delegation", () => {
	let interceptor: NetworkInterceptor
	const nativeFetch = window.fetch

	beforeEach(() => {
		interceptor = new NetworkInterceptor()
		window.fetch = vi.fn(async () => new Response("ok"))
	})

	afterEach(() => {
		interceptor.disable()
		vi.restoreAllMocks()
		window.fetch = nativeFetch
	})

	it("forwards unchanged Request/init and keeps both request and response bodies readable", async () => {
		const response = new Response("response content", { headers: { "x-response": "yes" } })
		const fetch = vi.fn(function (this: Window) {
			expect(this).toBe(window)
			return Promise.resolve(response)
		})
		window.fetch = fetch
		interceptor.enable()
		const request = new Request("https://api.example.com/data", {
			method: "POST",
			body: "original",
			headers: { "x-original": "one" },
		})
		const init: RequestInit = {
			method: "PATCH",
			body: "override",
			headers: [["x-override", "two"]],
			signal: new AbortController().signal,
			credentials: "include",
		}
		expect(await window.fetch(request, init)).toBe(response)
		expect(fetch).toHaveBeenCalledExactlyOnceWith(request, init)
		expect(await response.text()).toBe("response content")
		expect(await request.text()).toBe("original")
		expect(interceptor.getEntries()[0]).toMatchObject({
			method: "PATCH",
			requestBody: "override",
			requestHeaders: { "x-override": "two" },
			responseBody: "response content",
			responseHeaders: { "x-response": "yes" },
		})
	})

	it("records concurrent fetch completion independently and preserves rejection identity", async () => {
		let resolveFirst!: (response: Response) => void
		let rejectSecond!: (error: Error) => void
		window.fetch = vi
			.fn()
			.mockImplementationOnce(
				() =>
					new Promise<Response>((resolve) => {
						resolveFirst = resolve
					}),
			)
			.mockImplementationOnce(
				() =>
					new Promise<Response>((_, reject) => {
						rejectSecond = reject
					}),
			)
		interceptor.enable()
		const first = window.fetch("https://api.example.com/first", {
			body: "first",
			method: "POST",
		})
		const second = window.fetch("https://api.example.com/second")
		const error = new TypeError("offline")
		const rejection = expect(second).rejects.toBe(error)
		rejectSecond(error)
		await rejection
		resolveFirst(new Response("first result"))
		await first
		expect(interceptor.getEntries()).toMatchObject([
			{
				url: "https://api.example.com/second",
				status: 0,
				error: "offline",
				requestBody: null,
			},
			{
				url: "https://api.example.com/first",
				status: 200,
				requestBody: "first",
				responseBody: "first result",
			},
		])
	})

	it("keeps successful responses usable when cloned body reading fails", async () => {
		const response = new Response("original")
		const unreadable = new Response("clone")
		vi.spyOn(unreadable, "text").mockRejectedValue(new Error("body unavailable"))
		vi.spyOn(response, "clone").mockReturnValue(unreadable)
		window.fetch = vi.fn().mockResolvedValue(response)
		interceptor.enable()
		expect(await window.fetch(new URL("https://api.example.com/data"))).toBe(response)
		expect(interceptor.getEntries()[0]).toMatchObject({
			status: 200,
			responseBody: "[Failed to read response body]",
		})
		expect(await response.text()).toBe("original")
	})

	it("truncates captured bodies without truncating the response returned to the application", async () => {
		const body = "x".repeat(10_241)
		window.fetch = vi.fn(async () => new Response(body))
		interceptor.enable()
		const response = await window.fetch("https://api.example.com/data", {
			method: "POST",
			body,
		})
		const truncated = `${body.slice(0, 10_240)}... [truncated, total 10241 bytes]`
		expect(interceptor.getEntries()[0]).toMatchObject({
			requestBody: truncated,
			responseBody: truncated,
		})
		expect(await response.text()).toBe(body)
	})

	it("delegates XHR methods with their receiver/options and records loadend only once", () => {
		const open = vi.spyOn(XMLHttpRequest.prototype, "open").mockImplementation(() => undefined)
		const send = vi.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(() => undefined)
		const header = vi
			.spyOn(XMLHttpRequest.prototype, "setRequestHeader")
			.mockImplementation(() => undefined)
		const headers = vi
			.spyOn(XMLHttpRequest.prototype, "getAllResponseHeaders")
			.mockReturnValue("Content-Type: text/plain\r\nX-Value: a:b\r\n")
		interceptor.enable()
		const xhr = new XMLHttpRequest()
		const url = new URL("https://api.example.com/xhr")
		xhr.open("post", url, false, "user", "password")
		xhr.setRequestHeader("X-Request", "one")
		xhr.send("payload")
		expect(open).toHaveBeenCalledExactlyOnceWith("post", url, false, "user", "password")
		expect(open.mock.contexts[0]).toBe(xhr)
		expect(send).toHaveBeenCalledExactlyOnceWith("payload")
		expect(send.mock.contexts[0]).toBe(xhr)
		expect(header).toHaveBeenCalledExactlyOnceWith("X-Request", "one")
		expect(header.mock.contexts[0]).toBe(xhr)
		Object.defineProperties(xhr, {
			status: { value: 201 },
			statusText: { value: "Created" },
			response: { value: "created" },
		})
		xhr.dispatchEvent(new Event("loadend"))
		xhr.dispatchEvent(new Event("loadend"))
		expect(headers.mock.contexts[0]).toBe(xhr)
		expect(interceptor.getEntries()).toHaveLength(1)
		expect(interceptor.getEntries()[0]).toMatchObject({
			method: "POST",
			url: url.href,
			status: 201,
			statusText: "Created",
			requestBody: "payload",
			requestHeaders: { "X-Request": "one" },
			responseBody: "created",
			responseHeaders: { "content-type": "text/plain", "x-value": "a:b" },
		})
		interceptor.disable()
		expect(XMLHttpRequest.prototype.open).toBe(open)
		expect(XMLHttpRequest.prototype.send).toBe(send)
	})

	it("isolates concurrent XHR metadata, including failed and unreadable responses", () => {
		vi.spyOn(XMLHttpRequest.prototype, "open").mockImplementation(() => undefined)
		vi.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(() => undefined)
		vi.spyOn(XMLHttpRequest.prototype, "setRequestHeader").mockImplementation(() => undefined)
		vi.spyOn(XMLHttpRequest.prototype, "getAllResponseHeaders").mockImplementation(() => {
			throw new Error("denied")
		})
		interceptor.enable()
		const first = new XMLHttpRequest()
		const second = new XMLHttpRequest()
		first.open("PUT", "/first")
		first.setRequestHeader("First", "1")
		first.send("first body")
		second.open("DELETE", "/second")
		second.send()
		Object.defineProperties(first, {
			status: { value: 200 },
			response: { value: {} },
			responseText: {
				get() {
					throw new DOMException("Invalid state", "InvalidStateError")
				},
			},
		})
		second.dispatchEvent(new Event("loadend"))
		first.dispatchEvent(new Event("loadend"))
		expect(interceptor.getEntries()).toMatchObject([
			{
				method: "DELETE",
				url: "/second",
				requestHeaders: {},
				status: 0,
				error: "Network error",
			},
			{
				method: "PUT",
				url: "/first",
				requestHeaders: { First: "1" },
				status: 200,
				requestBody: "first body",
				responseBody: "[Failed to read response body]",
			},
		])
	})
})
