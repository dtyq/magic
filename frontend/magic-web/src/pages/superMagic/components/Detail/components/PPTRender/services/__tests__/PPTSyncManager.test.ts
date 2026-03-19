import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { PPTSyncManager } from "../PPTSyncManager"
import { createPPTLogger } from "../PPTLoggerService"
import type { SlideItem } from "../../PPTSidebar/types"

describe("PPTSyncManager", () => {
	let syncManager: PPTSyncManager
	let logger: ReturnType<typeof createPPTLogger>

	beforeEach(() => {
		vi.useFakeTimers()
		logger = createPPTLogger({ level: "silent" })
		syncManager = new PPTSyncManager(logger, {
			debounceDelay: 500,
			autoSync: true,
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
		syncManager.clear()
	})

	describe("Sync Function Registration", () => {
		it("should register sync and rollback functions", () => {
			const syncFn = vi.fn().mockResolvedValue(undefined)
			const rollbackFn = vi.fn()

			syncManager.registerSyncFunction(syncFn, rollbackFn)

			expect(syncFn).not.toHaveBeenCalled()
			expect(rollbackFn).not.toHaveBeenCalled()
		})
	})

	describe("Debounced State Changes", () => {
		it("should debounce multiple rapid state changes", async () => {
			const syncFn = vi.fn().mockResolvedValue(undefined)
			const rollbackFn = vi.fn()

			syncManager.registerSyncFunction(syncFn, rollbackFn)

			const slides1: SlideItem[] = [{ id: "1", path: "slide1.html", url: "", index: 0 }]
			const slides2: SlideItem[] = [{ id: "2", path: "slide2.html", url: "", index: 0 }]
			const slides3: SlideItem[] = [{ id: "3", path: "slide3.html", url: "", index: 0 }]

			// Record 3 rapid changes
			syncManager.recordChange(slides1)
			syncManager.recordChange(slides2)
			syncManager.recordChange(slides3)

			// Should not sync yet
			expect(syncFn).not.toHaveBeenCalled()

			// Wait for debounce delay
			await vi.advanceTimersByTimeAsync(500)

			// Should only sync once with the last state
			expect(syncFn).toHaveBeenCalledTimes(1)
			expect(syncFn).toHaveBeenCalledWith(slides3)
		})

		it("should replace pending sync with new change", async () => {
			const syncFn = vi.fn().mockResolvedValue(undefined)
			const rollbackFn = vi.fn()

			syncManager.registerSyncFunction(syncFn, rollbackFn)

			const slides1: SlideItem[] = [{ id: "1", path: "slide1.html", url: "", index: 0 }]
			const slides2: SlideItem[] = [{ id: "2", path: "slide2.html", url: "", index: 0 }]

			syncManager.recordChange(slides1)
			await vi.advanceTimersByTimeAsync(250)

			syncManager.recordChange(slides2)
			await vi.advanceTimersByTimeAsync(500)

			expect(syncFn).toHaveBeenCalledTimes(1)
			expect(syncFn).toHaveBeenCalledWith(slides2)
		})
	})

	describe("Sync Execution", () => {
		it("should execute sync function after debounce delay", async () => {
			const syncFn = vi.fn().mockResolvedValue(undefined)
			const rollbackFn = vi.fn()

			syncManager.registerSyncFunction(syncFn, rollbackFn)

			const slides: SlideItem[] = [{ id: "1", path: "slide1.html", url: "", index: 0 }]

			syncManager.recordChange(slides)

			await vi.advanceTimersByTimeAsync(500)

			expect(syncFn).toHaveBeenCalledWith(slides)
			expect(rollbackFn).not.toHaveBeenCalled()
		})

		it("should execute rollback on sync failure", async () => {
			const error = new Error("Sync failed")
			const syncFn = vi.fn().mockRejectedValue(error)
			const rollbackFn = vi.fn()

			syncManager.registerSyncFunction(syncFn, rollbackFn)

			const slides: SlideItem[] = [{ id: "1", path: "slide1.html", url: "", index: 0 }]

			syncManager.recordChange(slides)

			await vi.advanceTimersByTimeAsync(500)

			expect(syncFn).toHaveBeenCalledWith(slides)
			expect(rollbackFn).toHaveBeenCalledWith(slides)
		})

		it("should not execute sync if not registered", async () => {
			const slides: SlideItem[] = [{ id: "1", path: "slide1.html", url: "", index: 0 }]

			syncManager.recordChange(slides)

			await vi.advanceTimersByTimeAsync(500)

			// Should complete without error
			expect(syncManager.syncing).toBe(false)
		})
	})

	describe("Force Sync", () => {
		it("should sync immediately without waiting for debounce", async () => {
			const syncFn = vi.fn().mockResolvedValue(undefined)
			const rollbackFn = vi.fn()

			syncManager.registerSyncFunction(syncFn, rollbackFn)

			const slides: SlideItem[] = [{ id: "1", path: "slide1.html", url: "", index: 0 }]

			syncManager.recordChange(slides)

			// Force sync immediately
			await syncManager.forceSync()

			expect(syncFn).toHaveBeenCalledWith(slides)
		})
	})

	describe("State Management", () => {
		it("should track pending state", () => {
			const slides: SlideItem[] = [{ id: "1", path: "slide1.html", url: "", index: 0 }]

			expect(syncManager.isPending).toBe(false)

			syncManager.recordChange(slides)

			expect(syncManager.isPending).toBe(true)
		})

		it("should track syncing state", async () => {
			const syncFn = vi.fn(async () => {
				await new Promise((resolve) => setTimeout(resolve, 100))
			})
			const rollbackFn = vi.fn()

			syncManager.registerSyncFunction(syncFn, rollbackFn)

			const slides: SlideItem[] = [{ id: "1", path: "slide1.html", url: "", index: 0 }]

			syncManager.recordChange(slides)

			await vi.advanceTimersByTimeAsync(500)
			expect(syncManager.syncing).toBe(true)

			await vi.advanceTimersByTimeAsync(100)
			expect(syncManager.syncing).toBe(false)
		})

		it("should clear pending state", () => {
			const slides: SlideItem[] = [{ id: "1", path: "slide1.html", url: "", index: 0 }]

			syncManager.recordChange(slides)

			expect(syncManager.isPending).toBe(true)

			syncManager.clear()

			expect(syncManager.isPending).toBe(false)
		})

		it("should reset manager state", () => {
			const syncFn = vi.fn().mockResolvedValue(undefined)
			const rollbackFn = vi.fn()

			syncManager.registerSyncFunction(syncFn, rollbackFn)

			const slides: SlideItem[] = [{ id: "1", path: "slide1.html", url: "", index: 0 }]

			syncManager.recordChange(slides)

			syncManager.reset()

			expect(syncManager.isPending).toBe(false)
		})
	})

	describe("Wait for Completion", () => {
		it("should wait for all pending operations to complete", async () => {
			const syncFn = vi.fn().mockResolvedValue(undefined)
			const rollbackFn = vi.fn()

			syncManager.registerSyncFunction(syncFn, rollbackFn)

			const slides: SlideItem[] = [{ id: "1", path: "slide1.html", url: "", index: 0 }]

			syncManager.recordChange(slides)

			const waitPromise = syncManager.waitForCompletion()

			await vi.advanceTimersByTimeAsync(600)

			await waitPromise

			expect(syncFn).toHaveBeenCalledTimes(1)
			expect(syncManager.isPending).toBe(false)
			expect(syncManager.syncing).toBe(false)
		})
	})

	describe("Auto Sync Configuration", () => {
		it("should not record changes when auto sync is disabled", () => {
			const disabledSyncManager = new PPTSyncManager(logger, {
				debounceDelay: 500,
				autoSync: false,
			})

			const slides: SlideItem[] = [{ id: "1", path: "slide1.html", url: "", index: 0 }]

			disabledSyncManager.recordChange(slides)

			expect(disabledSyncManager.isPending).toBe(false)
		})
	})

	describe("Performance", () => {
		it("should handle many rapid changes efficiently", async () => {
			const syncFn = vi.fn().mockResolvedValue(undefined)
			const rollbackFn = vi.fn()

			syncManager.registerSyncFunction(syncFn, rollbackFn)

			// Simulate 100 rapid changes
			for (let i = 0; i < 100; i++) {
				const slides: SlideItem[] = [
					{ id: `${i}`, path: `slide${i}.html`, url: "", index: 0 },
				]
				syncManager.recordChange(slides)
			}

			await vi.advanceTimersByTimeAsync(500)

			// Should only sync once with the last state
			expect(syncFn).toHaveBeenCalledTimes(1)
		})
	})
})
