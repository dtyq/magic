import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { observable, runInAction } from "mobx"
import { BrowserApmService } from "../BrowserApmService"

function setup() {
	const state = observable({ userId: "existing", cluster: "one", organization: "org" })
	const apm = {
		initialize: vi.fn().mockResolvedValue(undefined),
		updateContext: vi.fn(),
		start: vi.fn(),
		stop: vi.fn(),
		dispose: vi.fn(),
	}
	const service = new BrowserApmService({
		apm,
		readConfig: () => ({ provider: { type: "Volcengine", appId: "test", token: "test" } }),
		readContext: () => ({
			userId: state.userId,
			sessionId: "session",
			attributes: {
				cluster: state.cluster,
				organization: state.userId ? state.organization : "",
			},
		}),
	})
	return { service, state, apm }
}
beforeEach(() => {
	vi.useFakeTimers()
	vi.spyOn(document, "readyState", "get").mockReturnValue("complete")
})
afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
})

describe("application-owned APM context subscription", () => {
	it("synchronizes existing identity immediately and starts the SDK only once", async () => {
		const { service, apm } = setup()
		service.initialize()
		service.initialize()
		expect(apm.updateContext).toHaveBeenCalledOnce()
		expect(apm.updateContext).toHaveBeenCalledWith(
			expect.objectContaining({ userId: "existing" }),
		)
		expect(apm.initialize).not.toHaveBeenCalled()
		await vi.advanceTimersByTimeAsync(2000)
		expect(apm.initialize).toHaveBeenCalledOnce()
		service.dispose()
	})
	it("updates for account/cluster changes, clears on logout, and releases the subscription", () => {
		const { service, apm, state } = setup()
		service.initialize()
		runInAction(() => {
			state.userId = "next"
			state.cluster = "two"
		})
		expect(apm.updateContext).toHaveBeenLastCalledWith(
			expect.objectContaining({
				userId: "next",
				attributes: { cluster: "two", organization: "org" },
			}),
		)
		runInAction(() => {
			state.userId = ""
		})
		expect(apm.updateContext).toHaveBeenLastCalledWith(
			expect.objectContaining({
				userId: "",
				attributes: { cluster: "two", organization: "" },
			}),
		)
		service.dispose()
		const count = apm.updateContext.mock.calls.length
		runInAction(() => {
			state.userId = "after-dispose"
		})
		expect(apm.updateContext).toHaveBeenCalledTimes(count)
	})
	it("disposal cancels deferred initialization", async () => {
		const { service, apm } = setup()
		service.initialize()
		service.dispose()
		await vi.advanceTimersByTimeAsync(3000)
		expect(apm.initialize).not.toHaveBeenCalled()
		expect(apm.dispose).toHaveBeenCalledOnce()
	})
	it("optional SDK failure does not break application startup or retain a subscription", async () => {
		const { service, apm, state } = setup()
		apm.initialize.mockRejectedValue(new Error("SDK unavailable"))
		vi.spyOn(console, "warn").mockImplementation(vi.fn())
		service.initialize()
		await vi.advanceTimersByTimeAsync(2000)
		const count = apm.updateContext.mock.calls.length
		runInAction(() => {
			state.userId = "other"
		})
		expect(apm.updateContext).toHaveBeenCalledTimes(count)
		service.dispose()
	})
})
