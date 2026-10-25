import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import useTopicModel from "../useTopicModel"
import { superMagicTopicModelService } from "@/services/superMagic/topicModel"
import { ModelStatusEnum, type ModelItem } from "../../types"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"

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
		defaultAgentCode: "SMA-default",
		isModeValid: vi.fn((mode: string) => mode === "SMA-default"),
		getModelGroupsByMode: vi.fn(() => []),
		getImageModelGroupsByMode: vi.fn(() => []),
		getVideoModelGroupsByMode: vi.fn(() => []),
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
		selectedVideoModel: null,
		isLoading: false,
		isLanguageModelReady: false,
		currentTopicId: "default",
		currentProjectId: "",
		currentTopicMode: defaultTopicMode,
		currentAgentCode: "",
		setCurrentContext: vi.fn(),
		setSelectedLanguageModel: vi.fn(),
		setSelectedImageModel: vi.fn(),
		setSelectedVideoModel: vi.fn(),
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
		it("uses the composer employee for every model catalog and updates it on switch", () => {
			const { rerender } = renderHook(
				({ agentCode }) =>
					useTopicModel({
						selectedTopic: { id: "topic-1", agent_code: "SMA-history" } as Topic,
						selectedProject: project1,
						topicMode: TopicMode.CustomAgent,
						agentCode,
						topicModelStore: mockTopicModelStore,
					}),
				{ initialProps: { agentCode: "SMA-default" } },
			)

			for (const agentCode of ["SMA-default", "SMA-next"]) {
				if (agentCode === "SMA-next") rerender({ agentCode })
				for (const getGroups of [
					superMagicModeService.getModelGroupsByMode,
					superMagicModeService.getImageModelGroupsByMode,
					superMagicModeService.getVideoModelGroupsByMode,
				]) {
					expect(getGroups).toHaveBeenLastCalledWith(TopicMode.CustomAgent, agentCode)
				}
				expect(mockTopicModelStore.setCurrentContext).toHaveBeenLastCalledWith(
					"topic-1",
					"project-1",
					TopicMode.CustomAgent,
					agentCode,
				)
			}
		})

		it("uses the default custom agent catalog for a new chat", () => {
			renderHook(() =>
				useTopicModel({
					selectedTopic: null,
					selectedProject: null,
					topicMode: TopicMode.CustomAgent,
					topicModelStore: mockTopicModelStore,
				}),
			)

			expect(superMagicModeService.getModelGroupsByMode).toHaveBeenCalledWith(
				TopicMode.CustomAgent,
				"SMA-default",
			)
			expect(mockTopicModelStore.setCurrentContext).toHaveBeenCalledWith(
				undefined,
				"",
				TopicMode.CustomAgent,
				"SMA-default",
			)
		})

		it("keeps the selected topic agent ahead of the platform default", () => {
			renderHook(() =>
				useTopicModel({
					selectedTopic: { id: "topic-1", agent_code: "SMA-topic" } as Topic,
					selectedProject: project1,
					topicMode: TopicMode.CustomAgent,
					topicModelStore: mockTopicModelStore,
				}),
			)

			expect(superMagicModeService.getModelGroupsByMode).toHaveBeenCalledWith(
				TopicMode.CustomAgent,
				"SMA-topic",
			)
		})

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
				undefined,
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
				undefined,
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
				undefined,
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
				undefined,
				mockTopicModelStore,
			)
		})

		it("should call service.saveModel when setSelectedVideoModel is called", () => {
			const { result } = renderHook(() =>
				useTopicModel({ topicModelStore: mockTopicModelStore }),
			)

			const mockVideoModel: ModelItem = {
				...mockLanguageModel,
				model_id: "video-gen-1",
			}

			mockTopicModelStore.currentTopicId = "topic-1"
			mockTopicModelStore.currentProjectId = "project-1"

			result.current.setSelectedVideoModel(mockVideoModel)

			expect(superMagicTopicModelService.saveModel).toHaveBeenCalledWith(
				"topic-1",
				"project-1",
				undefined,
				undefined,
				mockVideoModel,
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
			expect(result.current.videoModelList).toBeDefined()
		})

		it("should return topic store instance", () => {
			const { result } = renderHook(() =>
				useTopicModel({ topicModelStore: mockTopicModelStore }),
			)

			expect(result.current.topicModelStore).toBe(mockTopicModelStore)
		})
	})
})
