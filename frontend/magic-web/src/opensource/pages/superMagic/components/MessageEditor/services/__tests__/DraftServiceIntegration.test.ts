import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { DraftService } from "../draftService/draftService"
import type {
	DraftServiceInterface,
	DraftCleanupConfig,
} from "../draftService/DraftCleanupScheduler"

// Mock Logger
vi.mock("@/opensource/utils/log/Logger", () => ({
	default: class MockLogger {
		constructor() {}
		log = vi.fn()
		error = vi.fn()
		warn = vi.fn()
	},
}))

// Mock isIndexedDBAvailable
vi.mock("../draftService", () => ({
	isIndexedDBAvailable: vi.fn(() => true),
}))

// Create mock storage factory function
const createMockStorage = () => ({
	saveDraft: vi.fn().mockResolvedValue(undefined),
	loadDraft: vi.fn().mockResolvedValue(null),
	deleteDraft: vi.fn().mockResolvedValue(undefined),
	clearAllDrafts: vi.fn().mockResolvedValue(undefined),
	saveDraftVersion: vi.fn().mockResolvedValue(undefined),
	loadDraftVersions: vi.fn().mockResolvedValue([]),
	loadDraftByVersion: vi.fn().mockResolvedValue(null),
	deleteDraftVersion: vi.fn().mockResolvedValue(undefined),
	deleteDraftVersions: vi.fn().mockResolvedValue(undefined),
	loadLatestDraftVersion: vi.fn().mockResolvedValue(null),
	cleanupExpiredVersions: vi.fn().mockResolvedValue(undefined),
	close: vi.fn(),
})

// Mock storage classes
vi.mock("../draftService/IndexedDBDraftService", () => ({
	IndexedDBDraftService: vi.fn(() => createMockStorage()),
}))

vi.mock("../draftService/LocalStorageDraftService", () => ({
	LocalStorageDraftService: vi.fn(() => createMockStorage()),
}))

