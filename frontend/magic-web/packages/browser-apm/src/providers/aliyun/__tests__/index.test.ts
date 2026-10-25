import { afterEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ setConfig: vi.fn(), destroy: vi.fn(), construct: vi.fn() }))
vi.mock("@arms/rum-browser", () => ({
	ArmsRum: class {
		constructor(config: unknown) {
			mocks.construct(config)
		}
		setConfig = mocks.setConfig
		client = { getCollectors: () => [{ destroy: mocks.destroy }] }
	},
}))
import { AliyunProvider } from "../index"
afterEach(() => vi.clearAllMocks())
describe("Aliyun passive provider", () => {
	it("uses injected release and maps identity updates including logout", async () => {
		const provider = new AliyunProvider()
		await provider.init({
			type: "Aliyun",
			appId: "test",
			token: "test",
			release: "release-1",
			context: { userId: "initial" },
		})
		expect(mocks.construct).toHaveBeenCalledWith(
			expect.objectContaining({ version: "release-1", user: { id: "initial" } }),
		)
		provider.updateContext({ userId: "next", sessionId: "s", attributes: { cluster: "one" } })
		expect(mocks.setConfig).toHaveBeenCalledWith("user", { id: "next" })
		provider.start()
		const options = mocks.construct.mock.calls[0][0]
		// Native ARMS bundles use the session-generated ID, ignoring config.user.id.
		const bundle = { user: { id: "anonymous-sdk-id" }, events: [] }
		expect(options.beforeReport(bundle).user.id).toBe("next")
		provider.updateContext({})
		expect(options.beforeReport(bundle).user.id).toBe("anonymous-sdk-id")
		expect(bundle.user.id).toBe("anonymous-sdk-id")
		expect(mocks.setConfig).toHaveBeenLastCalledWith("properties", { app_session_id: "" })
		expect(mocks.setConfig).toHaveBeenCalledWith("user", { id: "" })
		provider.dispose()
		expect(mocks.destroy).toHaveBeenCalledOnce()
	})
	it("gates SDK bundles while stopped", async () => {
		const provider = new AliyunProvider()
		await provider.init({ type: "Aliyun", appId: "test", token: "test" })
		const options = mocks.construct.mock.calls[0][0]
		const bundle = { user: { id: "anonymous" }, events: [] }
		expect(options.beforeReport(bundle)).toBeUndefined()
		provider.start()
		expect(options.beforeReport(bundle)).toEqual(bundle)
		provider.stop()
		expect(options.beforeReport(bundle)).toBeUndefined()
	})
})
