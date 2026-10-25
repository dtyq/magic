// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest"
import { startLoggerRuntime, shutdown } from "../runtime"
import {
	createGlobalErrorPlugin,
	createFetchPlugin,
	createPageDwellPlugin,
	createResourcePlugin,
	createDevicePlugin,
} from "../plugins"
import { ResourceCollector } from "../plugins/resource"
import { DeliveryQueue } from "../delivery/queue"
import type { LoggerPlugin } from "../types"

const options = { shouldReadResponse: () => true, isBusinessError: () => false }
const start = (plugins: LoggerPlugin[]) => startLoggerRuntime({ fetcher: window.fetch, plugins })!

afterEach(async () => {
	await shutdown({ timeoutMs: 0 })
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

it("isolates resource setup failure and releases the remaining page plugins at shutdown", async () => {
	const add = vi.spyOn(DeliveryQueue.prototype, "add").mockImplementation(() => undefined)
	const original = vi.fn(async () => new Response("{}"))
	vi.stubGlobal("fetch", original)
	const destroy = vi.spyOn(ResourceCollector.prototype, "destroy")
	vi.spyOn(ResourceCollector.prototype, "init").mockImplementation(() => {
		throw new Error("resource failed")
	})
	const runtime = start([
		createGlobalErrorPlugin(),
		createFetchPlugin(options),
		createResourcePlugin(),
	])
	expect(runtime.getStats()).toMatchObject({ state: "running", plugin_setup_failed: 1 })
	expect(destroy).toHaveBeenCalledTimes(1)
	window.dispatchEvent(new ErrorEvent("error", { message: "still observed" }))
	expect(add).toHaveBeenCalledTimes(1)
	await runtime.shutdown({ timeoutMs: 0 })
	expect(window.fetch).toBe(original)
	window.dispatchEvent(new ErrorEvent("error", { message: "after removal" }))
	expect(add).toHaveBeenCalledTimes(1)
})

it("preserves global error fields and other modules' fetch/history wrappers", async () => {
	const add = vi.spyOn(DeliveryQueue.prototype, "add").mockImplementation(() => undefined)
	const original = vi.fn(
		async () => new Response("{}", { headers: { "content-type": "application/json" } }),
	)
	vi.stubGlobal("fetch", original)
	const push = history.pushState
	const runtime = start([
		createGlobalErrorPlugin(),
		createFetchPlugin(options),
		createPageDwellPlugin(),
	])
	window.dispatchEvent(
		new ErrorEvent("error", {
			message: "broken",
			error: new TypeError("broken"),
			filename: "app.js",
			lineno: 2,
		}),
	)
	const response = await window.fetch(
		new Request("https://example.com/api", { headers: [["accept", "application/json"]] }),
	)
	expect(await response.json()).toEqual({})
	expect(add.mock.calls[0][0]).toMatchObject({
		namespace: "globalError",
		captureSource: "global",
		eventKey: "global_javascript_error",
		error: { name: "TypeError", message: "broken" },
		context: { errorInfo: { filename: "app.js", lineno: 2 } },
	})
	const otherFetch = vi.fn(original)
	window.fetch = otherFetch
	const otherPush = vi.fn(push)
	history.pushState = otherPush
	await runtime.shutdown({ timeoutMs: 0 })
	expect(window.fetch).toBe(otherFetch)
	expect(history.pushState).toBe(otherPush)
	const errors = add.mock.calls.filter(([record]) => record.level === "error").length
	window.dispatchEvent(new ErrorEvent("error", { message: "after removal" }))
	expect(add.mock.calls.filter(([record]) => record.level === "error")).toHaveLength(errors)
	history.pushState = push
})

it("returns the original fetch promise and never reads SSE, downloads or unrelated JSON", async () => {
	vi.spyOn(DeliveryQueue.prototype, "add").mockImplementation(() => undefined)
	const cases: [Record<string, string>, boolean][] = [
		[{ "content-type": "text/event-stream" }, true],
		[{ "content-type": "application/json", "content-disposition": "attachment" }, true],
		[{ "content-type": "application/json" }, false],
	]
	for (const [headers, read] of cases) {
		const response = new Response("data: event", { headers })
		const clone = vi.spyOn(response, "clone")
		const promise = Promise.resolve(response)
		const original = vi.fn(() => promise)
		vi.stubGlobal("fetch", original)
		const runtime = start([createFetchPlugin({ ...options, shouldReadResponse: () => read })])
		expect(window.fetch("https://example.com/api")).toBe(promise)
		await promise
		expect(clone).not.toHaveBeenCalled()
		await runtime.shutdown({ timeoutMs: 0 })
		expect(window.fetch).toBe(original)
	}
})

it("keeps device shape and accepts the final page dwell summary before draining", async () => {
	const add = vi.spyOn(DeliveryQueue.prototype, "add").mockImplementation(() => undefined)
	vi.stubGlobal("fetch", vi.fn())
	const runtime = start([
		createPageDwellPlugin(),
		createDevicePlugin({ sha: "sha", version: "v1" }),
	])
	expect(add.mock.calls[0][0]).toMatchObject({
		namespace: "deviceMeta",
		data: { sha: "sha", version: "v1", env: navigator.userAgent },
	})
	await runtime.shutdown({ timeoutMs: 0 })
	expect(add.mock.calls.at(-1)?.[0]).toMatchObject({
		namespace: "PageDwellTime",
		data: { reason: "shutdown" },
	})
	expect(runtime.getStats()).not.toHaveProperty("after_shutdown")
})
