import { afterEach, describe, expect, it, vi } from "vitest"
import type { BrowserClient, BrowserSendEvent } from "@apmplus/web"
const state = vi.hoisted(() => ({
	events: [] as BrowserSendEvent[],
	clients: [] as BrowserClient[],
}))
vi.mock("@apmplus/web", async (original) => {
	const sdk = await original<typeof import("@apmplus/web")>()
	return {
		...sdk,
		createBrowserClient: () => {
			const client = sdk.createBrowserClient()
			const init = client.init.bind(client)
			client.init = (config) =>
				init({
					...config,
					transport: { get: vi.fn(), post: vi.fn() },
					plugins: {
						...config.plugins,
						pageview: false,
						performance: false,
						resource: false,
						ajax: false,
						breadcrumb: false,
						tti: false,
					},
				})
			client.on("send", (event) => {
				state.events.push(event)
			})
			state.clients.push(client)
			return client
		},
	}
})
vi.mock("@apmplus/integrations", () => ({
	SPALoadPlugin: () => ({ name: "test-spa", setup: vi.fn() }),
}))
import { VolcengineProvider } from "../index"
afterEach(() => {
	for (const client of state.clients) client.destroy()
	state.clients.length = 0
	state.events.length = 0
	vi.restoreAllMocks()
})
describe("Volcengine native uncaught errors", () => {
	it("captures global errors itself, deduplicates, and stops after disposal", async () => {
		const provider = new VolcengineProvider()
		await provider.init({ type: "Volcengine", appId: "123", token: "test", release: "r1" })
		provider.updateContext({ userId: "user-one", attributes: { cluster: "one" } })
		provider.start()
		const error = new Error("native uncaught")
		window.dispatchEvent(new ErrorEvent("error", { error, message: error.message }))
		window.dispatchEvent(new ErrorEvent("error", { error, message: error.message }))
		await vi.waitFor(() =>
			expect(state.events.filter((event) => event.ev_type === "js_error")).toHaveLength(1),
		)
		expect(state.events.find((event) => event.ev_type === "js_error")?.common).toMatchObject({
			user_id: "user-one",
		})
		// This SDK version attaches release to the batch endpoint, not each event's common data.
		expect(
			new URL(
				state.clients[0].getSender()?.getEndpoint() ?? "https://invalid.test",
			).searchParams.get("release"),
		).toBe("r1")
		provider.updateContext({})
		expect(state.clients[0].config()?.userId).toBe("")
		provider.dispose()
		window.dispatchEvent(new ErrorEvent("error", { error: new Error("after disposal") }))
		expect(state.events.filter((event) => event.ev_type === "js_error")).toHaveLength(1)
	})
	it("captures unhandled rejections without a business logger bridge", async () => {
		const provider = new VolcengineProvider()
		await provider.init({ type: "Volcengine", appId: "123", token: "test" })
		provider.start()
		const event = new Event("unhandledrejection")
		Object.defineProperty(event, "reason", { value: new Error("unhandled promise") })
		window.dispatchEvent(event)
		await vi.waitFor(() =>
			expect(state.events.some((item) => item.ev_type === "js_error")).toBe(true),
		)
		provider.dispose()
	})
})
