import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { runtimeLoggerHub } from "../../runtime/RuntimeLogger"
import { DEVTOOLS_MSG, DevToolsCollector } from "../DevToolsCollector"

describe("DevToolsCollector integration", () => {
	const parentDescriptor = Object.getOwnPropertyDescriptor(window, "parent")
	const nativeFetch = window.fetch
	const consoleMethods = {
		log: console.log,
		info: console.info,
		warn: console.warn,
		error: console.error,
	}
	let collector: DevToolsCollector
	let parent: Window
	let messages: Array<{ type: string; payload: unknown; timestamp: number }>
	let postMessage: ReturnType<typeof vi.fn>

	beforeEach(() => {
		messages = []
		postMessage = vi.fn((message) => {
			// Browser postMessage clones synchronously; retain each pending/success version.
			messages.push(JSON.parse(JSON.stringify(message)))
		})
		parent = { postMessage } as unknown as Window
		Object.defineProperty(window, "parent", { configurable: true, get: () => parent })
		window.fetch = vi.fn(async () => new Response("network response"))
		for (const method of ["log", "info", "warn", "error"] as const) console[method] = vi.fn()
		collector = new DevToolsCollector()
	})

	afterEach(() => {
		collector.destroy()
		if (parentDescriptor) Object.defineProperty(window, "parent", parentDescriptor)
		else Reflect.deleteProperty(window, "parent")
		Object.assign(console, consoleMethods)
		window.fetch = nativeFetch
		window.localStorage.clear()
		vi.restoreAllMocks()
	})

	it("forwards real proxy events once, preserves API states, and excludes its own traffic", async () => {
		collector.enable()
		collector.enable()
		expect(collector.isEnabled()).toBe(true)
		expect(messages).toHaveLength(1)
		expect(messages[0]).toMatchObject({
			type: DEVTOOLS_MSG.SNAPSHOT,
			payload: {
				consoleEntries: [],
				networkEntries: [],
				apiCallEntries: [],
				messageEntries: [],
			},
		})
		console.log("hello", { ok: true })
		await window.fetch("https://api.example.com/data")
		const logger = runtimeLoggerHub.createLogger("TestApi")
		logger.info("request:start", { requestId: "collector-1" })
		logger.info("request:success", { requestId: "collector-1", result: { ok: true } })
		window.parent.postMessage({ type: "APP_REQUEST" }, "*")
		window.dispatchEvent(
			new MessageEvent("message", {
				source: parent,
				origin: window.location.origin,
				data: { type: "APP_REPLY" },
			}),
		)
		const entries = messages.filter((message) => message.type.startsWith("MAGIC_DEVTOOLS_"))
		expect(entries.map((message) => message.type)).toEqual([
			DEVTOOLS_MSG.SNAPSHOT,
			DEVTOOLS_MSG.CONSOLE_ENTRY,
			DEVTOOLS_MSG.NETWORK_ENTRY,
			DEVTOOLS_MSG.API_CALL_ENTRY,
			DEVTOOLS_MSG.API_CALL_ENTRY,
			DEVTOOLS_MSG.MESSAGE_ENTRY,
			DEVTOOLS_MSG.MESSAGE_ENTRY,
		])
		expect(entries[3].payload).toMatchObject({ status: "pending" })
		expect(entries[4].payload).toMatchObject({ status: "success", result: { ok: true } })
		expect(entries[5].payload).toMatchObject({ direction: "outgoing", type: "APP_REQUEST" })
		expect(entries[6].payload).toMatchObject({ direction: "incoming", type: "APP_REPLY" })
		for (const [message, origin] of postMessage.mock.calls) {
			if (message.type.startsWith("MAGIC_DEVTOOLS_"))
				expect(origin).toBe(window.location.origin)
		}
	})

	it("restores globals when closed and resumes once with errors captured while closed", async () => {
		const originalOpen = XMLHttpRequest.prototype.open
		const originalSend = XMLHttpRequest.prototype.send
		collector.enable()
		collector.disable()
		collector.disable()
		expect(collector.isEnabled()).toBe(false)
		expect(window.parent).toBe(parent)
		expect(XMLHttpRequest.prototype.open).toBe(originalOpen)
		expect(XMLHttpRequest.prototype.send).toBe(originalSend)
		messages.length = 0
		console.log("closed")
		await window.fetch("https://api.example.com/closed")
		runtimeLoggerHub.createLogger("TestApi").info("closed")
		window.dispatchEvent(
			new MessageEvent("message", { source: parent, data: { type: "CLOSED" } }),
		)
		window.dispatchEvent(new ErrorEvent("error", { message: "error while closed" }))
		expect(messages).toEqual([])
		collector.enable()
		expect(messages.map((message) => message.type)).toEqual([
			DEVTOOLS_MSG.CONSOLE_ENTRY,
			DEVTOOLS_MSG.SNAPSHOT,
		])
		expect(messages[1].payload).toMatchObject({
			consoleEntries: [{ args: ["error while closed"] }],
			networkEntries: [],
			apiCallEntries: [],
			messageEntries: [],
		})
		messages.length = 0
		console.log("resumed")
		expect(messages).toHaveLength(1)
	})

	it("clears all proxies together and removes subscriptions on destroy", async () => {
		collector.enable()
		console.log("clear me")
		await window.fetch("https://api.example.com/clear")
		runtimeLoggerHub.createLogger("TestApi").info("request:start", { requestId: "clear" })
		window.parent.postMessage({ type: "CLEAR_ME" }, "*")
		collector.clear()
		collector.disable()
		messages.length = 0
		collector.enable()
		expect(messages[0].payload).toEqual({
			consoleEntries: [],
			networkEntries: [],
			apiCallEntries: [],
			messageEntries: [],
		})
		collector.destroy()
		messages.length = 0
		console.log("destroyed")
		runtimeLoggerHub.createLogger("TestApi").info("destroyed")
		window.dispatchEvent(new ErrorEvent("error", { message: "destroyed" }))
		window.dispatchEvent(new MessageEvent("message", { source: parent, data: "destroyed" }))
		expect(messages).toEqual([])
		expect(collector.isEnabled()).toBe(false)
	})

	it("reports storage through the parent bridge and tolerates parent delivery failures", async () => {
		collector.enable()
		window.localStorage.setItem("theme", "dark")
		await collector.sendStorageSnapshot()
		expect(messages.at(-1)).toMatchObject({
			type: DEVTOOLS_MSG.STORAGE_SNAPSHOT,
			payload: { localStorage: { theme: "dark" } },
		})
		postMessage.mockImplementation(() => {
			throw new DOMException("Unavailable", "DataCloneError")
		})
		expect(() => console.log("still usable")).not.toThrow()
		await expect(collector.sendStorageSnapshot()).resolves.toBeUndefined()
	})
})
