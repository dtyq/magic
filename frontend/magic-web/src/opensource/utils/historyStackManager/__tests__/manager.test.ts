import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import historyStackManager from "../manager"

// Mock window.history
const mockHistory = {
	pushState: vi.fn(),
	back: vi.fn(),
	state: null as any,
}

Object.defineProperty(window, "history", {
	value: mockHistory,
	writable: true,
})

// Mock addEventListener/removeEventListener
const mockAddEventListener = vi.fn()
const mockRemoveEventListener = vi.fn()
Object.defineProperty(window, "addEventListener", {
	value: mockAddEventListener,
	writable: true,
})
Object.defineProperty(window, "removeEventListener", {
	value: mockRemoveEventListener,
	writable: true,
})

describe("HistoryStackManager", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset history state
		mockHistory.state = null
	})

	afterEach(() => {
		// Clean up any remaining entries
		const stats = historyStackManager.getStats()
		Object.keys(stats.entriesByComponent).forEach((component) => {
			historyStackManager.cleanupComponentEntries(component)
		})
	})

	describe("addVirtualEntry", () => {
		it("should add virtual entry successfully", () => {
			const onBack = vi.fn()
			const entryId = historyStackManager.addVirtualEntry("TestComponent", onBack)

			expect(entryId).toBeDefined()
			expect(entryId).toContain("magic_virtual_entry_TestComponent")
			expect(mockHistory.pushState).toHaveBeenCalledWith(
				expect.objectContaining({
					magic_virtual_entry: true,
					entryId,
					component: "TestComponent",
				}),
				"",
			)
		})

		it("should clean up existing entries from same component", () => {
			const onBack1 = vi.fn()
			const onBack2 = vi.fn()

			const entryId1 = historyStackManager.addVirtualEntry("TestComponent", onBack1)
			const entryId2 = historyStackManager.addVirtualEntry("TestComponent", onBack2)

			expect(entryId1).not.toBe(entryId2)
			expect(mockHistory.pushState).toHaveBeenCalledTimes(2)
		})

		it("should handle pushState errors gracefully", () => {
			mockHistory.pushState.mockImplementationOnce(() => {
				throw new Error("pushState failed")
			})

			const onBack = vi.fn()
			expect(() => {
				historyStackManager.addVirtualEntry("TestComponent", onBack)
			}).toThrow("pushState failed")
		})
	})

	describe("removeVirtualEntry", () => {
		it("should remove virtual entry successfully", () => {
			const onBack = vi.fn()
			const entryId = historyStackManager.addVirtualEntry("TestComponent", onBack)

			// Mock current state to match our entry
			mockHistory.state = { entryId }

			const result = historyStackManager.removeVirtualEntry(entryId)

			expect(result).toBe(true)
			expect(mockHistory.back).toHaveBeenCalled()
		})

		it("should return false for non-existent entry", () => {
			const result = historyStackManager.removeVirtualEntry("non-existent-id")
			expect(result).toBe(false)
		})

		it("should handle removal errors gracefully", () => {
			const onBack = vi.fn()
			const entryId = historyStackManager.addVirtualEntry("TestComponent", onBack)

			// Mock current state to match our entry so removal is attempted
			mockHistory.state = { entryId }

			mockHistory.back.mockImplementationOnce(() => {
				throw new Error("back failed")
			})

			const result = historyStackManager.removeVirtualEntry(entryId)
			expect(result).toBe(false)
		})
	})

	describe("cleanupComponentEntries", () => {
		it("should clean up all entries from specific component", () => {
			const onBack1 = vi.fn()
			const onBack2 = vi.fn()
			const onBack3 = vi.fn()

			historyStackManager.addVirtualEntry("Component1", onBack1)
			historyStackManager.addVirtualEntry("Component1", onBack2)
			historyStackManager.addVirtualEntry("Component2", onBack3)

			let stats = historyStackManager.getStats()
			expect(stats.entriesByComponent.Component1).toBe(1) // Second entry replaces first
			expect(stats.entriesByComponent.Component2).toBe(1)

			historyStackManager.cleanupComponentEntries("Component1")

			stats = historyStackManager.getStats()
			expect(stats.entriesByComponent.Component1).toBeUndefined()
			expect(stats.entriesByComponent.Component2).toBe(1)
		})
	})

	describe("getStats", () => {
		it("should return correct statistics", () => {
			const onBack1 = vi.fn()
			const onBack2 = vi.fn()

			historyStackManager.addVirtualEntry("Component1", onBack1)
			historyStackManager.addVirtualEntry("Component2", onBack2)

			const stats = historyStackManager.getStats()

			expect(stats.totalEntries).toBe(2)
			expect(stats.entriesByComponent.Component1).toBe(1)
			expect(stats.entriesByComponent.Component2).toBe(1)
		})

		it("should return empty stats when no entries exist", () => {
			const stats = historyStackManager.getStats()

			expect(stats.totalEntries).toBe(0)
			expect(stats.entriesByComponent).toEqual({})
		})
	})

	describe("cleanupStaleEntries", () => {
		it("should clean up entries older than 5 minutes", () => {
			const onBack = vi.fn()

			// Mock Date.now to simulate old timestamp
			const originalNow = Date.now
			const fiveMinutesAgo = Date.now() - 6 * 60 * 1000 // 6 minutes ago

			vi.spyOn(Date, "now").mockReturnValue(fiveMinutesAgo)
			const entryId = historyStackManager.addVirtualEntry("TestComponent", onBack)

			// Restore Date.now
			Date.now = originalNow

			// Trigger cleanup
			historyStackManager.cleanupStaleEntries()

			const stats = historyStackManager.getStats()
			expect(stats.totalEntries).toBe(0)
		})
	})
})
