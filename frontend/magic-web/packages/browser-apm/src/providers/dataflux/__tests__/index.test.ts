import { afterEach, describe, expect, it, vi } from "vitest"
const sdk = vi.hoisted(() => ({
	init: vi.fn(),
	setUser: vi.fn(),
	clearUser: vi.fn(),
	setGlobalContext: vi.fn(),
	startSession: vi.fn(),
	stopSession: vi.fn(),
}))
vi.mock("@cloudcare/browser-rum", () => ({ datafluxRum: sdk }))
import { DataFluxProvider } from "../index"
afterEach(() => vi.clearAllMocks())
describe("DataFlux passive provider", () => {
	it("sets identity before init, starts once, stops sampling and clears identity", async () => {
		const provider = new DataFluxProvider()
		await provider.init({
			type: "DataFlux",
			appId: "a",
			token: "t",
			endpoint: "https://rum.test",
			context: { userId: "initial" },
			telemetry: { sampling: { unit: "session", rate: 0.5 } },
		})
		expect(sdk.setUser.mock.invocationCallOrder[0]).toBeLessThan(
			sdk.init.mock.invocationCallOrder[0],
		)
		expect(sdk.init).toHaveBeenCalledWith(
			expect.objectContaining({
				site: "https://rum.test",
				sessionSampleRate: 0,
				trackUserInteractions: false,
				sessionReplaySampleRate: 0,
			}),
		)
		provider.start()
		provider.start()
		expect(sdk.startSession).toHaveBeenCalledOnce()
		expect(sdk.startSession).toHaveBeenCalledWith({ sessionSampleRate: 50 })
		provider.updateContext({})
		expect(sdk.clearUser).toHaveBeenCalled()
		expect(sdk.setGlobalContext).toHaveBeenLastCalledWith({ app_session_id: "" })
		provider.stop()
		expect(sdk.startSession).toHaveBeenLastCalledWith({ sessionSampleRate: 0 })
		expect(sdk.stopSession).toHaveBeenCalledOnce()
	})
	it("requires an endpoint", async () => {
		await expect(
			new DataFluxProvider().init({ type: "DataFlux", appId: "a", token: "t" }),
		).rejects.toThrow("endpoint/site")
	})
})
