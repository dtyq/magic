import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import superMagicTopicModelService from "../SuperMagicTopicModelService"
import topicModelStore from "@/opensource/stores/superMagic/topicModelStore"
import {
	ModelStatusEnum,
	type ModelItem,
} from "@/opensource/pages/superMagic/components/MessageEditor/types"
import type { TopicMode } from "@/opensource/pages/superMagic/pages/Workspace/types"

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

describe("SuperMagicTopicModelService - Debounce", () => {
	const mockLanguageModel: ModelItem = {
		id: "1",
		group_id: "group-1",
		model_id: "gpt-4",
		model_name: "GPT-4",
		provider_model_id: "gpt-4",
		model_description: "GPT-4 model",
		model_icon: "icon",
		model_status: ModelStatusEnum.Normal,
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
		model_status: ModelStatusEnum.Normal,
		sort: 1,
	}

	beforeEach(() => {
		vi.useFakeTimers()
		topicModelStore.reset()
		vi.clearAllMocks()

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

		// Setup default mocks
		vi.mocked(superMagicTopicModelCacheService.saveTopicModel).mockResolvedValue(undefined)
		vi.mocked(SuperMagicApi.saveSuperMagicTopicModel).mockResolvedValue({} as any)
	})

	afterEach(() => {
		vi.useRealTimers()
		superMagicTopicModelService.destroy()
	})

	describe("debounce mechanism", () => {
		it("should debounce multiple rapid saves into single API call", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"

			// User selects language model
			await superMagicTopicModelService.saveModel(
				topicId,
				projectId,
				mockLanguageModel,
				undefined,
			)
			expect(SuperMagicApi.saveSuperMagicTopicModel).not.toHaveBeenCalled()

			// 300ms later, user selects another language model
			vi.advanceTimersByTime(300)
			const langModel2: ModelItem = { ...mockLanguageModel, model_id: "claude-3" }
			await superMagicTopicModelService.saveModel(topicId, projectId, langModel2, undefined)
			expect(SuperMagicApi.saveSuperMagicTopicModel).not.toHaveBeenCalled()

			// 500ms later, user selects image model
			vi.advanceTimersByTime(500)
			await superMagicTopicModelService.saveModel(
				topicId,
				projectId,
				undefined,
				mockImageModel,
			)
			expect(SuperMagicApi.saveSuperMagicTopicModel).not.toHaveBeenCalled()

			// 1 second passes with no new operations
			vi.advanceTimersByTime(1000)

			// Now API should be called once with final model combination
			expect(SuperMagicApi.saveSuperMagicTopicModel).toHaveBeenCalledTimes(1)
			expect(SuperMagicApi.saveSuperMagicTopicModel).toHaveBeenCalledWith({
				cache_id: topicId,
				model_id: "claude-3",
				image_model_id: "dall-e-3",
			})
		})

		it("should flush immediately on topic switch", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"

			// User selects model
			await superMagicTopicModelService.saveModel(
				topicId,
				projectId,
				mockLanguageModel,
				undefined,
			)
			expect(SuperMagicApi.saveSuperMagicTopicModel).not.toHaveBeenCalled()

			// Only 500ms passed, but user switches topic
			vi.advanceTimersByTime(500)
			await superMagicTopicModelService.flushAll(topicId)

			// API should be called immediately despite debounce not finished
			// Called once for the topic (project is handled through backfill in fetchTopicModel)
			expect(SuperMagicApi.saveSuperMagicTopicModel).toHaveBeenCalledTimes(1)
			expect(SuperMagicApi.saveSuperMagicTopicModel).toHaveBeenCalledWith({
				cache_id: topicId,
				model_id: "gpt-4",
				image_model_id: undefined,
			})
		})

		it("should keep Store and cache in sync during debounce", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"

			// Save model
			await superMagicTopicModelService.saveModel(
				topicId,
				projectId,
				mockLanguageModel,
				undefined,
			)

			// Store should be updated immediately
			expect(topicModelStore.selectedLanguageModel).toEqual(mockLanguageModel)

			// Cache should be saved immediately
			expect(superMagicTopicModelCacheService.saveTopicModel).toHaveBeenCalledWith(topicId, {
				languageModelId: "gpt-4",
				imageModelId: undefined,
				timestamp: expect.any(Number),
			})

			// But API not called yet
			expect(SuperMagicApi.saveSuperMagicTopicModel).not.toHaveBeenCalled()

			// After debounce delay
			vi.advanceTimersByTime(1000)
			expect(SuperMagicApi.saveSuperMagicTopicModel).toHaveBeenCalledTimes(1)
		})

		it("should handle API failure gracefully", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"

			// Mock API failure
			vi.mocked(SuperMagicApi.saveSuperMagicTopicModel).mockRejectedValue(
				new Error("API error"),
			)

			// Save model
			await superMagicTopicModelService.saveModel(
				topicId,
				projectId,
				mockLanguageModel,
				undefined,
			)

			// Store and cache should still be updated
			expect(topicModelStore.selectedLanguageModel).toEqual(mockLanguageModel)
			expect(superMagicTopicModelCacheService.saveTopicModel).toHaveBeenCalled()

			// Wait for debounce
			vi.advanceTimersByTime(1000)

			// API was called but failed - should not throw
			expect(SuperMagicApi.saveSuperMagicTopicModel).toHaveBeenCalled()

			// Store should still have the model (local cache is source of truth)
			expect(topicModelStore.selectedLanguageModel).toEqual(mockLanguageModel)
		})
	})

	describe("model validation", () => {
		const generalMode = "general" as TopicMode

		it("should validate models for mode change", async () => {
			const validModel: ModelItem = {
				...mockLanguageModel,
				model_status: ModelStatusEnum.Normal,
			}
			const modelList = [validModel]

			vi.mocked(superMagicModeService.getModelListByMode).mockReturnValue(modelList)
			vi.mocked(superMagicModeService.getImageModelListByMode).mockReturnValue([])

			// Set a model
			topicModelStore.setSelectedLanguageModel(validModel)

			topicModelStore.setCurrentContext("topic-1", "project-1", generalMode)

			// Validate for mode (should keep the model)
			await superMagicTopicModelService.validateSelectedModels(topicModelStore)

			expect(topicModelStore.selectedLanguageModel).toEqual(validModel)
		})

		it("should switch to first usable model when current is invalid", async () => {
			const invalidModel: ModelItem = {
				...mockLanguageModel,
				model_status: ModelStatusEnum.Disabled,
			}
			const validModel: ModelItem = {
				...mockLanguageModel,
				model_id: "valid-model",
				model_status: ModelStatusEnum.Normal,
			}
			const modelList = [validModel]

			vi.mocked(superMagicModeService.getModelListByMode).mockReturnValue(modelList)
			vi.mocked(superMagicModeService.getImageModelListByMode).mockReturnValue([])

			// Set an invalid model
			topicModelStore.setSelectedLanguageModel(invalidModel)
			topicModelStore.setCurrentContext("topic-1", "project-1", generalMode)

			// Validate for mode (should switch to valid model)
			await superMagicTopicModelService.validateSelectedModels(topicModelStore)

			// Wait for debounce
			vi.advanceTimersByTime(1000)

			expect(topicModelStore.selectedLanguageModel).toEqual(validModel)
		})

		it("should keep custom model when resolver can find it", async () => {
			const validModel: ModelItem = {
				...mockLanguageModel,
				model_status: ModelStatusEnum.Normal,
			}
			const customModel: ModelItem = {
				...mockLanguageModel,
				id: "custom-1",
				model_id: "my-custom-model",
				model_name: "My Custom Model",
			}

			vi.mocked(superMagicModeService.getModelListByMode).mockReturnValue([validModel])
			vi.mocked(superMagicModeService.getImageModelListByMode).mockReturnValue([])
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

			topicModelStore.setSelectedLanguageModel(customModel)
			topicModelStore.setCurrentContext("topic-1", "project-1", generalMode)

			await superMagicTopicModelService.validateSelectedModels(topicModelStore)

			expect(topicModelStore.selectedLanguageModel?.model_id).toBe(customModel.model_id)
		})

		it("should prefer custom model during validation when official model is disabled", async () => {
			const officialDisabledModel: ModelItem = {
				...mockLanguageModel,
				model_id: "shared-custom-model",
				model_name: "Official Shared Model",
				model_status: ModelStatusEnum.Disabled,
			}
			const fallbackModel: ModelItem = {
				...mockLanguageModel,
				model_id: "fallback-model",
				model_name: "Fallback Model",
				model_status: ModelStatusEnum.Normal,
			}
			const customModel: ModelItem = {
				...mockLanguageModel,
				id: "custom-shared-1",
				model_id: "shared-custom-model",
				model_name: "Custom Shared Model",
			}

			vi.mocked(superMagicModeService.getModelListByMode).mockReturnValue([
				officialDisabledModel,
				fallbackModel,
			])
			vi.mocked(superMagicModeService.getImageModelListByMode).mockReturnValue([])
			vi.mocked(superMagicModeService.resolveLanguageModelByMode).mockImplementation(
				async (mode, modelId) => {
					if (modelId === customModel.model_id) return customModel
					return (
						superMagicModeService
							.getModelListByMode(mode)
							.find(
								(model) =>
									model.model_id === modelId && model.model_status === "normal",
							) ?? null
					)
				},
			)

			topicModelStore.setSelectedLanguageModel(customModel)
			topicModelStore.setCurrentContext("topic-1", "project-1", generalMode)

			await superMagicTopicModelService.validateSelectedModels(topicModelStore)

			expect(topicModelStore.selectedLanguageModel?.model_id).toBe(customModel.model_id)
		})
	})

	describe("flushAll", () => {
		it("should flush all pending saves", async () => {
			// Save models for multiple topics
			await superMagicTopicModelService.saveModel(
				"topic-1",
				"project-1",
				mockLanguageModel,
				undefined,
			)
			await superMagicTopicModelService.saveModel(
				"topic-2",
				"project-2",
				mockImageModel,
				undefined,
			)

			expect(SuperMagicApi.saveSuperMagicTopicModel).not.toHaveBeenCalled()

			// Flush all
			await superMagicTopicModelService.flushAll()

			// Both topics should be saved (one call per topic)
			// Project level is handled through backfill in fetchTopicModel
			expect(SuperMagicApi.saveSuperMagicTopicModel).toHaveBeenCalledTimes(2)
		})

		it("should flush specific topic only", async () => {
			// Save models for multiple topics
			await superMagicTopicModelService.saveModel(
				"topic-1",
				"project-1",
				mockLanguageModel,
				undefined,
			)
			await superMagicTopicModelService.saveModel(
				"topic-2",
				"project-2",
				mockImageModel,
				undefined,
			)

			// Flush only topic-1
			await superMagicTopicModelService.flushAll("topic-1")

			// Only topic-1 should be saved (one call)
			// Project level is handled through backfill in fetchTopicModel
			expect(SuperMagicApi.saveSuperMagicTopicModel).toHaveBeenCalledTimes(1)
			expect(SuperMagicApi.saveSuperMagicTopicModel).toHaveBeenCalledWith({
				cache_id: "topic-1",
				model_id: "gpt-4",
				image_model_id: undefined,
			})
		})
	})

	describe("cleanup", () => {
		it("should cleanup timers for specific topic", async () => {
			const topicId = "topic-1"
			const projectId = "project-1"

			// Save model
			await superMagicTopicModelService.saveModel(
				topicId,
				projectId,
				mockLanguageModel,
				undefined,
			)

			// Cleanup
			superMagicTopicModelService.cleanup(topicId)

			// Advance time - API should not be called
			vi.advanceTimersByTime(2000)
			expect(SuperMagicApi.saveSuperMagicTopicModel).not.toHaveBeenCalled()
		})
	})

	describe("project key generation", () => {
		it("should generate project key with prefix", () => {
			const key = superMagicTopicModelService.genProjectKey("project-123")
			expect(key).toBe("project_id_project-123")
		})

		it("should return default for empty project ID", () => {
			const key = superMagicTopicModelService.genProjectKey("")
			expect(key).toBe("default")
		})
	})
})
