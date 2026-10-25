import { createRequire } from "node:module"
import { describe, expect, it, vi } from "vitest"
import { createAliyunSettings } from "../../providers/aliyun/settings"

// Exercise the installed SDK's collector guards, not just our generated option object.
const require = createRequire(import.meta.url)
const ApiCollector = require("@arms/rum-browser/lib/collector/resource/api")
	.default as typeof import("@arms/rum-browser/lib/collector/resource/api").default
const ExceptionCollector = require("@arms/rum-browser/lib/collector/exception")
	.default as typeof import("@arms/rum-browser/lib/collector/exception").default

describe("ARMS SDK consumes common capture switches", () => {
	it.each([false, true])(
		"HTTP capture enabled=%s controls actual transport instrumentation",
		(enabled) => {
			const settings = createAliyunSettings({
				type: "Aliyun",
				appId: "test",
				token: "test",
				telemetry: { capture: { http: enabled } },
			})
			const collector = new ApiCollector()
			const fetch = vi.spyOn(collector, "hackFetch").mockImplementation(vi.fn())
			const xhr = vi.spyOn(collector, "hackXhr").mockImplementation(vi.fn())
			vi.spyOn(collector, "perfObserver").mockImplementation(vi.fn())
			collector.setup(
				{ getConfig: () => settings } as unknown as Parameters<typeof collector.setup>[0],
				vi.fn(),
			)
			expect(fetch).toHaveBeenCalledTimes(enabled ? 1 : 0)
			expect(xhr).toHaveBeenCalledTimes(enabled ? 1 : 0)
		},
	)
	it("disabling errors installs neither global listeners nor console interception", () => {
		const settings = createAliyunSettings({
			type: "Aliyun",
			appId: "test",
			token: "test",
			telemetry: { capture: { errors: false } },
		})
		const collector = new ExceptionCollector()
		const addListener = vi.spyOn(window, "addEventListener")
		const originalError = console.error
		try {
			collector.setup(
				{ getConfig: () => settings } as unknown as Parameters<typeof collector.setup>[0],
				vi.fn(),
			)
			expect(addListener).not.toHaveBeenCalled()
			expect(console.error).toBe(originalError)
		} finally {
			addListener.mockRestore()
		}
	})
})
