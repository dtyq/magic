import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import superMagicTopicModelService from "../SuperMagicTopicModelService"
import topicModelStore from "@/opensource/stores/superMagic/topicModelStore"
import type { ModelItem } from "@/opensource/pages/superMagic/components/MessageEditor/types"

// Mock dependencies
vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getSuperMagicTopicModel: vi.fn(),
		saveSuperMagicTopicModel: vi.fn(),
	},
}))

vi.mock("../SuperMagicTopicModelCacheService", () => ({
	default: {
		getTopicModel: vi.fn(),
		getProjectModel: vi.fn(),
		saveTopicModel: vi.fn(),
		saveProjectModel: vi.fn(),
	},
}))

vi.mock("../../SuperMagicModeService", () => ({
	default: {
		getModelListByMode: vi.fn(() => []),
		getImageModelListByMode: vi.fn(() => []),
		resolveLanguageModelByMode: vi.fn(async () => null),
		resolveImageModelByMode: vi.fn(async () => null),
	},
}))

import { SuperMagicApi } from "@/opensource/apis"
import superMagicTopicModelCacheService from "../SuperMagicTopicModelCacheService"
import superMagicModeService from "../../SuperMagicModeService"

describe("SuperMagicTopicModelService - Cascade & Backfill", () => {
	const mockLanguageModel: ModelItem = {
		id: "1",
		group_id: "group-1",
		model_id: "gpt-4",
		model_name: "GPT-4",
		provider_model_id: "gpt-4",
		model_description: "GPT-4 model",
		model_icon: "icon",
		model_status: "normal",
		sort: 1,
	}

	const mockImageModel: ModelItem = {
		id: "2",
		group_id: "group-2",
		model_id: "dall-e-3",
		model_name: "DALL-E 3",
		provider_model_id: "dall-e-3",
		model_description: "DALL-E 3 model",
		model_icon: "icon",
		model_status: "normal",
		sort: 1,
	}

	const mockLanguageModel2: ModelItem = {
		...mockLanguageModel,
		model_id: "claude-3",
		model_name: "Claude 3",
	}

	beforeEach(() => {
		topicModelStore.reset()
		vi.clearAllMocks()

		// Setup model lists
		vi.mocked(superMagicModeService.getModelListByMode).mockReturnValue([
			mockLanguageModel,
			mockLanguageModel2,
		])
		vi.mocked(superMagicModeService.getImageModelListByMode).mockReturnValue([mockImageModel])
		vi.mocked(superMagicModeService.resolveLanguageModelByMode).mockImplementation(
			async (mode, modelId) =>
				superMagicModeService
					.getModelListByMode(mode)
					.find((model) => model.model_id === modelId) ?? null,
		)
		vi.mocked(superMagicModeService.resolveImageModelByMode).mockImplementation(
			async (mode, modelId) =>
				superMagicModeService
					.getImageModelListByMode(mode)
					.find((model) => model.model_id === modelId) ?? null,
		)

		// Setup default mock behaviors
		vi.mocked(superMagicTopicModelCacheService.saveTopicModel).mockResolvedValue(undefined)
		vi.mocked(superMagicTopicModelCacheService.saveProjectModel).mockResolvedValue(undefined)
		vi.mocked(SuperMagicApi.saveSuperMagicTopicModel).mockResolvedValue({} as any)
	})

	afterEach(() => {
		superMagicTopicModelService.destroy()
	})

	describe("Three-level cascade: Topic -> Project -> Global", () => {
		it("should use Topic level data when available and valid", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"

			// Mock Topic level has valid data
			vi.mocked(superMagicTopicModelCacheService.getTopicModel).mockResolvedValue({
				languageModelId: "gpt-4",
				imageModelId: "dall-e-3",
				timestamp: Date.now(),
			})
			vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockResolvedValue({
				model: { model_id: "gpt-4" },
				image_model: { model_id: "dall-e-3" },
			} as any)

			topicModelStore.setCurrentContext(topicId, projectId, "general")
			await superMagicTopicModelService.fetchTopicModel(topicId, projectId, "general")

			// Should set models from Topic level
			expect(topicModelStore.selectedLanguageModel?.model_id).toBe("gpt-4")
			expect(topicModelStore.selectedImageModel?.model_id).toBe("dall-e-3")

			// Should NOT call Project or Global level API
			expect(SuperMagicApi.getSuperMagicTopicModel).toHaveBeenCalledTimes(1)
			expect(SuperMagicApi.getSuperMagicTopicModel).toHaveBeenCalledWith({
				topic_id: topicId,
			})
		})

		it("should fallback to Project level when Topic level fails", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"

			// Mock Topic level has no data
			vi.mocked(superMagicTopicModelCacheService.getTopicModel).mockResolvedValue(null)
			vi.mocked(SuperMagicApi.getSuperMagicTopicModel)
				.mockResolvedValueOnce({ model: {}, image_model: {} } as any) // Topic: no valid data
				.mockResolvedValueOnce({
					// Project: has valid data
					model: { model_id: "claude-3" },
					image_model: { model_id: "dall-e-3" },
				} as any)

			// Mock Project level has valid data
			vi.mocked(superMagicTopicModelCacheService.getProjectModel).mockResolvedValue({
				languageModelId: "claude-3",
				imageModelId: "dall-e-3",
				timestamp: Date.now(),
			})

			topicModelStore.setCurrentContext(topicId, projectId, "general")
			await superMagicTopicModelService.fetchTopicModel(topicId, projectId, "general")

			// Should set models from Project level
			expect(topicModelStore.selectedLanguageModel?.model_id).toBe("claude-3")
			expect(topicModelStore.selectedImageModel?.model_id).toBe("dall-e-3")

			// Should call both Topic and Project level APIs
			expect(SuperMagicApi.getSuperMagicTopicModel).toHaveBeenCalledTimes(2)
		})

		it("should fallback to Global level when both Topic and Project fail", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"

			// Mock Topic and Project have no data
			vi.mocked(superMagicTopicModelCacheService.getTopicModel).mockResolvedValue(null)
			vi.mocked(superMagicTopicModelCacheService.getProjectModel).mockResolvedValue(null)

			vi.mocked(SuperMagicApi.getSuperMagicTopicModel)
				.mockResolvedValueOnce({ model: {}, image_model: {} } as any) // Topic: no valid data
				.mockResolvedValueOnce({ model: {}, image_model: {} } as any) // Project: no valid data
				.mockResolvedValueOnce({
					// Global: has valid data
					model: { model_id: "gpt-4" },
					image_model: { model_id: "dall-e-3" },
				} as any)

			topicModelStore.setCurrentContext(topicId, projectId, "general")
			await superMagicTopicModelService.fetchTopicModel(topicId, projectId, "general")

			// Should set models from Global level
			expect(topicModelStore.selectedLanguageModel?.model_id).toBe("gpt-4")
			expect(topicModelStore.selectedImageModel?.model_id).toBe("dall-e-3")

			// Should call Topic, Project, and Global level APIs
			expect(SuperMagicApi.getSuperMagicTopicModel).toHaveBeenCalledTimes(3)
			expect(SuperMagicApi.getSuperMagicTopicModel).toHaveBeenNthCalledWith(3, {
				topic_id: "default",
			})
		})

		it("should use first usable model when all levels fail", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"

			// Mock all levels have no data
			vi.mocked(superMagicTopicModelCacheService.getTopicModel).mockResolvedValue(null)
			vi.mocked(superMagicTopicModelCacheService.getProjectModel).mockResolvedValue(null)
			vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockResolvedValue({
				model: {},
				image_model: {},
			} as any)

			topicModelStore.setCurrentContext(topicId, projectId, "general")
			await superMagicTopicModelService.fetchTopicModel(topicId, projectId, "general")

			// Should use first model from list (gpt-4)
			expect(topicModelStore.selectedLanguageModel?.model_id).toBe("gpt-4")
			expect(topicModelStore.selectedImageModel?.model_id).toBe("dall-e-3")
		})
	})

	describe("Backfill logic based on data source", () => {
		it("should NOT backfill when data is from Topic level", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"

			// Mock Topic level has valid data (both local and remote)
			vi.mocked(superMagicTopicModelCacheService.getTopicModel).mockResolvedValue({
				languageModelId: "gpt-4",
				imageModelId: "dall-e-3",
				timestamp: Date.now(),
			})
			vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockResolvedValue({
				model: { model_id: "gpt-4" },
				image_model: { model_id: "dall-e-3" },
			} as any)

			topicModelStore.setCurrentContext(topicId, projectId, "general")
			await superMagicTopicModelService.fetchTopicModel(topicId, projectId, "general")

			// Should NOT call saveSuperMagicTopicModel for backfill
			// (only saves to local cache for consistency)
			expect(SuperMagicApi.saveSuperMagicTopicModel).not.toHaveBeenCalled()
		})

		it("should backfill Topic when data is from Project level", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"

			// Mock Topic has no remote data but Project has valid data
			vi.mocked(superMagicTopicModelCacheService.getTopicModel).mockResolvedValue(null)
			vi.mocked(superMagicTopicModelCacheService.getProjectModel).mockResolvedValue({
				languageModelId: "claude-3",
				imageModelId: "dall-e-3",
				timestamp: Date.now(),
			})

			vi.mocked(SuperMagicApi.getSuperMagicTopicModel)
				.mockResolvedValueOnce({ model: {}, image_model: {} } as any) // Topic: no data
				.mockResolvedValueOnce({
					// Project: has data
					model: { model_id: "claude-3" },
					image_model: { model_id: "dall-e-3" },
				} as any)

			topicModelStore.setCurrentContext(topicId, projectId, "general")
			await superMagicTopicModelService.fetchTopicModel(topicId, projectId, "general")

			// Should backfill Topic level (not Project)
			expect(SuperMagicApi.saveSuperMagicTopicModel).toHaveBeenCalledTimes(1)
			expect(SuperMagicApi.saveSuperMagicTopicModel).toHaveBeenCalledWith({
				cache_id: topicId,
				model_id: "claude-3",
				image_model_id: "dall-e-3",
			})
		})

		it("should backfill both Topic and Project when data is from Global level", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"

			// Mock Topic and Project have no data, Global has data
			vi.mocked(superMagicTopicModelCacheService.getTopicModel).mockResolvedValue(null)
			vi.mocked(superMagicTopicModelCacheService.getProjectModel).mockResolvedValue(null)

			vi.mocked(SuperMagicApi.getSuperMagicTopicModel)
				.mockResolvedValueOnce({ model: {}, image_model: {} } as any) // Topic: no data
				.mockResolvedValueOnce({ model: {}, image_model: {} } as any) // Project: no data
				.mockResolvedValueOnce({
					// Global: has data
					model: { model_id: "gpt-4" },
					image_model: { model_id: "dall-e-3" },
				} as any)

			topicModelStore.setCurrentContext(topicId, projectId, "general")
			await superMagicTopicModelService.fetchTopicModel(topicId, projectId, "general")

			// Should backfill both Topic and Project
			expect(SuperMagicApi.saveSuperMagicTopicModel).toHaveBeenCalledTimes(2)
			expect(SuperMagicApi.saveSuperMagicTopicModel).toHaveBeenCalledWith({
				cache_id: topicId,
				model_id: "gpt-4",
				image_model_id: "dall-e-3",
			})
			expect(SuperMagicApi.saveSuperMagicTopicModel).toHaveBeenCalledWith({
				cache_id: "project_id_project-1",
				model_id: "gpt-4",
				image_model_id: "dall-e-3",
			})
		})

		it("should backfill Topic remote when local cache exists but remote is invalid", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"

			// Mock Topic has local cache but no remote data
			vi.mocked(superMagicTopicModelCacheService.getTopicModel).mockResolvedValue({
				languageModelId: "gpt-4",
				imageModelId: "dall-e-3",
				timestamp: Date.now(),
			})

			// First call (Topic): has local but no remote
			// Second call (Topic again): still no remote
			vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockResolvedValue({
				model: {},
				image_model: {},
			} as any)

			topicModelStore.setCurrentContext(topicId, projectId, "general")
			await superMagicTopicModelService.fetchTopicModel(topicId, projectId, "general")

			// Should backfill Topic remote (from local or from Global/Project)
			// In this case, will use local cache data
			expect(topicModelStore.selectedLanguageModel?.model_id).toBe("gpt-4")
		})
	})

	describe("Remote data validation and correction", () => {
		it("should detect local-remote mismatch and correct", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"

			// Mock local has one model, remote has another
			vi.mocked(superMagicTopicModelCacheService.getTopicModel).mockResolvedValue({
				languageModelId: "gpt-4",
				imageModelId: "dall-e-3",
				timestamp: Date.now(),
			})
			vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockResolvedValue({
				model: { model_id: "claude-3" }, // Different from local
				image_model: { model_id: "dall-e-3" },
			} as any)

			topicModelStore.setCurrentContext(topicId, projectId, "general")
			await superMagicTopicModelService.fetchTopicModel(topicId, projectId, "general")

			// Should use remote data (remote is source of truth)
			expect(topicModelStore.selectedLanguageModel?.model_id).toBe("claude-3")

			// Should update local cache with remote data
			expect(superMagicTopicModelCacheService.saveTopicModel).toHaveBeenCalledWith(
				topicId,
				expect.objectContaining({
					languageModelId: "claude-3",
				}),
			)
		})

		it("should handle invalid remote model gracefully", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"

			// Mock remote returns invalid model ID
			vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockResolvedValue({
				model: { model_id: "invalid-model" }, // Not in model list
				image_model: { model_id: "dall-e-3" },
			} as any)

			topicModelStore.setCurrentContext(topicId, projectId, "general")
			await superMagicTopicModelService.fetchTopicModel(topicId, projectId, "general")

			// Should fallback to first usable model for language model
			expect(topicModelStore.selectedLanguageModel?.model_id).toBe("gpt-4")
			expect(topicModelStore.selectedImageModel?.model_id).toBe("dall-e-3")
		})

		it("should restore custom model from remote when resolver can find it", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"
			const customModel: ModelItem = {
				...mockLanguageModel,
				id: "custom-1",
				model_id: "my-custom-model",
				model_name: "My Custom Model",
			}

			vi.mocked(superMagicTopicModelCacheService.getTopicModel).mockResolvedValue(null)
			vi.mocked(superMagicTopicModelCacheService.getProjectModel).mockResolvedValue(null)
			vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockResolvedValue({
				model: { model_id: customModel.model_id },
				image_model: { model_id: "dall-e-3" },
			} as any)
			vi.mocked(superMagicModeService.resolveLanguageModelByMode).mockImplementation(
				async (mode, modelId) => {
					if (modelId === customModel.model_id) return customModel
					return (
						superMagicModeService
							.getModelListByMode(mode)
							.find((model) => model.model_id === modelId) ?? null
					)
				},
			)

			topicModelStore.setCurrentContext(topicId, projectId, "general")
			await superMagicTopicModelService.fetchTopicModel(topicId, projectId, "general")

			expect(topicModelStore.selectedLanguageModel?.model_id).toBe(customModel.model_id)
			expect(topicModelStore.selectedImageModel?.model_id).toBe("dall-e-3")
		})

		it("should restore custom model from local cache when resolver can find it", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"
			const customModel: ModelItem = {
				...mockLanguageModel,
				id: "custom-2",
				model_id: "my-cached-custom-model",
				model_name: "My Cached Custom Model",
			}

			vi.mocked(superMagicTopicModelCacheService.getTopicModel).mockResolvedValue({
				languageModelId: customModel.model_id,
				imageModelId: "dall-e-3",
				timestamp: Date.now(),
			})
			vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockResolvedValue({
				model: {},
				image_model: {},
			} as any)
			vi.mocked(superMagicModeService.resolveLanguageModelByMode).mockImplementation(
				async (mode, modelId) => {
					if (modelId === customModel.model_id) return customModel
					return (
						superMagicModeService
							.getModelListByMode(mode)
							.find((model) => model.model_id === modelId) ?? null
					)
				},
			)

			topicModelStore.setCurrentContext(topicId, projectId, "general")
			await superMagicTopicModelService.fetchTopicModel(topicId, projectId, "general")

			expect(topicModelStore.selectedLanguageModel?.model_id).toBe(customModel.model_id)
			expect(topicModelStore.selectedImageModel?.model_id).toBe("dall-e-3")
		})
	})

	describe("Edge cases", () => {
		it("should handle empty projectId gracefully", async () => {
			const topicId = "topic-1"
			const projectId = ""

			vi.mocked(superMagicTopicModelCacheService.getTopicModel).mockResolvedValue(null)
			vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockResolvedValue({
				model: { model_id: "gpt-4" },
				image_model: { model_id: "dall-e-3" },
			} as any)

			topicModelStore.setCurrentContext(topicId, projectId, "general")
			await superMagicTopicModelService.fetchTopicModel(topicId, projectId, "general")

			// Should not attempt to query or backfill Project level
			expect(superMagicTopicModelCacheService.getProjectModel).not.toHaveBeenCalled()
			expect(superMagicTopicModelCacheService.saveProjectModel).not.toHaveBeenCalled()
		})

		it("should handle API errors gracefully", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"

			// Mock API failure
			vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockRejectedValue(
				new Error("API error"),
			)

			topicModelStore.setCurrentContext(topicId, projectId, "general")
			await superMagicTopicModelService.fetchTopicModel(topicId, projectId, "general")

			// Should fallback to first usable model
			expect(topicModelStore.selectedLanguageModel?.model_id).toBe("gpt-4")
			expect(topicModelStore.selectedImageModel?.model_id).toBe("dall-e-3")
		})

		it("should handle topic switch during async operations", async () => {
			const topicId1 = "topic-1"
			const topicId2 = "topic-2"
			const projectId = "project-1"

			// Mock slow API response
			vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(
							() =>
								resolve({
									model: { model_id: "gpt-4" },
									image_model: { model_id: "dall-e-3" },
								} as any),
							100,
						)
					}),
			)

			// Start fetching for topic1
			topicModelStore.setCurrentContext(topicId1, projectId, "general")
			const promise1 = superMagicTopicModelService.fetchTopicModel(
				topicId1,
				projectId,
				"general",
			)

			// Immediately switch to topic2
			topicModelStore.setCurrentContext(topicId2, projectId, "general")

			await promise1

			// Should not update store for topic1 (because current topic is now topic2)
			// Store should still be loading or have topic2's data
			expect(topicModelStore.currentTopicId).toBe(topicId2)
		})
	})
})
