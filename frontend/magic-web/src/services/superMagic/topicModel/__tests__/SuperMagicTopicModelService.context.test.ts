import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/types"
import { ModelStatusEnum } from "@/pages/superMagic/components/MessageEditor/types"
import { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import superMagicModeService from "../../SuperMagicModeService"
import superMagicTopicModelCacheService from "../SuperMagicTopicModelCacheService"
import superMagicTopicModelService, {
	getTopicModelContextKey,
} from "../SuperMagicTopicModelService"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getSuperMagicTopicModel: vi.fn(),
		saveSuperMagicTopicModel: vi.fn(),
	},
}))

vi.mock("../SuperMagicTopicModelCacheService", () => ({
	default: {
		getDefaultModel: vi.fn(),
		getModeDefaultModel: vi.fn(),
		getTopicModel: vi.fn(),
		getProjectModel: vi.fn(),
		saveTopicModel: vi.fn(),
		saveProjectModel: vi.fn(),
		saveModeDefaultModel: vi.fn(),
	},
}))

vi.mock("../../SuperMagicModeService", () => ({
	default: {
		getModelListByMode: vi.fn(),
		getImageModelListByMode: vi.fn(() => []),
		getVideoModelListByMode: vi.fn(() => []),
		resolveLanguageModelByMode: vi.fn(),
		resolveImageModelByMode: vi.fn(async () => null),
		resolveVideoModelByMode: vi.fn(async () => null),
		// The cascade only waits for the crew list while its availability is unknown.
		isModeAvailabilityResolved: true,
	},
	resolveModeMapKey: (topicMode: string, agentCode?: string | null) =>
		topicMode === "custom_agent" && agentCode ? agentCode : topicMode,
}))

function createModel(modelId: string): ModelItem {
	return {
		id: modelId,
		group_id: "group-1",
		model_id: modelId,
		model_name: modelId,
		provider_model_id: modelId,
		model_description: "",
		model_icon: "",
		model_status: ModelStatusEnum.Normal,
		sort: 1,
	}
}

function createDeferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise
	})
	return { promise, resolve }
}

