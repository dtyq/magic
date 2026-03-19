import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import useTopicModel from "../useTopicModel"
import { superMagicTopicModelService } from "@/services/superMagic/topicModel"
import { ModelStatusEnum, type ModelItem } from "../../types"
import type {
	ProjectListItem,
	Topic,
	TopicMode,
} from "@/pages/superMagic/pages/Workspace/types"

// Mock dependencies
vi.mock("@/services/superMagic/topicModel", () => ({
	superMagicTopicModelService: {
		initForStore: vi.fn(),
		saveModel: vi.fn(),
		validateSelectedModels: vi.fn(),
		flushAll: vi.fn(),
		destroyForStore: vi.fn(),
	},
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		firstModeIdentifier: "general",
		getModelGroupsByMode: vi.fn(() => []),
		getImageModelGroupsByMode: vi.fn(() => []),
	},
}))

describe("useTopicModel", () => {
	const defaultTopicMode = "general" as TopicMode
	const topic1 = { id: "topic-1" } as Topic
	const topic2 = { id: "topic-2" } as Topic
	const project1 = { id: "project-1" } as ProjectListItem
	const project2 = { id: "project-2" } as ProjectListItem
	const mockTopicModelStore = {
		selectedLanguageModel: null,
		selectedImageModel: null,
		isLoading: false,
		currentTopicId: "default",
		currentProjectId: "",
		currentTopicMode: defaultTopicMode,
		setCurrentContext: vi.fn(),
		setSelectedLanguageModel: vi.fn(),
		setSelectedImageModel: vi.fn(),
		setLoading: vi.fn(),
		reset: vi.fn(),
	}

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

	beforeEach(() => {
		vi.clearAllMocks()
		mockTopicModelStore.currentTopicId = "default"
		mockTopicModelStore.currentProjectId = ""
		mockTopicModelStore.currentTopicMode = defaultTopicMode
	})

	describe("initialization", () => {
		it("should initialize service on mount", () => {
			renderHook(() => useTopicModel({ topicModelStore: mockTopicModelStore }))

			expect(superMagicTopicModelService.initForStore).toHaveBeenCalledTimes(1)
			expect(superMagicTopicModelService.initForStore).toHaveBeenCalledWith(
				mockTopicModelStore,
			)
		})

		it("should flush all on unmount", () => {
			const { unmount } = renderHook(() =>
				useTopicModel({ topicModelStore: mockTopicModelStore }),
			)

			unmount()

			expect(superMagicTopicModelService.flushAll).toHaveBeenCalledTimes(1)
			expect(superMagicTopicModelService.destroyForStore).toHaveBeenCalledWith(
				mockTopicModelStore,
			)
		})
	})

	describe("context synchronization", () => {
		it("should sync context to Store when props change", () => {
			const { rerender } = renderHook(
				({ selectedTopic, selectedProject, topicMode }) =>
					useTopicModel({
						selectedTopic,
						selectedProject,
						topicMode,
						topicModelStore: mockTopicModelStore,
					}),
				{
					initialProps: {
						selectedTopic: topic1,
						selectedProject: project1,
						topicMode: defaultTopicMode,
					},
				},
			)

			expect(mockTopicModelStore.setCurrentContext).toHaveBeenCalledWith(
				"topic-1",
				"project-1",
				"general",
			)

			// Change props
			rerender({
				selectedTopic: topic2,
				selectedProject: project2,
				topicMode: "chat" as TopicMode,
			})

			expect(mockTopicModelStore.setCurrentContext).toHaveBeenCalledWith(
				"topic-2",
				"project-2",
				"chat",
			)
		})

		it("should use default topic ID when selectedTopic is null", () => {
			renderHook(() =>
				useTopicModel({
					selectedTopic: null,
					selectedProject: null,
					topicModelStore: mockTopicModelStore,
				}),
			)

			expect(mockTopicModelStore.setCurrentContext).toHaveBeenCalledWith(
				undefined,
				"",
				"general",
			)
		})
	})

	describe("model selection", () => {
		it("should call service.validateSelectedModels when validating current selection", () => {
			const { result } = renderHook(() =>
				useTopicModel({ topicModelStore: mockTopicModelStore }),
			)

			result.current.validateSelectedModels()

			expect(superMagicTopicModelService.validateSelectedModels).toHaveBeenCalledWith(
				mockTopicModelStore,
			)
		})

		it("should call service.saveModel when setSelectedModel is called", () => {
			const { result } = renderHook(() =>
				useTopicModel({ topicModelStore: mockTopicModelStore }),
			)

			// Mock store values
			mockTopicModelStore.currentTopicId = "topic-1"
			mockTopicModelStore.currentProjectId = "project-1"

			result.current.setSelectedModel(mockLanguageModel)

			expect(superMagicTopicModelService.saveModel).toHaveBeenCalledWith(
				"topic-1",
				"project-1",
				mockLanguageModel,
				undefined,
				mockTopicModelStore,
			)
		})

		it("should call service.saveModel when setSelectedImageModel is called", () => {
			const { result } = renderHook(() =>
				useTopicModel({ topicModelStore: mockTopicModelStore }),
			)

			const mockImageModel: ModelItem = {
				...mockLanguageModel,
				model_id: "dall-e-3",
			}

			// Mock store values
			mockTopicModelStore.currentTopicId = "topic-1"
			mockTopicModelStore.currentProjectId = "project-1"

			result.current.setSelectedImageModel(mockImageModel)

			expect(superMagicTopicModelService.saveModel).toHaveBeenCalledWith(
				"topic-1",
				"project-1",
				undefined,
				mockImageModel,
				mockTopicModelStore,
			)
		})
	})

	describe("return values", () => {
		it("should return model lists from mode service", () => {
			const { result } = renderHook(() =>
				useTopicModel({ topicModelStore: mockTopicModelStore }),
			)

			expect(result.current.modelList).toBeDefined()
			expect(result.current.imageModelList).toBeDefined()
		})

		it("should return topic store instance", () => {
			const { result } = renderHook(() =>
				useTopicModel({ topicModelStore: mockTopicModelStore }),
			)

			expect(result.current.topicModelStore).toBe(mockTopicModelStore)
		})
	})
})
