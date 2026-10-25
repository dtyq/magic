import { afterEach, describe, expect, it, vi } from "vitest"
import { createBrowserClient, type BrowserSendEvent } from "@apmplus/web"
import { createVolcengineSettings } from "../settings"
import { plugin } from "../plugins/HttpMonitor"
import { annotateHttp } from "../http-monitor"

describe("installed APMPlus SDK sampling", () => {
	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})
	it("samples HTTP once at 50%, preserves one event for slow errors, and emits no custom duplicates", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(null, { status: 500 })),
		)
		const sdk = createBrowserClient()
		const sent: BrowserSendEvent[] = []
		const settings = createVolcengineSettings({ type: "Volcengine", appId: 123, token: "test" })
		sdk.init({
			...settings.sdk,
			aid: 123,
			token: "test",
			plugins: {
				ajax: false,
				fetch: false,
				resource: false,
				resourceError: false,
				pageview: false,
				jsError: false,
				breadcrumb: false,
				performance: false,
				tti: false,
				fmp: false,
				blankScreen: false,
			},
			integrations: [plugin(settings.http)],
			transport: { get: vi.fn(), post: vi.fn() },
		})
		sdk.on("report", (event) => {
			if (event.ev_type === "http") annotateHttp(event.payload)
			return event
		})
		sdk.on("send", (event) => {
			sent.push(event)
		})
		sdk.start()
		try {
			const random = vi.spyOn(Math, "random").mockReturnValue(0.49)
			vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValue(1000)
			await window.fetch("https://api.test/data")
			await vi.waitFor(() => expect(sent).toHaveLength(1))
			expect(sent[0]).toMatchObject({
				ev_type: "http",
				common: { sample_rate: 0.5 },
				payload: { extra: { is_slow: "true", is_http_error: "true" } },
			})
			random.mockReturnValue(0.51)
			await window.fetch("https://api.test/unsampled")
			await Promise.resolve()
			expect(sent).toHaveLength(1)
			expect(settings.sdk.useLocalConfig).toBe(true)
		} finally {
			sdk.destroy()
		}
	})
})
