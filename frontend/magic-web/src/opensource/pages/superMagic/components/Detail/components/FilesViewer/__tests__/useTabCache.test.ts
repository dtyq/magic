import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { useTabCache } from "../hooks/useTabCache"

describe("useTabCache", () => {
	it("should initialize with empty cache", () => {
		const { result } = renderHook(() => useTabCache({ maxCacheSize: 5 }))

		expect(result.current.cachedTabIds).toEqual([])
		expect(result.current.getCacheStats().size).toBe(0)
		expect(result.current.getCacheStats().maxSize).toBe(5)
	})

	it("should add items to cache", () => {
		const { result } = renderHook(() => useTabCache({ maxCacheSize: 3 }))

		act(() => {
			result.current.addToCache("tab1", { data: "test1" })
			result.current.addToCache("tab2", { data: "test2" })
		})

		expect(result.current.cachedTabIds).toContain("tab1")
		expect(result.current.cachedTabIds).toContain("tab2")
		expect(result.current.getCacheStats().size).toBe(2)
	})

	it("should respect max cache size", () => {
		const { result } = renderHook(() => useTabCache({ maxCacheSize: 2 }))

		act(() => {
			result.current.addToCache("tab1", { data: "test1" })
			result.current.addToCache("tab2", { data: "test2" })
			result.current.addToCache("tab3", { data: "test3" })
		})

		// Should only have 2 items due to LRU eviction
		expect(result.current.getCacheStats().size).toBe(2)
		expect(result.current.cachedTabIds).toContain("tab2")
		expect(result.current.cachedTabIds).toContain("tab3")
		expect(result.current.cachedTabIds).not.toContain("tab1") // Should be evicted
	})

	it("should get cached items", () => {
		const { result } = renderHook(() => useTabCache({ maxCacheSize: 5 }))

		const testData = { data: "test", timestamp: Date.now() }

		act(() => {
			result.current.addToCache("tab1", testData)
		})

		const cachedData = result.current.getFromCache("tab1")
		expect(cachedData).toEqual(testData)
	})

	it("should return null for non-cached items", () => {
		const { result } = renderHook(() => useTabCache({ maxCacheSize: 5 }))

		const cachedData = result.current.getFromCache("nonexistent")
		expect(cachedData).toBeNull()
	})

	it("should remove items from cache", () => {
		const { result } = renderHook(() => useTabCache({ maxCacheSize: 5 }))

		act(() => {
			result.current.addToCache("tab1", { data: "test1" })
			result.current.addToCache("tab2", { data: "test2" })
		})

		expect(result.current.cachedTabIds).toContain("tab1")

		act(() => {
			result.current.removeFromCache("tab1")
		})

		expect(result.current.cachedTabIds).not.toContain("tab1")
		expect(result.current.getCacheStats().size).toBe(1)
	})

	it("should clear all cache", () => {
		const { result } = renderHook(() => useTabCache({ maxCacheSize: 5 }))

		act(() => {
			result.current.addToCache("tab1", { data: "test1" })
			result.current.addToCache("tab2", { data: "test2" })
		})

		expect(result.current.getCacheStats().size).toBe(2)

		act(() => {
			result.current.clearCache()
		})

		expect(result.current.getCacheStats().size).toBe(0)
		expect(result.current.cachedTabIds).toEqual([])
	})

	it("should check if item is cached", () => {
		const { result } = renderHook(() => useTabCache({ maxCacheSize: 5 }))

		expect(result.current.isCached("tab1")).toBe(false)

		act(() => {
			result.current.addToCache("tab1", { data: "test1" })
		})

		expect(result.current.isCached("tab1")).toBe(true)
	})

	it("should disable cache when enableCache is false", () => {
		const { result } = renderHook(() => useTabCache({ enableCache: false }))

		act(() => {
			result.current.addToCache("tab1", { data: "test1" })
		})

		expect(result.current.getCacheStats().size).toBe(0)
		expect(result.current.getFromCache("tab1")).toBeNull()
	})

	it("should update access time when getting cached item", () => {
		const { result } = renderHook(() => useTabCache({ maxCacheSize: 2 }))

		act(() => {
			result.current.addToCache("tab1", { data: "test1" })
			result.current.addToCache("tab2", { data: "test2" })
		})

		// Access tab1 to update its access time
		act(() => {
			result.current.getFromCache("tab1")
		})

		// Add a third item, should evict tab2 (least recently used)
		act(() => {
			result.current.addToCache("tab3", { data: "test3" })
		})

		expect(result.current.cachedTabIds).toContain("tab1") // Should remain (most recently accessed)
		expect(result.current.cachedTabIds).toContain("tab3") // Should be added (most recently added)
		expect(result.current.cachedTabIds).not.toContain("tab2") // Should be evicted (least recently used)
	})
})
