import { afterEach, describe, expect, it, vi } from "vitest"
import { createBrowserApm } from "../browser-apm"
import type { BrowserApmConfig } from "../types"

const provider = vi.hoisted(() => ({
	init: vi.fn(),
	start: vi.fn(),
	stop: vi.fn(),
	updateContext: vi.fn(),
	dispose: vi.fn(),
}))
vi.mock("../../providers/volcengine", () => ({
	VolcengineProvider: class {
		init = provider.init
		start = provider.start
		stop = provider.stop
		updateContext = provider.updateContext
		dispose = provider.dispose
	},
}))
const config: BrowserApmConfig = { provider: { type: "Volcengine", appId: "test", token: "test" } }
afterEach(() => vi.resetAllMocks())

describe("passive APM lifecycle", () => {
	it("shares concurrent initialization and applies the latest context before start", async () => {
		let release!: () => void
		provider.init.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					release = resolve
				}),
		)
		const apm = createBrowserApm()
		apm.updateContext({ userId: "initial", attributes: { cluster: "one" } })
		const first = apm.initialize(config)
		expect(apm.initialize(config)).toBe(first)
		await vi.waitFor(() => expect(provider.init).toHaveBeenCalledOnce())
		apm.updateContext({ userId: "latest", attributes: { cluster: "two" } })
		release()
		await first
		expect(provider.updateContext).toHaveBeenLastCalledWith({
			userId: "latest",
			attributes: { cluster: "two" },
		})
		expect(provider.updateContext.mock.invocationCallOrder[0]).toBeLessThan(
			provider.start.mock.invocationCallOrder[0],
		)
		expect(provider.start).toHaveBeenCalledOnce()
	})
	it("disposal during initialization cannot start a late SDK", async () => {
		let release!: () => void
		provider.init.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					release = resolve
				}),
		)
		const apm = createBrowserApm()
		const pending = apm.initialize(config)
		await vi.waitFor(() => expect(provider.init).toHaveBeenCalledOnce())
		apm.dispose()
		release()
		await pending
		expect(provider.start).not.toHaveBeenCalled()
		expect(provider.dispose).toHaveBeenCalledOnce()
	})
	it("stop before initialization is preserved, then start can resume", async () => {
		const apm = createBrowserApm()
		apm.stop()
		await apm.initialize(config)
		expect(provider.start).not.toHaveBeenCalled()
		apm.start()
		expect(provider.start).toHaveBeenCalledOnce()
	})
	it("disabled configuration never initializes a provider", async () => {
		await createBrowserApm().initialize({ provider: { ...config.provider, enabled: false } })
		expect(provider.init).not.toHaveBeenCalled()
	})
	it("replaces context on logout instead of retaining account attributes", async () => {
		const apm = createBrowserApm()
		await apm.initialize(config)
		apm.updateContext({ userId: "one", attributes: { organization: "old" } })
		apm.updateContext({ userId: "" })
		expect(provider.updateContext).toHaveBeenLastCalledWith({ userId: "", attributes: {} })
		expect(apm).not.toHaveProperty("error")
		expect(apm).not.toHaveProperty("report")
	})
})
