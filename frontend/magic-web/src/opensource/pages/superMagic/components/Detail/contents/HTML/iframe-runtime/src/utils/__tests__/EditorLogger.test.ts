/**
 * EditorLogger tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EditorLogger } from "../EditorLogger"

describe("EditorLogger", () => {
	// Save original console methods
	const originalConsole = {
		debug: console.debug,
		log: console.log,
		warn: console.warn,
		error: console.error,
	}

	beforeEach(() => {
		// Mock console methods
		console.debug = vi.fn()
		console.log = vi.fn()
		console.warn = vi.fn()
		console.error = vi.fn()
		// Reset enabled state
		EditorLogger.setEnabled(true)
		// Clear logs
		EditorLogger.clearLogs()
	})

	afterEach(() => {
		// Restore original console methods
		console.debug = originalConsole.debug
		console.log = originalConsole.log
		console.warn = originalConsole.warn
		console.error = originalConsole.error
	})

	describe("debug", () => {
		it("should log debug message with prefix", () => {
			EditorLogger.debug("test message")
			expect(console.debug).toHaveBeenCalledWith("[IframeRuntime] test message", undefined)
		})

		it("should log debug message with data", () => {
			const data = { key: "value" }
			EditorLogger.debug("test message", data)
			expect(console.debug).toHaveBeenCalledWith("[IframeRuntime] test message", data)
		})

		it("should not log when disabled", () => {
			EditorLogger.setEnabled(false)
			EditorLogger.debug("test message")
			expect(console.debug).not.toHaveBeenCalled()
		})
	})

	describe("info", () => {
		it("should log info message with prefix", () => {
			EditorLogger.info("test message")
			expect(console.log).toHaveBeenCalledWith("[IframeRuntime] test message", undefined)
		})

		it("should log info message with data", () => {
			const data = { key: "value" }
			EditorLogger.info("test message", data)
			expect(console.log).toHaveBeenCalledWith("[IframeRuntime] test message", data)
		})

		it("should not log when disabled", () => {
			EditorLogger.setEnabled(false)
			EditorLogger.info("test message")
			expect(console.log).not.toHaveBeenCalled()
		})
	})

	describe("warn", () => {
		it("should log warning message with prefix", () => {
			EditorLogger.warn("test message")
			expect(console.warn).toHaveBeenCalledWith("[IframeRuntime] test message", undefined)
		})

		it("should log warning message with data", () => {
			const data = { key: "value" }
			EditorLogger.warn("test message", data)
			expect(console.warn).toHaveBeenCalledWith("[IframeRuntime] test message", data)
		})

		it("should not log when disabled", () => {
			EditorLogger.setEnabled(false)
			EditorLogger.warn("test message")
			expect(console.warn).not.toHaveBeenCalled()
		})
	})

	describe("error", () => {
		it("should log error message with prefix", () => {
			EditorLogger.error("test message")
			expect(console.error).toHaveBeenCalledWith("[IframeRuntime] test message", undefined)
		})

		it("should log error message with error object", () => {
			const error = new Error("test error")
			EditorLogger.error("test message", error)
			expect(console.error).toHaveBeenCalledWith("[IframeRuntime] test message", error)
		})

		it("should not log when disabled", () => {
			EditorLogger.setEnabled(false)
			EditorLogger.error("test message")
			expect(console.error).not.toHaveBeenCalled()
		})
	})

	describe("setEnabled", () => {
		it("should enable logging", () => {
			EditorLogger.setEnabled(true)
			EditorLogger.info("test")
			expect(console.log).toHaveBeenCalled()
		})

		it("should disable logging", () => {
			EditorLogger.setEnabled(false)
			EditorLogger.info("test")
			expect(console.log).not.toHaveBeenCalled()
		})

		it("should toggle logging state", () => {
			EditorLogger.setEnabled(false)
			EditorLogger.info("test1")
			expect(console.log).not.toHaveBeenCalled()

			EditorLogger.setEnabled(true)
			EditorLogger.info("test2")
			expect(console.log).toHaveBeenCalledTimes(1)
		})
	})

	describe("log storage", () => {
		it("should store log entries", () => {
			EditorLogger.info("test message 1")
			EditorLogger.warn("test message 2")

			const logs = EditorLogger.getLogs()
			expect(logs).toHaveLength(2)
			expect(logs[0].message).toBe("test message 1")
			expect(logs[0].level).toBe("info")
			expect(logs[1].message).toBe("test message 2")
			expect(logs[1].level).toBe("warn")
		})

		it("should store log data", () => {
			const data = { key: "value" }
			EditorLogger.info("test", data)

			const logs = EditorLogger.getLogs()
			expect(logs[0].data).toEqual(data)
		})

		it("should not store logs when disabled", () => {
			EditorLogger.setEnabled(false)
			EditorLogger.info("test")

			const logs = EditorLogger.getLogs()
			expect(logs).toHaveLength(0)
		})

		it("should include timestamp and formatted time", () => {
			EditorLogger.info("test")

			const logs = EditorLogger.getLogs()
			expect(logs[0].timestamp).toBeGreaterThan(0)
			expect(logs[0].formattedTime).toMatch(/\d+:\d+:\d+\.\d+/)
		})

		it("should generate unique IDs", () => {
			EditorLogger.info("test 1")
			EditorLogger.info("test 2")

			const logs = EditorLogger.getLogs()
			expect(logs[0].id).not.toBe(logs[1].id)
		})
	})

	describe("clearLogs", () => {
		it("should clear all logs", () => {
			EditorLogger.info("test 1")
			EditorLogger.info("test 2")
			expect(EditorLogger.getLogs()).toHaveLength(2)

			EditorLogger.clearLogs()
			expect(EditorLogger.getLogs()).toHaveLength(0)
		})
	})

	describe("exportLogs", () => {
		it("should export logs as JSON string", () => {
			EditorLogger.info("test 1")
			EditorLogger.warn("test 2")

			const exported = EditorLogger.exportLogs()
			const parsed = JSON.parse(exported)

			expect(parsed.exportTime).toBeDefined()
			expect(parsed.totalLogs).toBe(2)
			expect(parsed.logs).toHaveLength(2)
		})
	})

	describe("subscribe", () => {
		it("should notify listener immediately with current logs", () => {
			EditorLogger.info("existing log")

			const listener = vi.fn()
			EditorLogger.subscribe(listener)

			expect(listener).toHaveBeenCalledTimes(1)
			expect(listener).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						message: "existing log",
					}),
				]),
			)
		})

		it("should notify listener on new log", () => {
			const listener = vi.fn()
			EditorLogger.subscribe(listener)
			listener.mockClear()

			EditorLogger.info("new log")

			expect(listener).toHaveBeenCalledTimes(1)
			expect(listener).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						message: "new log",
					}),
				]),
			)
		})

		it("should return unsubscribe function", () => {
			const listener = vi.fn()
			const unsubscribe = EditorLogger.subscribe(listener)
			listener.mockClear()

			unsubscribe()
			EditorLogger.info("new log")

			expect(listener).not.toHaveBeenCalled()
		})

		it("should notify multiple listeners", () => {
			const listener1 = vi.fn()
			const listener2 = vi.fn()

			EditorLogger.subscribe(listener1)
			EditorLogger.subscribe(listener2)
			listener1.mockClear()
			listener2.mockClear()

			EditorLogger.info("test")

			expect(listener1).toHaveBeenCalledTimes(1)
			expect(listener2).toHaveBeenCalledTimes(1)
		})

		it("should handle listener errors gracefully", () => {
			// Mock console.error before subscribing to suppress error output
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			const errorListener = vi.fn(() => {
				throw new Error("Listener error")
			})
			const goodListener = vi.fn()

			// Subscribe - this will immediately call listeners and error
			EditorLogger.subscribe(errorListener)
			EditorLogger.subscribe(goodListener)
			errorListener.mockClear()
			goodListener.mockClear()
			consoleErrorSpy.mockClear()

			// Should not throw and should still call good listener
			expect(() => {
				EditorLogger.info("test")
			}).not.toThrow()

			expect(goodListener).toHaveBeenCalledTimes(1)
			expect(consoleErrorSpy).toHaveBeenCalled()

			// Restore console.error
			consoleErrorSpy.mockRestore()
		})
	})

	describe("edge cases", () => {
		it("should handle empty message", () => {
			EditorLogger.info("")
			expect(console.log).toHaveBeenCalledWith("[IframeRuntime] ", undefined)
		})

		it("should handle null data", () => {
			EditorLogger.info("test", null)
			expect(console.log).toHaveBeenCalledWith("[IframeRuntime] test", null)
		})

		it("should handle undefined data", () => {
			EditorLogger.info("test", undefined)
			expect(console.log).toHaveBeenCalledWith("[IframeRuntime] test", undefined)
		})

		it("should handle complex objects", () => {
			const complexData = {
				nested: { key: "value" },
				array: [1, 2, 3],
				fn: () => {},
			}
			EditorLogger.info("test", complexData)
			expect(console.log).toHaveBeenCalledWith("[IframeRuntime] test", complexData)
		})

		it("should handle circular references", () => {
			const circular: { self?: unknown } = {}
			circular.self = circular
			EditorLogger.info("test", circular)
			expect(console.log).toHaveBeenCalledWith("[IframeRuntime] test", circular)
		})
	})
})
