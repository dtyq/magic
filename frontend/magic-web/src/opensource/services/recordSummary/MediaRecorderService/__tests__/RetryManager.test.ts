/**
 * Unit tests for RetryManager
 * RetryManager 单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { RetryManager } from "../managers/RetryManager"
import { PermissionDeniedError } from "../types/RecorderErrors"
import type { LoggerInterface } from "../types/RecorderDependencies"

describe("RetryManager", () => {
	let mockLogger: LoggerInterface

	beforeEach(() => {
		mockLogger = {
			log: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		}
	})

	it("should succeed on first attempt", async () => {
		const manager = new RetryManager({}, mockLogger)

		const operation = vi.fn().mockResolvedValue("success")
		const result = await manager.execute(operation, "TestOperation")

		expect(result.success).toBe(true)
		expect(result.result).toBe("success")
		expect(result.attempts).toBe(1)
		expect(operation).toHaveBeenCalledTimes(1)
	})

	it("should retry on failure and succeed", async () => {
		const manager = new RetryManager({ maxAttempts: 3 }, mockLogger)

		const operation = vi
			.fn()
			.mockRejectedValueOnce(new Error("Attempt 1 failed"))
			.mockRejectedValueOnce(new Error("Attempt 2 failed"))
			.mockResolvedValue("success")

		const result = await manager.execute(operation, "TestOperation")

		expect(result.success).toBe(true)
		expect(result.result).toBe("success")
		expect(result.attempts).toBe(3)
		expect(operation).toHaveBeenCalledTimes(3)
	})

	it("should fail after max retries", async () => {
		const manager = new RetryManager({ maxAttempts: 3, baseDelayMs: 10 }, mockLogger)

		const operation = vi.fn().mockRejectedValue(new Error("Always fails"))

		const result = await manager.execute(operation, "TestOperation")

		expect(result.success).toBe(false)
		expect(result.error).toBeDefined()
		expect(result.attempts).toBe(3)
		expect(operation).toHaveBeenCalledTimes(3)
	})

	it("should not retry on permission denied", async () => {
		const manager = new RetryManager({ maxAttempts: 5 }, mockLogger)

		const operation = vi.fn().mockRejectedValue(new PermissionDeniedError("User denied"))

		const result = await manager.execute(operation, "TestOperation")

		expect(result.success).toBe(false)
		expect(result.attempts).toBe(1)
		expect(operation).toHaveBeenCalledTimes(1)
	})

	it("should use exponential backoff", async () => {
		const manager = new RetryManager(
			{ maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 500 },
			mockLogger,
		)

		const operation = vi
			.fn()
			.mockRejectedValueOnce(new Error("Fail 1"))
			.mockRejectedValueOnce(new Error("Fail 2"))
			.mockResolvedValue("success")

		const startTime = Date.now()
		await manager.execute(operation, "TestOperation")
		const duration = Date.now() - startTime

		// Should have delays: 100ms + 200ms = 300ms (approximately)
		expect(duration).toBeGreaterThanOrEqual(250)
	})

	it("should respect custom shouldRetry function", async () => {
		const manager = new RetryManager(
			{
				maxAttempts: 5,
				baseDelayMs: 10,
				shouldRetry: (error: Error) => !error.message.includes("critical"),
			},
			mockLogger,
		)

		const operation = vi.fn().mockRejectedValue(new Error("critical failure"))

		const result = await manager.execute(operation, "TestOperation")

		expect(result.success).toBe(false)
		expect(result.attempts).toBe(1)
		expect(operation).toHaveBeenCalledTimes(1)
	})

	it("should get retry configuration", () => {
		const config = {
			maxAttempts: 10,
			baseDelayMs: 500,
			maxDelayMs: 3000,
		}
		const manager = new RetryManager(config, mockLogger)

		const retrievedConfig = manager.getConfig()

		expect(retrievedConfig.maxAttempts).toBe(10)
		expect(retrievedConfig.baseDelayMs).toBe(500)
		expect(retrievedConfig.maxDelayMs).toBe(3000)
	})
})
