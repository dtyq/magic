import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/types"
import { ModelStatusEnum } from "@/pages/superMagic/components/MessageEditor/types"
import { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import superMagicModeService from "../../SuperMagicModeService"
import superMagicTopicModelCacheService from "../SuperMagicTopicModelCacheService"
import superMagicTopicModelService from "../SuperMagicTopicModelService"

const reportMock = vi.hoisted(() => vi.fn())

vi.mock("@/infrastructure/logger", () => ({
	logger: {
		createLogger: () => ({
			log: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			report: reportMock,
		}),
	},
}))

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

function reportedMessages() {
	return reportMock.mock.calls.map(([message]) => message as string)
}

describe("SuperMagicTopicModelService observability", () => {
	const dataAnalysisModel = createModel("data-analysis-model")
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
		vi.mocked(SuperMagicApi.saveSuperMagicTopicModel).mockResolvedValue({
			model: { model_id: dataAnalysisModel.model_id },
		} as never)
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

	it("reports a rejected backend save instead of swallowing it", async () => {
		vi.mocked(SuperMagicApi.saveSuperMagicTopicModel).mockResolvedValue({
			success: false,
			message: "forbidden",
		} as never)

		const store = createSuperMagicTopicModelStore()
		store.setCurrentContext("topic-a", "project-1", "data_analysis")
		await superMagicTopicModelService.saveModel(
			"topic-a",
			"project-1",
			dataAnalysisModel,
			null,
			null,
			store,
		)
		await superMagicTopicModelService.flushAll()

		expect(reportMock).toHaveBeenCalledWith(
			"[Save] Backend save rejected",
			expect.objectContaining({
				cacheId: "topic-a",
				topicId: "topic-a",
				languageModelId: dataAnalysisModel.model_id,
				success: false,
				message: "forbidden",
			}),
		)
		const rejectedPayload = reportMock.mock.calls.find(
			([message]) => message === "[Save] Backend save rejected",
		)?.[1]
		expect(rejectedPayload).not.toHaveProperty("response")
		expect(reportedMessages()).not.toContain("[Save] Backend save successful")
	})

	it("reports a summarized backend error without the original object", async () => {
		vi.mocked(SuperMagicApi.saveSuperMagicTopicModel).mockRejectedValue({
			code: 403,
			message: "forbidden",
			internal: { stack: "private stack" },
		})

		const store = createSuperMagicTopicModelStore()
		store.setCurrentContext("topic-a", "project-1", "data_analysis")
		await superMagicTopicModelService.saveModel(
			"topic-a",
			"project-1",
			dataAnalysisModel,
			null,
			null,
			store,
		)
		await superMagicTopicModelService.flushAll()

		const failedPayload = reportMock.mock.calls.find(
			([message]) => message === "[Save] Backend save failed",
		)?.[1]
		expect(failedPayload).toMatchObject({
			errorCode: 403,
			errorMessage: "forbidden",
		})
		expect(failedPayload).not.toHaveProperty("error")
		expect(failedPayload).not.toHaveProperty("internal")
	})

	it("reports a successful backend save without a rejection", async () => {
		const store = createSuperMagicTopicModelStore()
		store.setCurrentContext("topic-a", "project-1", "data_analysis")
		await superMagicTopicModelService.saveModel(
			"topic-a",
			"project-1",
			dataAnalysisModel,
			null,
			null,
			store,
		)
		await superMagicTopicModelService.flushAll()

		expect(reportedMessages()).toContain("[Save] Backend save successful")
		expect(reportedMessages()).not.toContain("[Save] Backend save rejected")
	})

	it("summarizes remote fetch errors without the original object", async () => {
		vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockRejectedValue({
			code: 502,
			message: "bad gateway",
			internal: { stack: "private stack" },
		})

		const store = createSuperMagicTopicModelStore()
		store.setCurrentContext("topic-a", "project-1", "data_analysis")
		await superMagicTopicModelService.fetchTopicModel(
			"topic-a",
			"project-1",
			"data_analysis",
			store,
		)

		const failedPayload = reportMock.mock.calls.find(
			([message]) => message === "[Fallback] Topic remote API failed",
		)?.[1]
		expect(failedPayload).toMatchObject({
			errorCode: 502,
			errorMessage: "bad gateway",
		})
		expect(failedPayload).not.toHaveProperty("error")
		expect(failedPayload).not.toHaveProperty("internal")
	})

	it("reports a discarded request once when the context changes mid-flight", async () => {
		const pendingResponse = createDeferred<{ model: { model_id: string } }>()
		vi.mocked(SuperMagicApi.getSuperMagicTopicModel).mockImplementation(({ topic_id }) => {
			if (topic_id === "topic-a") return pendingResponse.promise as never
			return Promise.resolve({}) as never
		})

		const store = createSuperMagicTopicModelStore()
		store.setCurrentContext("topic-a", "project-1", "data_analysis")
		const staleRequest = superMagicTopicModelService.fetchTopicModel(
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
		pendingResponse.resolve({ model: { model_id: dataAnalysisModel.model_id } })
		await staleRequest

		const discardCalls = reportMock.mock.calls.filter(
			([message]) => message === "[Request] Discarding stale request",
		)
		expect(discardCalls).toHaveLength(1)
		expect(discardCalls[0][1]).toMatchObject({
			reason: "context changed",
			requestedContextKey: JSON.stringify(["topic-a", "project-1", "data_analysis", ""]),
			currentContextKey: JSON.stringify(["topic-b", "project-1", "summary", ""]),
		})
	})

	it("tags cascade logs with the owning requestId", async () => {
		const store = createSuperMagicTopicModelStore()
		store.setCurrentContext("topic-a", "project-1", "data_analysis")
		await superMagicTopicModelService.fetchTopicModel(
			"topic-a",
			"project-1",
			"data_analysis",
			store,
		)

		const cascadeCalls = reportMock.mock.calls.filter(([message]) =>
			(message as string).startsWith("[Fallback]"),
		)
		expect(cascadeCalls.length).toBeGreaterThan(0)
		cascadeCalls.forEach(([, payload]) => {
			expect(payload).toHaveProperty("requestId", expect.any(Number))
		})
	})
})
