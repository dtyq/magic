import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { BrowserClient, BrowserReportEvent } from "@apmplus/web"
import { plugin } from "../plugins/HttpMonitor"
import { annotateHttp } from "../http-monitor"

describe("single Fetch HTTP collector", () => {
	let events: BrowserReportEvent[]
	let integration: ReturnType<typeof plugin>
	let fetchMock: ReturnType<typeof vi.fn>
	let reportMock: ReturnType<typeof vi.fn>
	let start: () => void
	beforeEach(() => {
		events = []
		fetchMock = vi.fn()
		vi.stubGlobal("fetch", fetchMock)
		integration = plugin({ excludeUrls: [/\/log-report(?:[/?#]|$)/] })
		reportMock = vi.fn((event: BrowserReportEvent) => {
			if (event.ev_type === "http") annotateHttp(event.payload)
			events.push(event)
		})
		integration.setup({
			on: (_: string, callback: () => void) => {
				start = callback
			},
			off: vi.fn(),
			config: () => ({ pid: "request-page", viewId: "view-1" }),
			report: reportMock,
		} as unknown as BrowserClient)
		start()
	})
	afterEach(() => {
		integration.tearDown()
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	it.each([1000, "1000", 403, "arbitrary"])(
		"never reads a response body, including code %s",
		async (code) => {
			const response = Response.json({ code })
			const clone = vi.spyOn(response, "clone")
			fetchMock.mockResolvedValue(response)
			expect(await window.fetch("https://api.test/api/data")).toBe(response)
			await vi.waitFor(() => expect(events).toHaveLength(1))
			expect(events[0]).toMatchObject({
				ev_type: "http",
				payload: { response: { is_custom_error: false } },
			})
			expect(clone).not.toHaveBeenCalled()
			expect(await response.json()).toEqual({ code })
		},
	)
	it("reports one slow HTTP event without interpreting any business response code", async () => {
		vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValue(1000)
		fetchMock.mockResolvedValue(Response.json({ code: 403 }))
		await window.fetch("https://api.test/api/data")
		await vi.waitFor(() => expect(events).toHaveLength(1))
		expect(events[0]).toMatchObject({
			ev_type: "http",
			payload: {
				response: { is_custom_error: false },
				extra: { is_slow: "true" },
			},
		})
	})
	it("does not wrap twice on repeated starts and respects Request method overrides", async () => {
		const wrapper = window.fetch
		start()
		expect(window.fetch).toBe(wrapper)
		fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
		await window.fetch(new Request("https://api.test/api/data", { method: "POST" }), {
			method: "PUT",
		})
		await vi.waitFor(() => expect(events).toHaveLength(1))
		expect(events[0]).toMatchObject({
			payload: {
				request: { method: "put" },
				response: { status: 204 },
				extra: { is_http_error: "false" },
			},
		})
	})
	it("ignores AbortError but preserves real network failures and their rejection", async () => {
		const abort = new DOMException("cancelled", "AbortError")
		fetchMock.mockRejectedValueOnce(abort)
		await expect(window.fetch("https://api.test/api/data")).rejects.toBe(abort)
		expect(events).toHaveLength(0)
		const failure = new TypeError("Failed to fetch")
		fetchMock.mockRejectedValueOnce(failure)
		await expect(window.fetch("https://api.test/api/data")).rejects.toBe(failure)
		expect(events).toHaveLength(1)
	})
	it("ignores cancellation with a custom signal reason", async () => {
		const controller = new AbortController()
		controller.abort("navigation")
		fetchMock.mockRejectedValue("navigation")
		await expect(
			window.fetch("https://api.test/api/data", { signal: controller.signal }),
		).rejects.toBe("navigation")
		expect(events).toHaveLength(0)
	})
	it.each(["https://third.test/api/data", "https://api.test/api/stream"])(
		"does not clone third-party or SSE responses: %s",
		async (url) => {
			const response = new Response("data: x", {
				headers: {
					"content-type": url.includes("stream")
						? "text/event-stream"
						: "application/json",
				},
			})
			const clone = vi.spyOn(response, "clone")
			fetchMock.mockResolvedValue(response)
			await window.fetch(url)
			await vi.waitFor(() => expect(events).toHaveLength(1))
			expect(clone).not.toHaveBeenCalled()
		},
	)
	it("excludes telemetry requests and restores fetch on teardown", async () => {
		fetchMock.mockResolvedValue(new Response())
		await window.fetch("https://api.test/log-report")
		expect(events).toHaveLength(0)
		integration.tearDown()
		expect(window.fetch).toBe(fetchMock)
	})

	it("does not read declared oversized JSON", async () => {
		const response = new Response("{}", {
			headers: { "content-type": "application/json", "content-length": "1000000" },
		})
		const clone = vi.spyOn(response, "clone")
		fetchMock.mockResolvedValue(response)
		expect(await window.fetch("https://api.test/api/data")).toBe(response)
		await vi.waitFor(() => expect(events).toHaveLength(1))
		expect(clone).not.toHaveBeenCalled()
	})
	it("does not let reporter failures reject a successful fetch", async () => {
		reportMock.mockImplementation(() => {
			throw new Error("SDK unavailable")
		})
		const response = new Response(null, { status: 204 })
		fetchMock.mockResolvedValue(response)
		expect(await window.fetch("https://api.test/api/data")).toBe(response)
		await vi.waitFor(() => expect(reportMock).toHaveBeenCalledOnce())
	})
})
