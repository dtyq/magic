import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { ResizablePanelStore, PanelConfig } from "../ResizablePanelStore"

describe("ResizablePanelStore", () => {
	let store: ResizablePanelStore
	const mockPanelConfig: PanelConfig = {
		storageKey: "test-panel-width",
		defaultWidth: 400,
		minWidth: 200,
		maxWidth: 800,
	}

	beforeEach(() => {
		store = new ResizablePanelStore()
		localStorage.clear()
	})

	afterEach(() => {
		localStorage.clear()
	})

	describe("Container Width Management", () => {
		it("should initialize with zero container width", () => {
			expect(store.containerWidth).toBe(0)
		})

		it("should update container width", () => {
			store.setContainerWidth(1200)
			expect(store.containerWidth).toBe(1200)
		})
	})

	describe("Panel Size Calculations", () => {
		beforeEach(() => {
			store.setContainerWidth(1200)
		})

		it("should calculate default size as percentage", () => {
			const percentage = store.getDefaultSize(mockPanelConfig.defaultWidth)
			expect(percentage).toBeCloseTo(33.33, 1)
		})

		it("should calculate min size as percentage", () => {
			const percentage = store.getMinSize(mockPanelConfig.minWidth)
			expect(percentage).toBeCloseTo(16.67, 1)
		})

		it("should calculate max size as percentage", () => {
			const percentage = store.getMaxSize(mockPanelConfig.maxWidth)
			expect(percentage).toBeCloseTo(66.67, 1)
		})

		it("should return default percentage when container width is zero", () => {
			const newStore = new ResizablePanelStore()
			const percentage = newStore.getDefaultSize(400)
			expect(percentage).toBe(33.33)
		})
	})

	describe("Get Panel Size", () => {
		beforeEach(() => {
			store.setContainerWidth(1200)
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("should return default size when no saved value exists", () => {
			const size = store.getPanelSize(mockPanelConfig)
			expect(size).toBeCloseTo(33.33, 1)
		})

		it("should return saved percentage from localStorage", () => {
			localStorage.setItem(mockPanelConfig.storageKey, "50")
			const size = store.getPanelSize(mockPanelConfig)
			expect(size).toBe(50)
		})

		it("should return cached size from memory", () => {
			store.updatePanelSize(mockPanelConfig.storageKey, 40)
			// Wait for throttle
			vi.advanceTimersByTime(20)
			const size = store.getPanelSize(mockPanelConfig)
			expect(size).toBe(40)
		})

		it("should handle invalid localStorage value", () => {
			localStorage.setItem(mockPanelConfig.storageKey, "invalid")
			const size = store.getPanelSize(mockPanelConfig)
			expect(size).toBeCloseTo(33.33, 1)
		})

		it("should migrate legacy pixel values to percentage", () => {
			// Legacy pixel value (> 100 indicates pixels)
			localStorage.setItem(mockPanelConfig.storageKey, "600")
			const size = store.getPanelSize(mockPanelConfig)
			expect(size).toBe(50) // 600/1200 * 100 = 50%
		})
	})

	describe("Update Panel Size (During Dragging)", () => {
		beforeEach(() => {
			store.setContainerWidth(1200)
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("should update memory immediately during drag", () => {
			store.updatePanelSize(mockPanelConfig.storageKey, 50)
			expect(store.panelSizes.get(mockPanelConfig.storageKey)).toBe(50)
		})

		it("should not write to localStorage during drag", () => {
			store.updatePanelSize(mockPanelConfig.storageKey, 50)
			expect(localStorage.getItem(mockPanelConfig.storageKey)).toBeNull()
		})

		it("should save to localStorage only after dragging stops", () => {
			store.updatePanelSize(mockPanelConfig.storageKey, 50)
			expect(localStorage.getItem(mockPanelConfig.storageKey)).toBeNull()

			// Simulate dragging stopped (300ms passed)
			vi.advanceTimersByTime(300)
			expect(localStorage.getItem(mockPanelConfig.storageKey)).toBe("50")
		})

		it("should cancel previous pending save on continuous drag", () => {
			store.updatePanelSize(mockPanelConfig.storageKey, 40)
			vi.advanceTimersByTime(100)

			store.updatePanelSize(mockPanelConfig.storageKey, 50)
			vi.advanceTimersByTime(200)

			// Should not have saved yet
			expect(localStorage.getItem(mockPanelConfig.storageKey)).toBeNull()

			vi.advanceTimersByTime(100)
			// Should only save the latest value
			expect(localStorage.getItem(mockPanelConfig.storageKey)).toBe("50")
		})

		it("should store percentage values directly", () => {
			store.updatePanelSize(mockPanelConfig.storageKey, 33.333)
			expect(store.panelSizes.get(mockPanelConfig.storageKey)).toBe(33.333)
		})

		it("should update even when container width is zero", () => {
			const newStore = new ResizablePanelStore()
			newStore.updatePanelSize(mockPanelConfig.storageKey, 50)
			// Should still update memory with percentage
			expect(newStore.panelSizes.get(mockPanelConfig.storageKey)).toBe(50)
		})

		it("should throttle rapid updates to ~60fps", () => {
			// First update should go through
			store.updatePanelSize(mockPanelConfig.storageKey, 40)
			expect(store.panelSizes.get(mockPanelConfig.storageKey)).toBe(40)

			// Immediate second update should be throttled
			vi.advanceTimersByTime(5)
			store.updatePanelSize(mockPanelConfig.storageKey, 50)
			// Should still be the old value
			expect(store.panelSizes.get(mockPanelConfig.storageKey)).toBe(40)

			// After throttle delay, update should go through
			vi.advanceTimersByTime(20)
			store.updatePanelSize(mockPanelConfig.storageKey, 60)
			expect(store.panelSizes.get(mockPanelConfig.storageKey)).toBe(60)
		})

		it("should still schedule save even when throttled", () => {
			store.updatePanelSize(mockPanelConfig.storageKey, 40)

			// Rapid updates that get throttled
			vi.advanceTimersByTime(5)
			store.updatePanelSize(mockPanelConfig.storageKey, 50)

			// Should still save the latest value after delay
			vi.advanceTimersByTime(500)
			expect(localStorage.getItem(mockPanelConfig.storageKey)).toBe("50")
		})
	})

	describe("Persist Panel Size (Force Save)", () => {
		beforeEach(() => {
			store.setContainerWidth(1200)
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("should immediately persist panel size to localStorage", () => {
			store.updatePanelSize(mockPanelConfig.storageKey, 50)
			expect(localStorage.getItem(mockPanelConfig.storageKey)).toBeNull()

			store.persistPanelSize(mockPanelConfig.storageKey)
			expect(localStorage.getItem(mockPanelConfig.storageKey)).toBe("50")
		})

		it("should cancel pending timeout when persisting", () => {
			store.updatePanelSize(mockPanelConfig.storageKey, 50)

			const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")
			store.persistPanelSize(mockPanelConfig.storageKey)

			expect(clearTimeoutSpy).toHaveBeenCalled()
			clearTimeoutSpy.mockRestore()
		})

		it("should handle persist when no panel size in memory", () => {
			expect(() => store.persistPanelSize("non-existent")).not.toThrow()
		})
	})

	describe("Clear and Reset", () => {
		beforeEach(() => {
			vi.useFakeTimers()
			store.setContainerWidth(1200)
			store.updatePanelSize("panel-1", 50)
			store.updatePanelSize("panel-2", 30)
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("should clear specific panel size and pending saves", () => {
			store.clearPanelSize("panel-1")
			expect(store.panelSizes.get("panel-1")).toBeUndefined()

			// Advance time to ensure no delayed save happens
			vi.advanceTimersByTime(500)
			expect(localStorage.getItem("panel-1")).toBeNull()
			expect(store.panelSizes.get("panel-2")).toBeDefined()
		})

		it("should reset all panels and pending saves", () => {
			store.resetAllPanels()
			expect(store.panelSizes.size).toBe(0)

			// Advance time to ensure no delayed saves happen
			vi.advanceTimersByTime(500)
			expect(localStorage.getItem("panel-1")).toBeNull()
			expect(localStorage.getItem("panel-2")).toBeNull()
		})

		it("should clear pending timeout when clearing panel", () => {
			const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")

			store.clearPanelSize("panel-1")
			expect(clearTimeoutSpy).toHaveBeenCalled()

			clearTimeoutSpy.mockRestore()
		})

		it("should clear all pending timeouts when resetting", () => {
			const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")

			store.resetAllPanels()
			expect(clearTimeoutSpy).toHaveBeenCalledTimes(2)

			clearTimeoutSpy.mockRestore()
		})
	})

	describe("Edge Cases", () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("should handle localStorage errors gracefully during auto-save", () => {
			// Mock localStorage to throw error
			const originalSetItem = Storage.prototype.setItem
			Storage.prototype.setItem = () => {
				throw new Error("Storage full")
			}

			store.setContainerWidth(1200)
			expect(() => store.updatePanelSize("test", 50)).not.toThrow()

			// Advance time to trigger deferred save
			expect(() => vi.advanceTimersByTime(500)).not.toThrow()

			// Restore original method
			Storage.prototype.setItem = originalSetItem
		})

		it("should handle localStorage errors gracefully during persist", () => {
			const originalSetItem = Storage.prototype.setItem
			Storage.prototype.setItem = () => {
				throw new Error("Storage full")
			}

			store.setContainerWidth(1200)
			store.updatePanelSize("test", 50)

			expect(() => store.persistPanelSize("test")).not.toThrow()

			Storage.prototype.setItem = originalSetItem
		})

		it("should handle negative percentage values in localStorage", () => {
			localStorage.setItem(mockPanelConfig.storageKey, "-10")
			store.setContainerWidth(1200)
			const size = store.getPanelSize(mockPanelConfig)
			expect(size).toBeCloseTo(33.33, 1)
		})

		it("should handle zero percentage values in localStorage", () => {
			localStorage.setItem(mockPanelConfig.storageKey, "0")
			store.setContainerWidth(1200)
			const size = store.getPanelSize(mockPanelConfig)
			expect(size).toBeCloseTo(33.33, 1)
		})

		it("should handle unreasonable values > 100 in localStorage", () => {
			localStorage.setItem(mockPanelConfig.storageKey, "2000")
			store.setContainerWidth(1200)
			const size = store.getPanelSize(mockPanelConfig)
			// 2000/1200 = 166% which is > 100%, should return default
			expect(size).toBeCloseTo(33.33, 1)
		})
	})
})