describe("SuperMagicTopicModelService context isolation", () => {
	const dataAnalysisModel = createModel("data-analysis-model")
	const oldDataAnalysisModel = createModel("old-data-analysis-model")
	const newDataAnalysisModel = createModel("new-data-analysis-model")
	const summaryModel = createModel("summary-model")

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(superMagicTopicModelCacheService.getDefaultModel).mockResolvedValue(null)
		vi.mocked(superMagicTopicModelCacheService.getModeDefaultModel).mockResolvedValue(null)
		vi.mocked(superMagicTopicModelCacheService.getTopicModel).mockResolvedValue(null)
		vi.mocked(superMagicTopicModelCacheService.getProjectModel).mockResolvedValue(null)
		vi.mocked(superMagicTopicModelCacheService.saveTopicModel).mockResolvedValue(undefined)
		vi.mocked(superMagicTopicModelCacheService.saveProjectModel).mockResolvedValue(undefined)
		vi.mocked(superMagicTopicModelCacheService.saveModeDefaultModel).mockResolvedValue(
			undefined,
		)
		vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockResolvedValue({} as never)
		vi.mocked(SuperMagicApi.saveSuperMagicTopicModel).mockResolvedValue({} as never)
		vi.mocked(superMagicModeService.getModelListByMode).mockImplementation((mode) =>
			mode === "summary" ? [summaryModel] : [dataAnalysisModel],
		)
		vi.mocked(superMagicModeService.resolveLanguageModelByMode).mockImplementation(
			async (mode, modelId) =>
				superMagicModeService
					.getModelListByMode(mode)
					.find((model) => model.model_id === modelId) ?? null,
		)
	})

	afterEach(() => {
		vi.restoreAllMocks()
		superMagicTopicModelService.destroy()
	})

	it("does not let an older context request overwrite the current context", async () => {
		const dataAnalysisResponse = createDeferred<{ model: { model_id: string } }>()
		const summaryResponse = createDeferred<{ model: { model_id: string } }>()
		vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockImplementation(({ topic_id }) => {
			if (topic_id === "topic-a") return dataAnalysisResponse.promise as never
			if (topic_id === "topic-b") return summaryResponse.promise as never
			return Promise.resolve({}) as never
		})

		const store = createSuperMagicTopicModelStore()
		store.setCurrentContext("topic-a", "project-1", "data_analysis")
		const dataAnalysisRequest = superMagicTopicModelService.fetchTopicModel(
			"topic-a",
			"project-1",
			"data_analysis",
			store,
		)
		await vi.waitFor(() => {
			expect(
				vi
					.mocked(SuperMagicApi.getSuperMagicTopicModel)
					.mock.calls.some(([params]) => params.topic_id === "topic-a"),
			).toBe(true)
		})

		store.setCurrentContext("topic-b", "project-1", "summary")
		const summaryRequest = superMagicTopicModelService.fetchTopicModel(
			"topic-b",
			"project-1",
			"summary",
			store,
		)
		summaryResponse.resolve({ model: { model_id: summaryModel.model_id } })
		await summaryRequest

		dataAnalysisResponse.resolve({ model: { model_id: dataAnalysisModel.model_id } })
		await dataAnalysisRequest

		expect(store.currentTopicId).toBe("topic-b")
		expect(store.selectedLanguageModel?.model_id).toBe(summaryModel.model_id)
		expect(store.isLoading).toBe(false)
	})

	it("does not let an older request overwrite a newer request after an A-B-A switch", async () => {
		const oldDataAnalysisResponse = createDeferred<{ model: { model_id: string } }>()
		const summaryResponse = createDeferred<{ model: { model_id: string } }>()
		const newDataAnalysisResponse = createDeferred<{ model: { model_id: string } }>()
		const dataAnalysisResponses = [
			oldDataAnalysisResponse.promise,
			newDataAnalysisResponse.promise,
		]
		vi.mocked(superMagicModeService.getModelListByMode).mockImplementation((mode) =>
			mode === "summary" ? [summaryModel] : [oldDataAnalysisModel, newDataAnalysisModel],
		)
		vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockImplementation(({ topic_id }) => {
			if (topic_id === "topic-a") return dataAnalysisResponses.shift() as never
			if (topic_id === "topic-b") return summaryResponse.promise as never
			return Promise.resolve({}) as never
		})

		const store = createSuperMagicTopicModelStore()
		store.setCurrentContext("topic-a", "project-1", "data_analysis")
		const oldDataAnalysisRequest = superMagicTopicModelService.fetchTopicModel(
			"topic-a",
			"project-1",
			"data_analysis",
			store,
		)
		await vi.waitFor(() => {
			expect(
				vi
					.mocked(SuperMagicApi.getSuperMagicTopicModel)
					.mock.calls.filter(([params]) => params.topic_id === "topic-a"),
			).toHaveLength(1)
		})

		store.setCurrentContext("topic-b", "project-1", "summary")
		const summaryRequest = superMagicTopicModelService.fetchTopicModel(
			"topic-b",
			"project-1",
			"summary",
			store,
		)
		await vi.waitFor(() => {
			expect(
				vi
					.mocked(SuperMagicApi.getSuperMagicTopicModel)
					.mock.calls.some(([params]) => params.topic_id === "topic-b"),
			).toBe(true)
		})

		store.setCurrentContext("topic-a", "project-1", "data_analysis")
		const newDataAnalysisRequest = superMagicTopicModelService.fetchTopicModel(
			"topic-a",
			"project-1",
			"data_analysis",
			store,
		)
		await vi.waitFor(() => {
			expect(
				vi
					.mocked(SuperMagicApi.getSuperMagicTopicModel)
					.mock.calls.filter(([params]) => params.topic_id === "topic-a"),
			).toHaveLength(2)
		})

		newDataAnalysisResponse.resolve({ model: { model_id: newDataAnalysisModel.model_id } })
		await newDataAnalysisRequest
		summaryResponse.resolve({ model: { model_id: summaryModel.model_id } })
		await summaryRequest
		oldDataAnalysisResponse.resolve({ model: { model_id: oldDataAnalysisModel.model_id } })
		await oldDataAnalysisRequest

		expect(store.currentTopicId).toBe("topic-a")
		expect(store.selectedLanguageModel?.model_id).toBe(newDataAnalysisModel.model_id)
		expect(store.isLoading).toBe(false)
	})

	it("ignores a direct fetch whose parameters differ from the store context", async () => {
		vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockResolvedValue({
			model: { model_id: dataAnalysisModel.model_id },
		} as never)

		const store = createSuperMagicTopicModelStore()
		store.setLoading(false)
		await superMagicTopicModelService.fetchTopicModel(
			"topic-1",
			"project-1",
			"data_analysis",
			store,
		)

		expect(SuperMagicApi.getSuperMagicTopicModel).not.toHaveBeenCalled()
		expect(store.selectedLanguageModel).toBeNull()
		expect(store.isLoading).toBe(false)
	})

	it("refetches the new mode when the previous context is still loading", async () => {
		const autoModel = createModel("auto-model")
		const deepseekModel = createModel("deepseek-v4-flash")
		const initialResponse = createDeferred<{ model: { model_id: string } }>()
		const generalResponse = createDeferred<{ model: { model_id: string } }>()
		const responses = [initialResponse.promise, generalResponse.promise]

		vi.mocked(superMagicModeService.getModelListByMode).mockImplementation((mode) =>
			mode === "general" ? [autoModel, deepseekModel] : [dataAnalysisModel],
		)
		vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockImplementation(({ topic_id }) => {
			if (topic_id === "topic-1") return responses.shift() as never
			return Promise.resolve({}) as never
		})

		const store = createSuperMagicTopicModelStore()
		superMagicTopicModelService.initForStore(store)
		store.setCurrentContext("topic-1", "project-1", "ip-manager")

		await vi.waitFor(() => {
			expect(
				vi
					.mocked(SuperMagicApi.getSuperMagicTopicModel)
					.mock.calls.filter(([params]) => params.topic_id === "topic-1"),
			).toHaveLength(1)
		})

		store.setCurrentContext("topic-1", "project-1", "general")

		await vi.waitFor(() => {
			expect(
				vi
					.mocked(SuperMagicApi.getSuperMagicTopicModel)
					.mock.calls.filter(([params]) => params.topic_id === "topic-1"),
			).toHaveLength(2)
		})

		generalResponse.resolve({ model: { model_id: deepseekModel.model_id } })
		await vi.waitFor(() => {
			expect(store.selectedLanguageModel?.model_id).toBe(deepseekModel.model_id)
			expect(store.isLoading).toBe(false)
		})
		expect(store.selectedLanguageModel?.model_id).not.toBe(autoModel.model_id)
		expect(SuperMagicApi.saveSuperMagicTopicModel).not.toHaveBeenCalled()
		expect(superMagicTopicModelCacheService.saveProjectModel).not.toHaveBeenCalled()

		initialResponse.resolve({ model: { model_id: dataAnalysisModel.model_id } })
	})

	it("does not persist Auto when validating before models are loaded", async () => {
		const autoModel = createModel("auto-model")
		const deepseekModel = createModel("deepseek-v4-flash")
		vi.mocked(superMagicModeService.getModelListByMode).mockReturnValue([
			autoModel,
			deepseekModel,
		])

		const store = createSuperMagicTopicModelStore()
		store.setCurrentContext("topic-1", "project-1", "general")

		await superMagicTopicModelService.validateSelectedModels(store)

		expect(store.selectedLanguageModel).toBeNull()
		expect(SuperMagicApi.saveSuperMagicTopicModel).not.toHaveBeenCalled()
		expect(superMagicTopicModelCacheService.saveTopicModel).not.toHaveBeenCalled()
		expect(superMagicTopicModelCacheService.saveProjectModel).not.toHaveBeenCalled()
	})

	it("does not persist Auto when validating with a stale model after context change", async () => {
		const autoModel = createModel("auto-model")
		vi.mocked(superMagicModeService.getModelListByMode).mockReturnValue([autoModel])
		vi.mocked(superMagicModeService.resolveLanguageModelByMode).mockResolvedValue(null)

		const store = createSuperMagicTopicModelStore()
		store.setCurrentContext("topic-1", "project-1", "general")
		store.setSelectedLanguageModel(dataAnalysisModel)
		store.markCurrentContextLoaded(
			getTopicModelContextKey({
				topicId: "topic-1",
				projectId: "project-1",
				topicMode: "general",
			}),
		)
		store.setCurrentContext("topic-2", "project-1", "general")

		await superMagicTopicModelService.validateSelectedModels(store)

		expect(store.selectedLanguageModel?.model_id).toBe(dataAnalysisModel.model_id)
		expect(SuperMagicApi.saveSuperMagicTopicModel).not.toHaveBeenCalled()
		expect(superMagicTopicModelCacheService.saveTopicModel).not.toHaveBeenCalled()
		expect(superMagicTopicModelCacheService.saveProjectModel).not.toHaveBeenCalled()
	})

	it("resets isLoading when validation throws", async () => {
		vi.mocked(superMagicModeService.resolveLanguageModelByMode).mockRejectedValue(
			new Error("validation failed"),
		)

		const store = createSuperMagicTopicModelStore()
		store.setCurrentContext("topic-1", "project-1", "general")
		store.setSelectedLanguageModel(dataAnalysisModel)
		store.markCurrentContextLoaded(
			getTopicModelContextKey({
				topicId: "topic-1",
				projectId: "project-1",
				topicMode: "general",
			}),
		)

		await expect(superMagicTopicModelService.validateSelectedModels(store)).rejects.toThrow(
			"validation failed",
		)

		expect(store.isLoading).toBe(false)
	})

	it("restores readiness after validating a same-topic mode change", async () => {
		const store = createSuperMagicTopicModelStore()
		store.setCurrentContext("topic-1", "project-1", "summary")
		store.setSelectedLanguageModel(dataAnalysisModel)
		store.markCurrentContextLoaded(
			getTopicModelContextKey({
				topicId: "topic-1",
				projectId: "project-1",
				topicMode: "summary",
			}),
		)
		vi.mocked(superMagicModeService.resolveLanguageModelByMode).mockResolvedValue(null)

		await superMagicTopicModelService.validateSelectedModels(store)

		expect(store.selectedLanguageModel?.model_id).toBe(summaryModel.model_id)
		expect(store.isLoading).toBe(false)
		expect(store.isLanguageModelReady).toBe(true)
	})

	it("does not let an older validation overwrite a newer A-B-A validation", async () => {
		const oldDataAnalysisResponse = createDeferred<null>()
		const summaryResponse = createDeferred<null>()
		const newDataAnalysisResponse = createDeferred<null>()
		const dataAnalysisResponses = [oldDataAnalysisResponse, newDataAnalysisResponse]
		const dataAnalysisModelLists = [[oldDataAnalysisModel], [newDataAnalysisModel]]
		let dataAnalysisListCallCount = 0
		vi.mocked(superMagicModeService.getModelListByMode).mockImplementation((mode) => {
			if (mode === "summary") return [summaryModel]
			const listIndex = Math.floor(dataAnalysisListCallCount / 2)
			dataAnalysisListCallCount += 1
			return dataAnalysisModelLists[listIndex] ?? []
		})
		vi.mocked(superMagicModeService.resolveLanguageModelByMode).mockImplementation((mode) =>
			mode === "summary"
				? summaryResponse.promise
				: (dataAnalysisResponses.shift()?.promise ?? Promise.resolve(null)),
		)

		const store = createSuperMagicTopicModelStore()
		store.setCurrentContext("topic-1", "project-1", "data_analysis")
		store.setSelectedLanguageModel(oldDataAnalysisModel)
		store.markCurrentContextLoaded(
			getTopicModelContextKey({
				topicId: "topic-1",
				projectId: "project-1",
				topicMode: "data_analysis",
			}),
		)
		const oldDataAnalysisValidation = superMagicTopicModelService.validateSelectedModels(store)
		await vi.waitFor(() => {
			expect(superMagicModeService.resolveLanguageModelByMode).toHaveBeenCalledTimes(1)
		})

		store.setCurrentContext("topic-1", "project-1", "summary")
		store.markCurrentContextLoaded(
			getTopicModelContextKey({
				topicId: "topic-1",
				projectId: "project-1",
				topicMode: "summary",
			}),
		)
		const summaryValidation = superMagicTopicModelService.validateSelectedModels(store)
		await vi.waitFor(() => {
			expect(superMagicModeService.resolveLanguageModelByMode).toHaveBeenCalledTimes(2)
		})

		store.setCurrentContext("topic-1", "project-1", "data_analysis")
		store.markCurrentContextLoaded(
			getTopicModelContextKey({
				topicId: "topic-1",
				projectId: "project-1",
				topicMode: "data_analysis",
			}),
		)
		const newDataAnalysisValidation = superMagicTopicModelService.validateSelectedModels(store)
		await vi.waitFor(() => {
			expect(superMagicModeService.resolveLanguageModelByMode).toHaveBeenCalledTimes(3)
		})

		newDataAnalysisResponse.resolve(null)
		await newDataAnalysisValidation
		summaryResponse.resolve(null)
		await summaryValidation
		oldDataAnalysisResponse.resolve(null)
		await oldDataAnalysisValidation

		expect(store.currentTopicMode).toBe("data_analysis")
		expect(store.selectedLanguageModel?.model_id).toBe(newDataAnalysisModel.model_id)
		expect(store.isLoading).toBe(false)
	})

	it("still saves remote topic backfill after local write if context switches", async () => {
		const topicSave = createDeferred<void>()
		vi.mocked(superMagicTopicModelCacheService.saveTopicModel).mockImplementation(
			() => topicSave.promise,
		)
		vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockImplementation(({ topic_id }) => {
			if (topic_id === "project_id_project-1") {
				return Promise.resolve({ model: { model_id: dataAnalysisModel.model_id } }) as never
			}
			return Promise.resolve({}) as never
		})

		const store = createSuperMagicTopicModelStore()
		store.setCurrentContext("topic-1", "project-1", "general")
		const fetchPromise = superMagicTopicModelService.fetchTopicModel(
			"topic-1",
			"project-1",
			"general",
			store,
		)

		await vi.waitFor(() => {
			expect(superMagicTopicModelCacheService.saveTopicModel).toHaveBeenCalledWith(
				"topic-1",
				expect.objectContaining({ languageModelId: dataAnalysisModel.model_id }),
			)
		})

		store.setCurrentContext("topic-2", "project-1", "general")
		topicSave.resolve()
		await fetchPromise

		expect(SuperMagicApi.saveSuperMagicTopicModel).toHaveBeenCalledWith(
			expect.objectContaining({
				cache_id: "topic-1",
				model_id: dataAnalysisModel.model_id,
			}),
		)
	})
})
