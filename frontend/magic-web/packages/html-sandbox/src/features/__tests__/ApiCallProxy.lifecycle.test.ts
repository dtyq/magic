import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RuntimeLoggerHub } from "../../runtime/RuntimeLogger"
import { ApiCallProxy } from "../ApiCallProxy"

describe("ApiCallProxy lifecycle", () => {
	let hub: RuntimeLoggerHub
	let proxy: ApiCallProxy

	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(1000)
		hub = new RuntimeLoggerHub()
		proxy = new ApiCallProxy(hub)
	})

	afterEach(() => {
		proxy.destroy()
		vi.useRealTimers()
	})

	it("correlates overlapping calls completed out of order without mixing results", () => {
		proxy.enable()
		const first = hub.createLogger("Files")
		const second = hub.createLogger("Database")
		first.info("request:start", { requestId: "first", path: "a.txt" })
		vi.setSystemTime(1010)
		second.info("request:start", { requestId: "second", table: "rows" })
		vi.setSystemTime(1030)
		second.info("request:success", { requestId: "second", result: [2] })
		vi.setSystemTime(1050)
		first.error("request:failure", { requestId: "first", error: "missing" })
		expect(proxy.getEntries()).toMatchObject([
			{
				api: "Files",
				status: "error",
				duration: 50,
				error: "missing",
				details: { path: "a.txt" },
			},
			{
				api: "Database",
				status: "success",
				duration: 20,
				result: [2],
				details: { table: "rows" },
			},
		])
		expect(proxy.getEntries()[0].result).toBeUndefined()
	})

	it.each([
		["request:success", "success"],
		["request:failure", "error"],
		["request:timeout", "timeout"],
	])("records %s both with and without a matching start", (event, status) => {
		proxy.enable()
		const logger = hub.createLogger("Files")
		logger.info("request:start", { requestId: "started" })
		vi.setSystemTime(1100)
		logger.info(event, { requestId: "started" })
		logger.info(event, { requestId: "orphan" })
		expect(proxy.getEntries()).toMatchObject([
			{ status, duration: 100, startTime: 1000, endTime: 1100 },
			{ status, duration: 0, startTime: 1100, endTime: 1100 },
		])
	})

	it("subscribes once, isolates hubs, and detaches on disable and destroy", () => {
		const logger = hub.createLogger("Files")
		const listener = vi.fn()
		proxy.onEntry(listener)
		logger.info("before")
		proxy.enable()
		proxy.enable()
		new RuntimeLoggerHub().createLogger("Other frame").info("foreign")
		logger.info("enabled")
		expect(listener).toHaveBeenCalledTimes(1)
		proxy.disable()
		logger.info("disabled")
		proxy.enable()
		logger.info("re-enabled")
		expect(proxy.getEntries().map((entry) => entry.event)).toEqual(["enabled", "re-enabled"])
		proxy.destroy()
		logger.info("destroyed")
		expect(listener).toHaveBeenCalledTimes(2)
		expect(proxy.getEntries()).toEqual([])
	})

	it("clears pending correlations and caps records at the most recent 500", () => {
		proxy.enable()
		const logger = hub.createLogger("Files")
		logger.info("request:start", { requestId: "cleared" })
		proxy.clear()
		vi.setSystemTime(1200)
		logger.info("request:success", { requestId: "cleared" })
		expect(proxy.getEntries()[0].duration).toBe(0)
		for (let index = 0; index < 501; index++) logger.info(`event-${index}`)
		const entries = proxy.getEntries()
		expect(entries).toHaveLength(500)
		expect(entries[0].event).toBe("event-1")
		expect(entries.at(-1)?.event).toBe("event-500")
		entries.pop()
		expect(proxy.getEntries()).toHaveLength(500)
	})
})
