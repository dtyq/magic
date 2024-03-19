import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { DraftCleanupScheduler } from "../draftService/DraftCleanupScheduler"
import type { DraftCleanupConfig } from "../draftService/DraftCleanupScheduler"
import type { DraftServiceInterface } from "../../types"

// Mock Logger
vi.mock("@/opensource/utils/log/Logger", () => ({
	default: class MockLogger {
		constructor() {}
		log = vi.fn()
		error = vi.fn()
		warn = vi.fn()
	},
}))

describe("DraftCleanupScheduler", () => {
	let mockDraftService: DraftServiceInterface
	let scheduler: DraftCleanupScheduler

	beforeEach(() => {
		vi.useFakeTimers()

		mockDraftService = {
			cleanupExpiredVersions: vi.fn().mockResolvedValue(undefined),
		} as unknown as DraftServiceInterface

		vi.clearAllMocks()
	})

	afterEach(() => {
		if (scheduler) {
			scheduler.destroy()
		}
		vi.useRealTimers()
	})

	describe("Configuration", () => {
		it("should use default configuration when no config provided", () => {
			scheduler = new DraftCleanupScheduler(mockDraftService)
			const config = scheduler.getConfig()

			expect(config).toEqual({
				cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
				retentionDays: 7,
				runImmediately: false,
				enabled: true,
			})
		})

		it("should merge custom configuration with defaults", () => {
			const customConfig: DraftCleanupConfig = {
				cleanupInterval: 12 * 60 * 60 * 1000, // 12 hours
				retentionDays: 3,
				runImmediately: true,
			}

			scheduler = new DraftCleanupScheduler(mockDraftService, customConfig)
			const config = scheduler.getConfig()

			expect(config).toEqual({
				cleanupInterval: 12 * 60 * 60 * 1000,
				retentionDays: 3,
				runImmediately: true,
				enabled: true, // Default value
			})
		})

		it("should update configuration dynamically", () => {
			scheduler = new DraftCleanupScheduler(mockDraftService)

			scheduler.updateConfig({
				retentionDays: 14,
				cleanupInterval: 6 * 60 * 60 * 1000,
			})

			const config = scheduler.getConfig()
			expect(config.retentionDays).toBe(14)
			expect(config.cleanupInterval).toBe(6 * 60 * 60 * 1000)
		})
	})

	describe("Scheduler Lifecycle", () => {
		it("should not start when disabled", () => {
			scheduler = new DraftCleanupScheduler(mockDraftService, { enabled: false })
			scheduler.start()

			const status = scheduler.getStatus()
			expect(status.isRunning).toBe(false)
		})

		it("should start and stop correctly", () => {
			scheduler = new DraftCleanupScheduler(mockDraftService)

			// Initially not running
			expect(scheduler.getStatus().isRunning).toBe(false)

			// Start scheduler
			scheduler.start()
			expect(scheduler.getStatus().isRunning).toBe(true)

			// Stop scheduler
			scheduler.stop()
			expect(scheduler.getStatus().isRunning).toBe(false)
		})

		it("should warn when starting already running scheduler", () => {
			scheduler = new DraftCleanupScheduler(mockDraftService)

			scheduler.start()
			scheduler.start() // Second start should warn

			// Should still be running
			expect(scheduler.getStatus().isRunning).toBe(true)
		})

		it("should handle stop when not running", () => {
			scheduler = new DraftCleanupScheduler(mockDraftService)

			// Should not throw
			expect(() => scheduler.stop()).not.toThrow()
		})
	})

	describe("Immediate Cleanup", () => {
		it("should run cleanup immediately when configured", async () => {
			scheduler = new DraftCleanupScheduler(mockDraftService, { runImmediately: true })

			scheduler.start()

			expect(mockDraftService.cleanupExpiredVersions).toHaveBeenCalledWith(7) // Default retention days
		})

		it("should not run cleanup immediately by default", () => {
			scheduler = new DraftCleanupScheduler(mockDraftService)

			scheduler.start()

			expect(mockDraftService.cleanupExpiredVersions).not.toHaveBeenCalled()
		})
	})

	describe("Manual Cleanup", () => {
		it("should run manual cleanup with correct retention days", async () => {
			scheduler = new DraftCleanupScheduler(mockDraftService, { retentionDays: 5 })

			await scheduler.runCleanup()

			expect(mockDraftService.cleanupExpiredVersions).toHaveBeenCalledWith(5)
		})

		it("should track last cleanup time", async () => {
			scheduler = new DraftCleanupScheduler(mockDraftService)
			const beforeCleanup = Date.now()

			await scheduler.runCleanup()

			const status = scheduler.getStatus()
			expect(status.lastCleanupTime).toBeGreaterThanOrEqual(beforeCleanup)
			expect(status.lastCleanupTime).toBeLessThanOrEqual(Date.now())
		})

		it("should handle cleanup errors", async () => {
			const error = new Error("Cleanup failed")
			mockDraftService.cleanupExpiredVersions = vi.fn().mockRejectedValue(error)

			scheduler = new DraftCleanupScheduler(mockDraftService)

			await expect(scheduler.runCleanup()).rejects.toThrow("Cleanup failed")
		})
	})

	describe("Scheduled Cleanup", () => {
		it("should schedule cleanup at configured interval", async () => {
			const interval = 60 * 1000 // 1 minute
			scheduler = new DraftCleanupScheduler(mockDraftService, {
				cleanupInterval: interval,
				retentionDays: 3,
			})

			scheduler.start()

			// Fast-forward time to trigger scheduled cleanup
			await vi.advanceTimersByTimeAsync(interval)

			expect(mockDraftService.cleanupExpiredVersions).toHaveBeenCalledWith(3)
		})

		it("should reschedule after successful cleanup", async () => {
			const interval = 60 * 1000
			scheduler = new DraftCleanupScheduler(mockDraftService, { cleanupInterval: interval })

			scheduler.start()

			// First scheduled cleanup
			await vi.advanceTimersByTimeAsync(interval)
			expect(mockDraftService.cleanupExpiredVersions).toHaveBeenCalledTimes(1)

			// Second scheduled cleanup
			await vi.advanceTimersByTimeAsync(interval)
			expect(mockDraftService.cleanupExpiredVersions).toHaveBeenCalledTimes(2)
		})

		it("should continue scheduling even if cleanup fails", async () => {
			const interval = 60 * 1000
			mockDraftService.cleanupExpiredVersions = vi
				.fn()
				.mockRejectedValueOnce(new Error("First failure"))
				.mockResolvedValueOnce(undefined)

			scheduler = new DraftCleanupScheduler(mockDraftService, { cleanupInterval: interval })
			scheduler.start()

			// First cleanup fails
			await vi.advanceTimersByTimeAsync(interval)
			expect(mockDraftService.cleanupExpiredVersions).toHaveBeenCalledTimes(1)

			// Second cleanup succeeds
			await vi.advanceTimersByTimeAsync(interval)
			expect(mockDraftService.cleanupExpiredVersions).toHaveBeenCalledTimes(2)
		})

		it("should adjust delay based on elapsed time since last cleanup", async () => {
			const interval = 60 * 1000
			scheduler = new DraftCleanupScheduler(mockDraftService, { cleanupInterval: interval })

			// Run manual cleanup first
			await scheduler.runCleanup()

			// Start scheduler (should adjust delay)
			scheduler.start()

			// Should wait full interval since we just ran cleanup
			await vi.advanceTimersByTimeAsync(interval - 1000)
			expect(mockDraftService.cleanupExpiredVersions).toHaveBeenCalledTimes(1) // Only manual cleanup

			await vi.advanceTimersByTimeAsync(1000)
			expect(mockDraftService.cleanupExpiredVersions).toHaveBeenCalledTimes(2) // Manual + scheduled
		})
	})

	describe("Cleanup Due Detection", () => {
		it("should detect cleanup is due when never run", () => {
			scheduler = new DraftCleanupScheduler(mockDraftService)

			expect(scheduler.isCleanupDue()).toBe(true)
		})

		it("should detect cleanup is due after interval", async () => {
			const interval = 60 * 1000
			scheduler = new DraftCleanupScheduler(mockDraftService, { cleanupInterval: interval })

			// Run cleanup
			await scheduler.runCleanup()
			expect(scheduler.isCleanupDue()).toBe(false)

			// Fast-forward time
			vi.advanceTimersByTime(interval + 1000)
			expect(scheduler.isCleanupDue()).toBe(true)
		})

		it("should detect cleanup is not due before interval", async () => {
			const interval = 60 * 1000
			scheduler = new DraftCleanupScheduler(mockDraftService, { cleanupInterval: interval })

			await scheduler.runCleanup()
			expect(scheduler.isCleanupDue()).toBe(false)

			vi.advanceTimersByTime(interval - 1000)
			expect(scheduler.isCleanupDue()).toBe(false)
		})
	})

	describe("Status Reporting", () => {
		it("should report correct status", async () => {
			const config = {
				cleanupInterval: 30 * 1000,
				retentionDays: 5,
				runImmediately: false,
				enabled: true,
			}
			scheduler = new DraftCleanupScheduler(mockDraftService, config)

			// Initial status
			let status = scheduler.getStatus()
			expect(status.isRunning).toBe(false)
			expect(status.lastCleanupTime).toBe(0)
			expect(status.nextCleanupTime).toBeNull()
			expect(status.config).toEqual(config)

			// After starting
			scheduler.start()
			await scheduler.runCleanup()

			status = scheduler.getStatus()
			expect(status.isRunning).toBe(true)
			expect(status.lastCleanupTime).toBeGreaterThan(0)
			expect(status.nextCleanupTime).toBeGreaterThan(status.lastCleanupTime)
		})

		it("should calculate next cleanup time correctly", async () => {
			const interval = 60 * 1000
			scheduler = new DraftCleanupScheduler(mockDraftService, { cleanupInterval: interval })

			scheduler.start()
			const beforeCleanup = Date.now()
			await scheduler.runCleanup()

			const status = scheduler.getStatus()
			const expectedNextCleanup = status.lastCleanupTime + interval

			expect(status.nextCleanupTime).toBe(expectedNextCleanup)
			expect(status.nextCleanupTime).toBeGreaterThan(beforeCleanup + interval - 1000)
		})
	})

	describe("Configuration Updates", () => {
		it("should restart scheduler when configuration is updated while running", () => {
			scheduler = new DraftCleanupScheduler(mockDraftService)
			scheduler.start()

			expect(scheduler.getStatus().isRunning).toBe(true)

			scheduler.updateConfig({ retentionDays: 14 })

			expect(scheduler.getStatus().isRunning).toBe(true)
			expect(scheduler.getConfig().retentionDays).toBe(14)
		})

		it("should not start scheduler when configuration is updated while stopped", () => {
			scheduler = new DraftCleanupScheduler(mockDraftService)

			expect(scheduler.getStatus().isRunning).toBe(false)

			scheduler.updateConfig({ retentionDays: 14 })

			expect(scheduler.getStatus().isRunning).toBe(false)
			expect(scheduler.getConfig().retentionDays).toBe(14)
		})
	})

	describe("Cleanup and Destruction", () => {
		it("should stop scheduler when destroyed", () => {
			scheduler = new DraftCleanupScheduler(mockDraftService)
			scheduler.start()

			expect(scheduler.getStatus().isRunning).toBe(true)

			scheduler.destroy()

			expect(scheduler.getStatus().isRunning).toBe(false)
		})

		it("should not throw when destroying stopped scheduler", () => {
			scheduler = new DraftCleanupScheduler(mockDraftService)

			expect(() => scheduler.destroy()).not.toThrow()
		})
	})
})
