import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { LocalStorageAdapter } from "../LocalStorageAdapter"

describe("LocalStorageAdapter", () => {
	let adapter: LocalStorageAdapter
	let mockLocalStorage: Record<string, string>

	beforeEach(() => {
		// Mock localStorage
		mockLocalStorage = {}

		Object.defineProperty(window, "localStorage", {
			value: {
				getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
				setItem: vi.fn((key: string, value: string) => {
					mockLocalStorage[key] = value
				}),
				removeItem: vi.fn((key: string) => {
					delete mockLocalStorage[key]
				}),
				clear: vi.fn(() => {
					mockLocalStorage = {}
				}),
			},
			writable: true,
		})

		adapter = new LocalStorageAdapter()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("getItem", () => {
		it("should return value when key exists", async () => {
			mockLocalStorage["test-key"] = "test-value"

			const result = await adapter.getItem("test-key")

			expect(result).toBe("test-value")
			expect(window.localStorage.getItem).toHaveBeenCalledWith("test-key")
		})

		it("should return null when key does not exist", async () => {
			const result = await adapter.getItem("non-existent-key")

			expect(result).toBeNull()
			expect(window.localStorage.getItem).toHaveBeenCalledWith("non-existent-key")
		})

		it("should return null on error", async () => {
			vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
				throw new Error("Storage error")
			})

			const result = await adapter.getItem("error-key")

			expect(result).toBeNull()
		})
	})

	describe("setItem", () => {
		it("should set value for key", async () => {
			await adapter.setItem("test-key", "test-value")

			expect(window.localStorage.setItem).toHaveBeenCalledWith("test-key", "test-value")
			expect(mockLocalStorage["test-key"]).toBe("test-value")
		})

		it("should overwrite existing value", async () => {
			mockLocalStorage["test-key"] = "old-value"

			await adapter.setItem("test-key", "new-value")

			expect(mockLocalStorage["test-key"]).toBe("new-value")
		})

		it("should throw error on failure", async () => {
			vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
				throw new Error("Storage full")
			})

			await expect(adapter.setItem("test-key", "test-value")).rejects.toThrow()
		})
	})

	describe("removeItem", () => {
		it("should remove item", async () => {
			mockLocalStorage["test-key"] = "test-value"

			await adapter.removeItem("test-key")

			expect(window.localStorage.removeItem).toHaveBeenCalledWith("test-key")
			expect(mockLocalStorage["test-key"]).toBeUndefined()
		})

		it("should not throw when removing non-existent key", async () => {
			await expect(adapter.removeItem("non-existent-key")).resolves.not.toThrow()
		})

		it("should throw error on failure", async () => {
			vi.spyOn(window.localStorage, "removeItem").mockImplementation(() => {
				throw new Error("Remove error")
			})

			await expect(adapter.removeItem("test-key")).rejects.toThrow()
		})
	})

	describe("clear", () => {
		it("should clear all items", async () => {
			mockLocalStorage["key1"] = "value1"
			mockLocalStorage["key2"] = "value2"

			await adapter.clear()

			expect(window.localStorage.clear).toHaveBeenCalled()
			expect(Object.keys(mockLocalStorage).length).toBe(0)
		})

		it("should throw error on failure", async () => {
			vi.spyOn(window.localStorage, "clear").mockImplementation(() => {
				throw new Error("Clear error")
			})

			await expect(adapter.clear()).rejects.toThrow()
		})
	})

	describe("async interface", () => {
		it("should return promises for all methods", () => {
			expect(adapter.getItem("test")).toBeInstanceOf(Promise)
			expect(adapter.setItem("test", "value")).toBeInstanceOf(Promise)
			expect(adapter.removeItem("test")).toBeInstanceOf(Promise)
			expect(adapter.clear()).toBeInstanceOf(Promise)
		})
	})
})
