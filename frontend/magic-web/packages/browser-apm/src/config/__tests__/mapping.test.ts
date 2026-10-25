import { describe, expect, it } from "vitest"
import { resolveBrowserApmConfig } from "../runtime"
import { validateTelemetry, type TelemetryConfig } from "../telemetry"
import type { IProviderConfig } from "../../core/types"
import { createVolcengineSettings } from "../../providers/volcengine/settings"
import { createAliyunSettings } from "../../providers/aliyun/settings"
import { createDataFluxSettings } from "../../providers/dataflux/settings"

const connection = { appId: "123", token: "test" }

describe("provider-neutral configuration", () => {
	it("excludes application reporting URLs across adapters without interpreting their payloads", () => {
		const telemetry = { http: { ignoreUrls: [/\/log-report(?:[/?#]|$)/g] } }
		const aliyun = createAliyunSettings({ ...connection, type: "Aliyun", telemetry })
		const dataflux = createDataFluxSettings({
			...connection,
			type: "DataFlux",
			endpoint: "https://rum.test",
			telemetry,
		})
		const filter = aliyun.filters.resource.at(-1)
		for (let i = 0; i < 2; i++) {
			expect(filter?.("https://app.test/log-report")).toBe(true)
			expect(
				dataflux.beforeSend({
					type: "resource",
					resource: { url: "https://app.test/log-report" },
				}),
			).toBe(false)
		}
		expect(filter?.("https://app.test/api")).toBe(false)
		expect(
			dataflux.beforeSend({ type: "resource", resource: { url: "https://app.test/api" } }),
		).toBe(true)
	})
	it("keeps DataFlux runtime exceptions but excludes active logs and business interactions", () => {
		const settings = createDataFluxSettings({
			...connection,
			type: "DataFlux",
			endpoint: "https://rum.test",
		})
		expect(settings.beforeSend({ type: "error", error: { source: "source" } })).toBe(true)
		expect(settings.beforeSend({ type: "error", error: { source: "console" } })).toBe(false)
		expect(settings.beforeSend({ type: "error", error: { source: "custom" } })).toBe(false)
		expect(settings.beforeSend({ type: "action" })).toBe(false)
	})
	it("maps the common event policy without inheriting legacy sampling multipliers or allowlists", () => {
		const { sdk, http, errorWindowMs, enableError } = createVolcengineSettings({
			...connection,
			type: "Volcengine",
			endpoint: "https://apm.test",
			extra: {
				sampleRate: 0.2,
				useLocalConfig: false,
				sample: {
					include_users: ["always"],
					rules: {
						http: { enable: false, sample_rate: 0.1, conditional_sample_rules: [] },
					},
				},
			},
			telemetry: {
				remoteConfig: false,
				sampling: { unit: "event", events: { http: 0.5, resource: 0.1, error: 1 } },
				capture: { http: false, resources: false, errors: false },
				http: { slowThresholdMs: 1000, ignoreUrls: ["/skip"] },
				errors: { dedupeWindowMs: 5000 },
			},
		})
		expect(sdk).toMatchObject({
			domain: "https://apm.test",
			useLocalConfig: true,
			plugins: { fetch: false, ajax: false, resource: false },
		})
		expect(sdk.sample).toMatchObject({
			sample_rate: 1,
			include_users: [],
			rules: { http: { enable: true, sample_rate: 0.5 }, js_error: { sample_rate: 1 } },
		})
		expect(http).toMatchObject({
			enabled: false,
			slowApiThreshold: 1000,
			excludeUrls: ["/skip"],
		})
		expect(errorWindowMs).toBe(5000)
		expect(enableError).toBe(false)
	})

	it("maps the same session ratio to all three SDKs with no additional event multiplier", () => {
		const telemetry: TelemetryConfig = {
			sampling: { unit: "session", rate: 0.5 },
			remoteConfig: false,
		}
		expect(
			createVolcengineSettings({ ...connection, type: "Volcengine", telemetry }).sdk.sample,
		).toMatchObject({ sample_granularity: "session", sample_rate: 0.5, rules: {} })
		expect(
			createVolcengineSettings({ ...connection, type: "Volcengine", telemetry }).sdk.sample
				?.rules,
		).toEqual({})
		expect(createAliyunSettings({ ...connection, type: "Aliyun", telemetry })).toMatchObject({
			sessionConfig: { sampleRate: 0.5 },
			remoteConfig: false,
		})
		expect(
			createDataFluxSettings({
				...connection,
				type: "DataFlux",
				endpoint: "https://rum.test",
				telemetry,
			}),
		).toMatchObject({
			sessionSampleRate: 50,
			remoteConfiguration: false,
			site: "https://rum.test",
		})
	})

	it("maps ARMS collector names and gives common switches priority", () => {
		expect(
			createAliyunSettings({
				...connection,
				type: "Aliyun",
				extra: { collectors: { api: true } },
				telemetry: {
					capture: {
						http: false,
						resources: false,
						errors: false,
						performance: false,
					},
				},
			}).collectors,
		).toEqual({
			api: false,
			staticResource: false,
			jsError: false,
			consoleError: false,
			perf: false,
			webVitals: false,
			longtask: false,
			action: false,
		})
	})

	it("does not disable resources when only common performance capture is disabled", () => {
		const settings = createVolcengineSettings({
			...connection,
			type: "Volcengine",
			telemetry: { capture: { performance: false, resources: true } },
		})
		expect(settings.enablePerformance).toBe(false)
		expect(settings.sdk.plugins?.resource).toBe(true)
	})

	it("rejects unsupported policies instead of silently substituting session sampling", () => {
		const telemetry: TelemetryConfig = { sampling: { unit: "event", events: { http: 0.5 } } }
		expect(() => createAliyunSettings({ ...connection, type: "Aliyun", telemetry })).toThrow(
			"event sampling",
		)
		expect(() =>
			createDataFluxSettings({
				...connection,
				type: "DataFlux",
				endpoint: "https://rum.test",
				telemetry,
			}),
		).toThrow("event sampling")
		expect(() =>
			createDataFluxSettings({
				...connection,
				type: "DataFlux",
				endpoint: "https://rum.test",
				telemetry: { capture: { http: false } },
			}),
		).toThrow("capture.http")
		expect(() =>
			createAliyunSettings({
				...connection,
				type: "Aliyun",
				telemetry: { http: { slowThresholdMs: 1000 } },
			}),
		).toThrow("http.slowThresholdMs")
	})

	it.each([-1, 1.1, NaN, Infinity])("rejects invalid sampling ratio %s", (rate) => {
		expect(() => validateTelemetry({ sampling: { unit: "event", rate } })).toThrow("ratios")
	})
	it("rejects invalid thresholds and event rates combined with session sampling", () => {
		expect(() => validateTelemetry({ http: { slowThresholdMs: -1 } })).toThrow("milliseconds")
		expect(() =>
			validateTelemetry({ sampling: { unit: "session", events: { http: 0.5 } } }),
		).toThrow("event rates")
	})
})

describe("runtime configuration compatibility", () => {
	it("keeps modern runtime JSON free of SDK fields", () => {
		const input = {
			provider: { ...connection, type: "Volcengine" },
			telemetry: { sampling: { unit: "event", events: { http: 0.5 } } },
		}
		const resolved = resolveBrowserApmConfig(JSON.stringify(input))
		expect(resolved.provider).toEqual({ ...input.provider, enabled: true })
		expect(resolved.telemetry).toEqual(input.telemetry)
	})
	it("preserves legacy options and gives top-level options precedence over extra", () => {
		const resolved = resolveBrowserApmConfig({
			strategy: "Volcengine",
			options: {
				...connection,
				sampleRate: 0.3,
				extra: { sampleRate: 0.1, plugins: { fetch: false } },
			},
		})
		const settings = createVolcengineSettings({ ...resolved.provider, type: "Volcengine" })
		expect(settings.sdk.sample?.sample_rate).toBe(0.3)
		expect(settings.http.enabled).toBe(false)
		expect((resolved.provider as IProviderConfig).extra?.extra).toBeUndefined()
	})
	it("retains legacy DataFlux site while disabling replay and applying common sampling", () => {
		const resolved = resolveBrowserApmConfig({
			strategy: "DataFlux",
			options: {
				...connection,
				extra: {
					site: "https://old.test",
					sessionSampleRate: 20,
					sessionReplaySampleRate: 70,
				},
			},
			telemetry: { sampling: { unit: "session", rate: 0.5 } },
		})
		expect(
			createDataFluxSettings({
				...resolved.provider,
				type: "DataFlux",
				telemetry: resolved.telemetry,
			}),
		).toMatchObject({
			site: "https://old.test",
			sessionSampleRate: 50,
			sessionReplaySampleRate: 0,
		})
	})
})
