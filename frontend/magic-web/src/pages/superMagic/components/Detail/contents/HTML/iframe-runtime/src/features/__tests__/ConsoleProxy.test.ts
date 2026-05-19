import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ConsoleProxy, type ConsoleEntry } from "../ConsoleProxy"

describe("ConsoleProxy", () => {
	let proxy: ConsoleProxy
	const originalConsole = {
		log: console.log,
		info: console.info,
		warn: console.warn,
		error: console.error,
	}

	beforeEach(() => {
		proxy = new ConsoleProxy()
		// Save originals before each test
		console.log = originalConsole.log
		console.info = originalConsole.info
		console.warn = originalConsole.warn
		console.error = originalConsole.error
	})

	afterEach(() => {
		proxy.disable()
		// Restore originals
		console.log = originalConsole.log
		console.info = originalConsole.info
		console.warn = originalConsole.warn
		console.error = originalConsole.error
	})

	it("should not intercept console before enable", () => {
		const listener = vi.fn()
		proxy.onEntry(listener)

		console.log("test")
		expect(listener).not.toHaveBeenCalled()
		expect(proxy.getEntries()).toHaveLength(0)
	})

	it("should intercept console.log after enable", () => {
		const listener = vi.fn()
		proxy.onEntry(listener)
		proxy.enable()

		console.log("hello", 42)

		expect(listener).toHaveBeenCalledTimes(1)
		const entry: ConsoleEntry = listener.mock.calls[0][0]
		expect(entry.level).toBe("log")
		expect(entry.args).toEqual(["hello", "42"])
		expect(entry.source).toBe("console")
		expect(entry.id).toMatch(/^c_/)
	})

	it("should intercept all four console methods", () => {
		const entries: ConsoleEntry[] = []
		proxy.onEntry((e) => entries.push(e))
		proxy.enable()

		console.log("log msg")
		console.info("info msg")
		console.warn("warn msg")
		console.error("error msg")

		expect(entries).toHaveLength(4)
		expect(entries.map((e) => e.level)).toEqual(["log", "info", "warn", "error"])
	})

	it("should still call original console methods", () => {
		const origLog = vi.fn()
		console.log = origLog
		proxy.enable()

		console.log("test")
		expect(origLog).toHaveBeenCalledWith("test")
	})

	it("should restore console methods on disable", () => {
		proxy.enable()
		const listener = vi.fn()
		proxy.onEntry(listener)

		proxy.disable()

		// After disable, new console.log calls should NOT be captured
		listener.mockClear()
		console.log("after-disable")
		expect(listener).not.toHaveBeenCalled()
	})

	it("should serialize different argument types", () => {
		const entries: ConsoleEntry[] = []
		proxy.onEntry((e) => entries.push(e))
		proxy.enable()

		console.log("string", 123, true, null, undefined, { key: "val" })

		expect(entries[0].args).toEqual([
			"string",
			"123",
			"true",
			"null",
			"undefined",
			'{\n  "key": "val"\n}',
		])
	})

	it("should enforce ring buffer limit", () => {
		proxy.enable()
		for (let i = 0; i < 510; i++) {
			console.log(`msg-${i}`)
		}

		const entries = proxy.getEntries()
		expect(entries.length).toBeLessThanOrEqual(500)
		// Last entry should be the most recent
		expect(entries[entries.length - 1].args[0]).toBe("msg-509")
	})

	it("should clear entries", () => {
		proxy.enable()
		console.log("test")
		expect(proxy.getEntries()).toHaveLength(1)

		proxy.clear()
		expect(proxy.getEntries()).toHaveLength(0)
	})

	it("should not enable twice", () => {
		const origLog = console.log
		proxy.enable()
		const patchedLog = console.log

		proxy.enable() // second enable
		expect(console.log).toBe(patchedLog) // should not double-wrap
	})

	it("should include stack for error level entries", () => {
		const entries: ConsoleEntry[] = []
		proxy.onEntry((e) => entries.push(e))
		proxy.enable()

		console.error("something failed")

		expect(entries[0].stack).toBeDefined()
		expect(typeof entries[0].stack).toBe("string")
	})

	it("should handle Error objects in args", () => {
		const entries: ConsoleEntry[] = []
		proxy.onEntry((e) => entries.push(e))
		proxy.enable()

		const err = new Error("test error")
		console.log(err)

		expect(entries[0].args[0]).toContain("Error: test error")
	})

	it("should classify all console output as console source (magicApi logs no longer go through console)", () => {
		const entries: ConsoleEntry[] = []
		proxy.onEntry((e) => entries.push(e))
		proxy.enable()

		console.log(`[MagicAPI] [MagicFSApi] request:start`, {
			type: "MAGIC_FS_READ_REQUEST",
		})

		expect(entries).toHaveLength(1)
		expect(entries[0].source).toBe("console")
	})

	it("should classify EditorLogger output as console source", () => {
		const entries: ConsoleEntry[] = []
		proxy.onEntry((e) => entries.push(e))
		proxy.enable()

		console.log(`[IframeRuntime] Magic APIs installed`)

		expect(entries).toHaveLength(1)
		expect(entries[0].source).toBe("console")
	})
})