describe("DraftService Integration with Cleanup Scheduler", () => {
	let draftService: DraftService

	beforeEach(() => {
		vi.useFakeTimers()

		// Clear all mock calls
		vi.clearAllMocks()
	})

	afterEach(() => {
		if (draftService) {
			draftService.close()
		}
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	describe("Initialization", () => {
		it("should initialize with default cleanup configuration", () => {
			draftService = new DraftService()

			const status = draftService.getCleanupStatus()
			expect(status.config).toEqual({
				cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
				retentionDays: 7,
				runImmediately: false,
				enabled: true,
			})
		})

		it("should initialize with custom cleanup configuration", () => {
			const customConfig: DraftCleanupConfig = {
				cleanupInterval: 12 * 60 * 60 * 1000, // 12 hours
				retentionDays: 3,
				runImmediately: true,
				enabled: false,
			}

			draftService = new DraftService(customConfig)

			const status = draftService.getCleanupStatus()
			expect(status.config).toEqual(customConfig)
		})

		it("should not start scheduler automatically", () => {
			draftService = new DraftService()

			const status = draftService.getCleanupStatus()
			expect(status.isRunning).toBe(false)
		})
	})

	describe("Cleanup Scheduler Management", () => {
		beforeEach(() => {
			draftService = new DraftService({
				cleanupInterval: 60 * 1000, // 1 minute for testing
				retentionDays: 5,
			})
		})

		it("should start and stop cleanup scheduler", () => {
			expect(draftService.getCleanupStatus().isRunning).toBe(false)

			draftService.startCleanupScheduler()
			expect(draftService.getCleanupStatus().isRunning).toBe(true)

			draftService.stopCleanupScheduler()
			expect(draftService.getCleanupStatus().isRunning).toBe(false)
		})

		it("should run scheduled cleanup with configured retention days", async () => {
			// Spy on the storage instance created by DraftService
			const storageSpy = vi.spyOn((draftService as any).storage, "cleanupExpiredVersions")

			draftService.startCleanupScheduler()

			// Fast-forward to trigger scheduled cleanup
			await vi.advanceTimersByTimeAsync(60 * 1000)

			expect(storageSpy).toHaveBeenCalledWith(5)
		})

		it("should update cleanup configuration dynamically", () => {
			draftService.startCleanupScheduler()

			draftService.updateCleanupConfig({
				retentionDays: 14,
				cleanupInterval: 30 * 1000,
			})

			const status = draftService.getCleanupStatus()
			expect(status.config.retentionDays).toBe(14)
			expect(status.config.cleanupInterval).toBe(30 * 1000)
			expect(status.isRunning).toBe(true) // Should remain running
		})
	})

	describe("Manual Cleanup", () => {
		beforeEach(() => {
			draftService = new DraftService({ retentionDays: 10 })
		})

		it("should run manual cleanup with scheduler configuration", async () => {
			// Spy on the storage instance created by DraftService
			const storageSpy = vi.spyOn((draftService as any).storage, "cleanupExpiredVersions")

			await draftService.runCleanup()

			expect(storageSpy).toHaveBeenCalledWith(10)
		})

		it("should use provided retentionDays over scheduler configuration", async () => {
			const storageSpy = vi.spyOn((draftService as any).storage, "cleanupExpiredVersions")

			await draftService.cleanupExpiredVersions(3)

			expect(storageSpy).toHaveBeenCalledWith(3)
		})

		it("should fallback to scheduler config when no retentionDays provided", async () => {
			const storageSpy = vi.spyOn((draftService as any).storage, "cleanupExpiredVersions")

			await draftService.cleanupExpiredVersions()

			expect(storageSpy).toHaveBeenCalledWith(10)
		})

		it("should handle cleanup errors gracefully", async () => {
			const error = new Error("Cleanup failed")
			const storageSpy = vi
				.spyOn((draftService as any).storage, "cleanupExpiredVersions")
				.mockRejectedValue(error)

			await expect(draftService.runCleanup()).rejects.toThrow("Cleanup failed")
			expect(storageSpy).toHaveBeenCalledWith(10)
		})
	})

	describe("Cleanup Due Detection", () => {
		beforeEach(() => {
			draftService = new DraftService({
				cleanupInterval: 60 * 1000, // 1 minute
				retentionDays: 7,
			})
		})

		it("should detect when cleanup is due", async () => {
			const storageSpy = vi.spyOn((draftService as any).storage, "cleanupExpiredVersions")

			expect(draftService.isCleanupDue()).toBe(true) // Never run before

			await draftService.runCleanup()
			expect(draftService.isCleanupDue()).toBe(false) // Just ran
			expect(storageSpy).toHaveBeenCalledWith(7)

			vi.advanceTimersByTime(61 * 1000) // More than interval
			expect(draftService.isCleanupDue()).toBe(true) // Due again
		})
	})

	describe("Storage Backend Integration", () => {
		it("should delegate cleanupExpiredVersions to storage backend", async () => {
			draftService = new DraftService()
			const storageSpy = vi.spyOn((draftService as any).storage, "cleanupExpiredVersions")

			await draftService.cleanupExpiredVersions(5)

			expect(storageSpy).toHaveBeenCalledWith(5)
		})

		it("should handle storage backend without cleanupExpiredVersions", async () => {
			draftService = new DraftService()

			// Mock the storage to not have cleanupExpiredVersions method
			const limitedStorage = {
				...(draftService as any).storage,
				cleanupExpiredVersions: undefined,
			} as any
			;(draftService as any).storage = limitedStorage

			// Should not throw
			await expect(draftService.cleanupExpiredVersions()).resolves.not.toThrow()
		})
	})

	describe("Service Lifecycle", () => {
		it("should stop scheduler when service is closed", () => {
			draftService = new DraftService()
			const closeSpy = vi.spyOn((draftService as any).storage, "close")

			draftService.startCleanupScheduler()

			expect(draftService.getCleanupStatus().isRunning).toBe(true)

			draftService.close()

			expect(draftService.getCleanupStatus().isRunning).toBe(false)
			expect(closeSpy).toHaveBeenCalled()
		})

		it("should handle close when storage doesn't support close method", () => {
			draftService = new DraftService()

			// Mock the storage to not have close method
			const storageWithoutClose = {
				...(draftService as any).storage,
				close: undefined,
			} as any
			;(draftService as any).storage = storageWithoutClose
			draftService.startCleanupScheduler()

			// Should not throw
			expect(() => draftService.close()).not.toThrow()
			expect(draftService.getCleanupStatus().isRunning).toBe(false)
		})
	})

	describe("Edge Cases", () => {
		it("should handle zero retention days", async () => {
			draftService = new DraftService({ retentionDays: 0 })
			const storageSpy = vi.spyOn((draftService as any).storage, "cleanupExpiredVersions")

			await draftService.runCleanup()

			expect(storageSpy).toHaveBeenCalledWith(0)
		})

		it("should handle negative retention days", async () => {
			draftService = new DraftService({ retentionDays: -1 })
			const storageSpy = vi.spyOn((draftService as any).storage, "cleanupExpiredVersions")

			await draftService.runCleanup()

			expect(storageSpy).toHaveBeenCalledWith(-1)
		})

		it("should handle very large retention days", async () => {
			const largeValue = 365 * 10 // 10 years
			draftService = new DraftService({ retentionDays: largeValue })
			const storageSpy = vi.spyOn((draftService as any).storage, "cleanupExpiredVersions")

			await draftService.runCleanup()

			expect(storageSpy).toHaveBeenCalledWith(largeValue)
		})
	})

	describe("Multiple Service Instances", () => {
		it("should handle multiple service instances independently", () => {
			const service1 = new DraftService({ retentionDays: 3 })
			const service2 = new DraftService({ retentionDays: 14 })

			expect(service1.getCleanupStatus().config.retentionDays).toBe(3)
			expect(service2.getCleanupStatus().config.retentionDays).toBe(14)

			service1.startCleanupScheduler()
			expect(service1.getCleanupStatus().isRunning).toBe(true)
			expect(service2.getCleanupStatus().isRunning).toBe(false)

			service1.close()
			service2.close()
		})
	})
})
