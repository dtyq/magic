/**
 * Unit tests for ResourceManager
 * ResourceManager 单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { ResourceManager } from "../managers/ResourceManager"
import type { LoggerInterface } from "../types/RecorderDependencies"

describe("ResourceManager", () => {
	let mockLogger: LoggerInterface
	let manager: ResourceManager

	beforeEach(() => {
		mockLogger = {
			log: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		}
		manager = new ResourceManager(mockLogger)
	})

	it("should register a resource", () => {
		const cleanup = vi.fn()
		manager.register("test-id", "TestResource", cleanup)

		expect(manager.has("test-id")).toBe(true)
		expect(manager.getResourceCount()).toBe(1)
	})

	it("should register resource with instance", () => {
		const resource = { name: "test" }
		const cleanup = vi.fn()
		manager.register("test-id", "TestResource", cleanup, resource)

		expect(manager.get("test-id")).toBe(resource)
	})

	it("should unregister and cleanup resource", async () => {
		const cleanup = vi.fn()
		manager.register("test-id", "TestResource", cleanup)

		await manager.unregister("test-id")

		expect(cleanup).toHaveBeenCalledTimes(1)
		expect(manager.has("test-id")).toBe(false)
	})

	it("should handle async cleanup functions", async () => {
		const cleanup = vi.fn().mockResolvedValue(undefined)
		manager.register("test-id", "TestResource", cleanup)

		await manager.unregister("test-id")

		expect(cleanup).toHaveBeenCalledTimes(1)
	})

	it("should handle cleanup errors gracefully", async () => {
		const cleanup = vi.fn().mockRejectedValue(new Error("Cleanup failed"))
		manager.register("test-id", "TestResource", cleanup)

		await manager.unregister("test-id")

		// Should still remove from tracking
		expect(manager.has("test-id")).toBe(false)
		expect(mockLogger.error).toHaveBeenCalled()
	})

	it("should cleanup resources by type", async () => {
		const cleanup1 = vi.fn()
		const cleanup2 = vi.fn()
		const cleanup3 = vi.fn()

		manager.register("id1", "TypeA", cleanup1)
		manager.register("id2", "TypeA", cleanup2)
		manager.register("id3", "TypeB", cleanup3)

		await manager.cleanupByType("TypeA")

		expect(cleanup1).toHaveBeenCalledTimes(1)
		expect(cleanup2).toHaveBeenCalledTimes(1)
		expect(cleanup3).not.toHaveBeenCalled()
		expect(manager.has("id1")).toBe(false)
		expect(manager.has("id2")).toBe(false)
		expect(manager.has("id3")).toBe(true)
	})

	it("should cleanup all resources in reverse order", async () => {
		const cleanupOrder: number[] = []

		manager.register("id1", "Type", () => {
			cleanupOrder.push(1)
		})
		manager.register("id2", "Type", () => {
			cleanupOrder.push(2)
		})
		manager.register("id3", "Type", () => {
			cleanupOrder.push(3)
		})

		await manager.cleanupAll()

		// Should cleanup in reverse order (LIFO)
		expect(cleanupOrder).toEqual([3, 2, 1])
		expect(manager.getResourceCount()).toBe(0)
	})

	it("should get resource IDs by type", () => {
		manager.register("id1", "TypeA", vi.fn())
		manager.register("id2", "TypeA", vi.fn())
		manager.register("id3", "TypeB", vi.fn())

		const typeAIds = manager.getIdsByType("TypeA")
		expect(typeAIds).toHaveLength(2)
		expect(typeAIds).toContain("id1")
		expect(typeAIds).toContain("id2")

		const typeBIds = manager.getIdsByType("TypeB")
		expect(typeBIds).toHaveLength(1)
		expect(typeBIds).toContain("id3")
	})

	it("should get all resource types", () => {
		manager.register("id1", "TypeA", vi.fn())
		manager.register("id2", "TypeB", vi.fn())
		manager.register("id3", "TypeA", vi.fn())

		const types = manager.getResourceTypes()
		expect(types).toHaveLength(2)
		expect(types).toContain("TypeA")
		expect(types).toContain("TypeB")
	})

	it("should replace resource when registering with same ID", async () => {
		const cleanup1 = vi.fn()
		const cleanup2 = vi.fn()

		manager.register("test-id", "Type1", cleanup1)
		manager.register("test-id", "Type2", cleanup2)

		// Old cleanup should have been called
		expect(cleanup1).toHaveBeenCalledTimes(1)
		expect(manager.has("test-id")).toBe(true)
		expect(manager.getResourceCount()).toBe(1)

		await manager.cleanupAll()
		expect(cleanup2).toHaveBeenCalledTimes(1)
	})

	it("should warn when trying to unregister non-existent resource", async () => {
		await manager.unregister("non-existent")
		expect(mockLogger.warn).toHaveBeenCalled()
	})
})
