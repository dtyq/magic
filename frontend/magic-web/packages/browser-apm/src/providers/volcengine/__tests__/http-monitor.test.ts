import { describe, expect, it } from "vitest"
import type { HttpPayload } from "@apmplus/web"
import { annotateHttp, isIgnoredUrl } from "../http-monitor"
import { createVolcengineSettings } from "../settings"

const config = {
	type: "Volcengine" as const,
	appId: 123,
	token: "test",
}
describe("HTTP technical classification", () => {
	it.each([200, 201, 204, 304])("does not flag HTTP %s as failure", (status) => {
		const http = { duration: 999, response: { status } } as HttpPayload
		expect(annotateHttp(http).extra).toMatchObject({ is_slow: "false", is_http_error: "false" })
	})
	it("adds slow and error attributes to the same payload at 1000ms", () => {
		const http = { duration: 1000, response: { status: 500 } } as HttpPayload
		expect(annotateHttp(http)).toBe(http)
		expect(http.extra).toMatchObject({
			is_slow: "true",
			is_http_error: "true",
			slow_threshold: "1000",
		})
		http.response.headers = { "content-type": "text/event-stream" }
		expect(annotateHttp(http).extra?.is_slow).toBe("false")
	})
	it("always excludes telemetry endpoints", () => {
		for (const path of ["/monitor_web/collect", "/settings/get/webpro"])
			expect(isIgnoredUrl(path)).toBe(true)
		expect(isIgnoredUrl("/api/log-reporting")).toBe(false)
	})
	it("defaults to event-based 50% HTTP and 10% resource/custom sampling", () => {
		const { sdk } = createVolcengineSettings(config)
		expect(sdk.useLocalConfig).toBe(true)
		expect(sdk.sample).toMatchObject({
			sample_rate: 1,
			sample_granularity: "event",
			rules: {
				http: { sample_rate: 0.5 },
				resource: { sample_rate: 0.1 },
				js_error: { sample_rate: 1 },
			},
		})
	})
	it("honors runtime sampling, plugin switches and legacy sampleRate", () => {
		const { sdk, http } = createVolcengineSettings({
			...config,
			extra: {
				sampleRate: 0.2,
				useLocalConfig: false,
				plugins: { fetch: false, resource: false },
				sample: {
					rules: {
						http: { enable: true, sample_rate: 0.3, conditional_sample_rules: [] },
					},
				},
			},
		})
		expect(sdk.sample?.sample_rate).toBe(0.2)
		expect(sdk.sample?.rules.http.sample_rate).toBe(0.3)
		expect(sdk.useLocalConfig).toBe(false)
		expect(sdk.plugins?.resource).toBe(false)
		expect(http.enabled).toBe(false)
	})
})
