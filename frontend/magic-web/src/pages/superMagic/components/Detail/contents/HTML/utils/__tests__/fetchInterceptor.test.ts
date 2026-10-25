import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: vi.fn(),
}))

vi.mock("@/utils/env", () => ({
	env: vi.fn(() => "https://cdn.example.test"),
}))

vi.mock("@/utils/packageAsset", () => ({
	getPackageAssetUrl: () => "https://cdn.example.test",
}))

vi.mock("../index", () => ({
	rewriteHtmlCdnWithHost: (content: string) =>
		new DOMParser().parseFromString(content, "text/html"),
}))

import {
	createKeyboardMessageHandler,
	generateFetchInterceptorScript,
	KEYBOARD_MESSAGE_TYPES,
} from "../fetchInterceptor"

describe("generateFetchInterceptorScript", () => {
	let originalFetch: typeof window.fetch
	let originalXhrOpen: typeof XMLHttpRequest.prototype.open
	let originalXhrSend: typeof XMLHttpRequest.prototype.send
	let originalXhrAbort: typeof XMLHttpRequest.prototype.abort
	let originalXhrSetRequestHeader: typeof XMLHttpRequest.prototype.setRequestHeader

	beforeEach(() => {
		originalFetch = window.fetch
		originalXhrOpen = XMLHttpRequest.prototype.open
		originalXhrSend = XMLHttpRequest.prototype.send
		originalXhrAbort = XMLHttpRequest.prototype.abort
		originalXhrSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader
	})

	afterEach(() => {
		window.fetch = originalFetch
		XMLHttpRequest.prototype.open = originalXhrOpen
		XMLHttpRequest.prototype.send = originalXhrSend
		XMLHttpRequest.prototype.abort = originalXhrAbort
		XMLHttpRequest.prototype.setRequestHeader = originalXhrSetRequestHeader
		vi.restoreAllMocks()
	})

	it("preserves a Request input when forwarding an external PUT request", async () => {
		const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }))
		window.fetch = fetchSpy as typeof window.fetch

		window.eval(generateFetchInterceptorScript())

		const request = new Request("https://api.example.test/items/1", {
			method: "PUT",
			headers: {
				Authorization: "Bearer token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: "updated" }),
		})

		await window.fetch(request)

		expect(fetchSpy).toHaveBeenCalledOnce()
		const [forwardedInput, forwardedInit] = fetchSpy.mock.calls[0]
		expect(forwardedInput).toBe(request)
		expect(forwardedInit).toBeUndefined()
		expect((forwardedInput as Request).method).toBe("PUT")
		expect((forwardedInput as Request).headers.get("Authorization")).toBe("Bearer token")
		expect(await (forwardedInput as Request).clone().text()).toBe(
			JSON.stringify({ name: "updated" }),
		)
	})

	it("preserves PUT init when resolving a relative URL", async () => {
		const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }))
		window.fetch = fetchSpy as typeof window.fetch
		vi.spyOn(window, "postMessage").mockImplementation((message) => {
			if (message.type !== "MAGIC_FETCH_URL_REQUEST") return
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "MAGIC_FETCH_URL_RESPONSE",
						requestId: message.requestId,
						success: true,
						url: "https://download.example.test/items/1",
					},
				}),
			)
		})

		window.eval(generateFetchInterceptorScript())

		const init: RequestInit = {
			method: "PUT",
			headers: { Authorization: "Bearer token" },
			body: JSON.stringify({ name: "updated" }),
		}
		await window.fetch("./items/1", init)

		expect(fetchSpy).toHaveBeenCalledWith("https://download.example.test/items/1", init)
	})

	it("requests a fresh URL after a cached signed URL expires", async () => {
		const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }))
		window.fetch = fetchSpy as typeof window.fetch
		let requestCount = 0
		vi.spyOn(window, "postMessage").mockImplementation((message) => {
			if (message.type !== "MAGIC_FETCH_URL_REQUEST") return
			requestCount += 1
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "MAGIC_FETCH_URL_RESPONSE",
						requestId: message.requestId,
						success: true,
						url: `https://download.example.test/items/${requestCount}`,
						expires_at:
							requestCount === 1 ? "2000-01-01 00:00:00" : "2099-01-01 00:00:00",
					},
				}),
			)
		})

		window.eval(generateFetchInterceptorScript())
		await window.fetch("./items/1")
		await window.fetch("./items/1")

		expect(requestCount).toBe(2)
		expect(fetchSpy).toHaveBeenNthCalledWith(
			1,
			"https://download.example.test/items/1",
			undefined,
		)
		expect(fetchSpy).toHaveBeenNthCalledWith(
			2,
			"https://download.example.test/items/2",
			undefined,
		)
	})

	it("does not reuse a cached URL when expires_at is missing", async () => {
		const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }))
		window.fetch = fetchSpy as typeof window.fetch
		let requestCount = 0
		vi.spyOn(window, "postMessage").mockImplementation((message) => {
			if (message.type !== "MAGIC_FETCH_URL_REQUEST") return
			requestCount += 1
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "MAGIC_FETCH_URL_RESPONSE",
						requestId: message.requestId,
						success: true,
						url: `https://download.example.test/items/${requestCount}`,
					},
				}),
			)
		})

		window.eval(generateFetchInterceptorScript())
		await window.fetch("./items/1")
		await window.fetch("./items/1")

		expect(requestCount).toBe(2)
		expect(fetchSpy).toHaveBeenNthCalledWith(
			2,
			"https://download.example.test/items/2",
			undefined,
		)
	})
})

describe("createKeyboardMessageHandler", () => {
	it("lets a local Escape consumer close its panel before canceling edit mode", () => {
		const onCancel = vi.fn()
		const onEscape = vi.fn(() => true)
		const handler = createKeyboardMessageHandler({
			onSave: vi.fn(),
			onSaveAndExit: vi.fn(),
			onCancel,
			onEscape,
		})

		handler(
			new MessageEvent("message", {
				data: {
					type: KEYBOARD_MESSAGE_TYPES.CANCEL,
					source: KEYBOARD_MESSAGE_TYPES.SOURCE,
				},
			}),
		)

		expect(onEscape).toHaveBeenCalledOnce()
		expect(onCancel).not.toHaveBeenCalled()
	})

	it("cancels edit mode when Escape is not consumed", () => {
		const onCancel = vi.fn()
		const handler = createKeyboardMessageHandler({
			onSave: vi.fn(),
			onSaveAndExit: vi.fn(),
			onCancel,
			onEscape: () => false,
		})

		handler(
			new MessageEvent("message", {
				data: {
					type: KEYBOARD_MESSAGE_TYPES.CANCEL,
					source: KEYBOARD_MESSAGE_TYPES.SOURCE,
				},
			}),
		)

		expect(onCancel).toHaveBeenCalledOnce()
	})
})
