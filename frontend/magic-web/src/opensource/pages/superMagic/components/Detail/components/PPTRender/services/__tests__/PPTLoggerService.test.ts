import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { PPTLoggerService, createPPTLogger } from "../PPTLoggerService"

describe("PPTLoggerService", () => {
	let logger: PPTLoggerService
	let consoleDebugSpy: any
	let consoleInfoSpy: any
	let consoleWarnSpy: any
	let consoleErrorSpy: any

	beforeEach(() => {
		// Spy on console methods
		consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {})
		consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {})
		consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		logger = new PPTLoggerService({
			enabled: true,
			level: "debug",
			prefix: "[PPTTest]",
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("Basic Logging", () => {
		it("should log debug messages", () => {
			logger.debug("测试调试消息")
			expect(consoleDebugSpy).toHaveBeenCalledWith("[PPTTest] 测试调试消息")
		})

		it("should log info messages", () => {
			logger.info("测试信息消息")
			expect(consoleInfoSpy).toHaveBeenCalledWith("[PPTTest] 测试信息消息")
		})

		it("should log warn messages", () => {
			logger.warn("测试警告消息")
			expect(consoleWarnSpy).toHaveBeenCalledWith("[PPTTest] 测试警告消息")
		})

		it("should log error messages", () => {
			const error = new Error("测试错误")
			logger.error("测试错误消息", error)
			expect(consoleErrorSpy).toHaveBeenCalledWith("[PPTTest] 测试错误消息", error)
		})
	})

	describe("Context Logging", () => {
		it("should include operation in log message", () => {
			logger.info("测试消息", { operation: "testOperation" })
			expect(consoleInfoSpy).toHaveBeenCalledWith("[PPTTest] [testOperation] 测试消息")
		})

		it("should include slide index in log message", () => {
			logger.info("测试消息", { slideIndex: 5 })
			expect(consoleInfoSpy).toHaveBeenCalledWith("[PPTTest] [Slide 5] 测试消息")
		})

		it("should include both operation and slide index", () => {
			logger.info("测试消息", { operation: "loadSlide", slideIndex: 3 })
			expect(consoleInfoSpy).toHaveBeenCalledWith("[PPTTest] [loadSlide] [Slide 3] 测试消息")
		})

		it("should include metadata in output", () => {
			logger.info("测试消息", {
				operation: "test",
				metadata: { count: 10, status: "success" },
			})
			expect(consoleInfoSpy).toHaveBeenCalledWith("[PPTTest] [test] 测试消息", {
				count: 10,
				status: "success",
			})
		})
	})

	describe("Log Levels", () => {
		it("should respect log level - info level should not show debug", () => {
			logger.updateConfig({ level: "info" })
			logger.debug("不应显示的调试消息")
			expect(consoleDebugSpy).not.toHaveBeenCalled()
		})

		it("should respect log level - info level should show info", () => {
			logger.updateConfig({ level: "info" })
			logger.info("应该显示的信息消息")
			expect(consoleInfoSpy).toHaveBeenCalled()
		})

		it("should respect log level - error level should only show errors", () => {
			logger.updateConfig({ level: "error" })
			logger.debug("不应显示")
			logger.info("不应显示")
			logger.warn("不应显示")
			logger.error("应该显示")

			expect(consoleDebugSpy).not.toHaveBeenCalled()
			expect(consoleInfoSpy).not.toHaveBeenCalled()
			expect(consoleWarnSpy).not.toHaveBeenCalled()
			expect(consoleErrorSpy).toHaveBeenCalled()
		})
	})

	describe("Enable/Disable", () => {
		it("should not log when disabled", () => {
			logger.updateConfig({ enabled: false })
			logger.debug("不应显示")
			logger.info("不应显示")
			logger.warn("不应显示")
			logger.error("不应显示")

			expect(consoleDebugSpy).not.toHaveBeenCalled()
			expect(consoleInfoSpy).not.toHaveBeenCalled()
			expect(consoleWarnSpy).not.toHaveBeenCalled()
			expect(consoleErrorSpy).not.toHaveBeenCalled()
		})
	})

	describe("Performance Timing", () => {
		it("should track operation timing", () => {
			logger.startTiming("testOp")
			// Simulate some work
			const duration = logger.endTiming("testOp")

			expect(duration).toBeGreaterThanOrEqual(0)
			expect(consoleDebugSpy).toHaveBeenCalled()
		})

		it("should warn when ending timing without start", () => {
			logger.endTiming("nonexistentOp")
			expect(consoleWarnSpy).toHaveBeenCalled()
		})

		it("should clear all timings", () => {
			logger.startTiming("op1")
			logger.startTiming("op2")
			logger.clearTimings()

			logger.endTiming("op1")
			expect(consoleWarnSpy).toHaveBeenCalled()
		})
	})

	describe("Operation Logging", () => {
		it("should log operation start", () => {
			logger.logOperationStart("testOperation", { slideIndex: 1 })
			expect(consoleDebugSpy).toHaveBeenCalledWith(
				"[PPTTest] [testOperation] [Slide 1] Starting operation",
			)
		})

		it("should log operation success with timing", () => {
			logger.logOperationStart("testOperation")
			logger.logOperationSuccess("testOperation")

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				expect.stringContaining("[testOperation]"),
				expect.anything(),
			)
		})

		it("should log operation error", () => {
			const error = new Error("测试错误")
			logger.logOperationStart("testOperation")
			logger.logOperationError("testOperation", error)

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("[testOperation]"),
				expect.anything(),
				error,
			)
		})
	})

	describe("Factory Function", () => {
		it("should create logger with createPPTLogger", () => {
			const newLogger = createPPTLogger({ prefix: "[Test]" })
			expect(newLogger).toBeInstanceOf(PPTLoggerService)
		})
	})

	describe("Configuration", () => {
		it("should return current configuration", () => {
			const config = logger.getConfig()
			expect(config.prefix).toBe("[PPTTest]")
			expect(config.enabled).toBe(true)
			expect(config.level).toBe("debug")
		})

		it("should update configuration", () => {
			logger.updateConfig({ prefix: "[NewPrefix]", level: "warn" })
			const config = logger.getConfig()
			expect(config.prefix).toBe("[NewPrefix]")
			expect(config.level).toBe("warn")
		})
	})

	describe("Grouping", () => {
		it("should create log groups", () => {
			const consoleGroupSpy = vi.spyOn(console, "group").mockImplementation(() => {})
			const consoleGroupEndSpy = vi.spyOn(console, "groupEnd").mockImplementation(() => {})

			logger.group("测试分组")
			logger.groupEnd()

			expect(consoleGroupSpy).toHaveBeenCalledWith("[PPTTest] 测试分组")
			expect(consoleGroupEndSpy).toHaveBeenCalled()

			consoleGroupSpy.mockRestore()
			consoleGroupEndSpy.mockRestore()
		})
	})
})
