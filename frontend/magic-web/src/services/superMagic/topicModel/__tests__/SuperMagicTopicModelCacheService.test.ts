import { describe, it, expect, beforeEach, vi } from "vitest"
import SuperMagicTopicModelCacheService from "../SuperMagicTopicModelCacheService"
import type { IStorageAdapter } from "../storage"
import type { CachedModelData } from "../SuperMagicTopicModelCacheService"

// Mock storage adapter
class MockStorageAdapter implements IStorageAdapter {
	private storage = new Map<string, string>()

	async getItem(key: string): Promise<string | null> {
		return this.storage.get(key) || null
	}

	async setItem(key: string, value: string): Promise<void> {
		this.storage.set(key, value)
	}

	async removeItem(key: string): Promise<void> {
		this.storage.delete(key)
	}

	async clear(): Promise<void> {
		this.storage.clear()
	}

	// Test helper
	getStorage() {
		return this.storage
	}
}

// Mock userStore
vi.mock("@/opensource/models/user", () => ({
	userStore: {
		user: {
			organizationCode: "test-org",
			userInfo: {
				user_id: "test-user",
			},
		},
	},
}))

describe("SuperMagicTopicModelCacheService", () => {
	let service: typeof SuperMagicTopicModelCacheService
	let mockAdapter: MockStorageAdapter

	beforeEach(() => {
		mockAdapter = new MockStorageAdapter()
		service = SuperMagicTopicModelCacheService
		service.setStorageAdapter(mockAdapter)
	})

	describe("getTopicModel", () => {
		it("should return null when cache does not exist", async () => {
			const result = await service.getTopicModel("topic-1")

			expect(result).toBeNull()
		})

		it("should return cached data when exists", async () => {
			const cachedData: CachedModelData = {
				languageModelId: "gpt-4",
				imageModelId: "dall-e-3",
				timestamp: Date.now(),
			}

			// Save using service to get correct key
			await service.saveTopicModel("topic-1", cachedData)

			const result = await service.getTopicModel("topic-1")

			expect(result).toEqual(cachedData)
		})

		it("should return null on parse error", async () => {
			const key = "platform/super_magic/topic_model/test-org/test-user/topic-1"
			await mockAdapter.setItem(key, "invalid-json")

			const result = await service.getTopicModel("topic-1")

			expect(result).toBeNull()
		})
	})

	describe("getProjectModel", () => {
		it("should return null when cache does not exist", async () => {
			const result = await service.getProjectModel("project-1")

			expect(result).toBeNull()
		})

		it("should return cached data when exists", async () => {
			const cachedData: CachedModelData = {
				languageModelId: "claude-3",
				imageModelId: "midjourney",
				timestamp: Date.now(),
			}

			// Save using service to get correct key
			await service.saveProjectModel("project-1", cachedData)

			const result = await service.getProjectModel("project-1")

			expect(result).toEqual(cachedData)
		})
	})

	describe("saveTopicModel", () => {
		it("should save topic model to cache", async () => {
			const modelData: CachedModelData = {
				languageModelId: "gpt-4",
				imageModelId: "dall-e-3",
				timestamp: Date.now(),
			}

			await service.saveTopicModel("topic-1", modelData)

			// Verify by reading back
			const result = await service.getTopicModel("topic-1")

			expect(result).not.toBeNull()
			expect(result).toEqual(modelData)
		})

		it("should overwrite existing cache", async () => {
			const oldData: CachedModelData = {
				languageModelId: "old-model",
				timestamp: Date.now() - 1000,
			}

			const newData: CachedModelData = {
				languageModelId: "new-model",
				imageModelId: "new-image",
				timestamp: Date.now(),
			}

			await service.saveTopicModel("topic-1", oldData)
			await service.saveTopicModel("topic-1", newData)

			const result = await service.getTopicModel("topic-1")

			expect(result).toEqual(newData)
		})
	})

	describe("saveProjectModel", () => {
		it("should save project model to cache", async () => {
			const modelData: CachedModelData = {
				languageModelId: "claude-3",
				timestamp: Date.now(),
			}

			await service.saveProjectModel("project-1", modelData)

			// Verify by reading back
			const result = await service.getProjectModel("project-1")

			expect(result).not.toBeNull()
			expect(result).toEqual(modelData)
		})
	})

	describe("clearCache", () => {
		it("should clear specific topic cache", async () => {
			const modelData: CachedModelData = {
				languageModelId: "gpt-4",
				timestamp: Date.now(),
			}

			await service.saveTopicModel("topic-1", modelData)
			await service.clearCache("topic-1")

			const result = await service.getTopicModel("topic-1")

			expect(result).toBeNull()
		})

		it("should clear all cache when no scope provided", async () => {
			await service.saveTopicModel("topic-1", {
				languageModelId: "gpt-4",
				timestamp: Date.now(),
			})
			await service.saveProjectModel("project-1", {
				languageModelId: "claude-3",
				timestamp: Date.now(),
			})

			await service.clearCache()

			expect(mockAdapter.getStorage().size).toBe(0)
		})
	})

	describe("cache key generation", () => {
		it("should generate unique keys for different topics", async () => {
			const data1: CachedModelData = {
				languageModelId: "model-1",
				timestamp: Date.now(),
			}
			const data2: CachedModelData = {
				languageModelId: "model-2",
				timestamp: Date.now(),
			}

			await service.saveTopicModel("topic-1", data1)
			await service.saveTopicModel("topic-2", data2)

			const result1 = await service.getTopicModel("topic-1")
			const result2 = await service.getTopicModel("topic-2")

			expect(result1?.languageModelId).toBe("model-1")
			expect(result2?.languageModelId).toBe("model-2")
		})

		it("should generate unique keys for topics and projects", async () => {
			const topicData: CachedModelData = {
				languageModelId: "topic-model",
				timestamp: Date.now(),
			}
			const projectData: CachedModelData = {
				languageModelId: "project-model",
				timestamp: Date.now(),
			}

			await service.saveTopicModel("id-1", topicData)
			await service.saveProjectModel("id-1", projectData)

			const topicResult = await service.getTopicModel("id-1")
			const projectResult = await service.getProjectModel("id-1")

			expect(topicResult?.languageModelId).toBe("topic-model")
			expect(projectResult?.languageModelId).toBe("project-model")
		})
	})
})
