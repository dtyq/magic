import { beforeEach, describe, expect, it, vi } from "vitest"
import { MODEL_TYPE_LLM, MODEL_TYPE_VIDEO } from "@/apis/modules/org-ai-model-provider"
import type { LlmModelItem } from "@/apis/modules/superMagic"
import { AddModelStore, buildMatchedModelConfig } from "../store"
import { ModelFormStore } from "../store/model-form-store"

const {
	saveAiModelMock,
	deleteAiModelMock,
	getMyModelsMock,
	getOrgAiModelProviderListMock,
	getNonOfficialProviderTemplatesMock,
} = vi.hoisted(() => ({
	saveAiModelMock: vi.fn(),
	deleteAiModelMock: vi.fn(),
	getMyModelsMock: vi.fn(),
	getOrgAiModelProviderListMock: vi.fn(),
	getNonOfficialProviderTemplatesMock: vi.fn(),
}))

vi.mock("@/apis", () => ({
	OrgAiModelProviderApi: {
		saveAiModel: saveAiModelMock,
		deleteAiModel: deleteAiModelMock,
		getOrgAiModelProviderList: getOrgAiModelProviderListMock,
		getNonOfficialProviderTemplates: getNonOfficialProviderTemplatesMock,
	},
}))

vi.mock("@/services/superMagic/SuperMagicCustomModelService", () => ({
	default: {
		getMyModels: getMyModelsMock,
	},
}))

vi.mock("../providerFieldConfigs", () => ({
	normalizeProviderFieldKey: (key: string) => key,
	validateProviderFieldValue: () => null,
}))

describe("AddModelStore", () => {
	beforeEach(() => {
		saveAiModelMock.mockReset()
		deleteAiModelMock.mockReset()
		getMyModelsMock.mockReset()
		getOrgAiModelProviderListMock.mockReset()
		getNonOfficialProviderTemplatesMock.mockReset()
		saveAiModelMock.mockResolvedValue({
			id: "model-1",
			model_id: "qwen-max",
			model_version: "qwen-max",
			name: "Qwen Max",
			service_provider_config_id: "provider-1",
			model_type: MODEL_TYPE_LLM,
		})
		deleteAiModelMock.mockResolvedValue(undefined)
		getMyModelsMock.mockResolvedValue([])
		getOrgAiModelProviderListMock.mockResolvedValue([])
		getNonOfficialProviderTemplatesMock.mockResolvedValue([])
	})

	it("should map video models to the backend category and model type", () => {
		const store = new ModelFormStore()

		store.setAddModelType("video")

		expect(store.category).toBe("vgm")
		expect(store.modelType).toBe(MODEL_TYPE_VIDEO)
	})

	it("should infer video type when editing a video model", () => {
		const store = new ModelFormStore()

		store.openEditModel({
			id: "video-model-1",
			model_id: "video-model",
			model_version: "video-model-v1",
			name: "Video Model",
			service_provider_config_id: "video-provider-1",
			model_type: MODEL_TYPE_VIDEO,
			category: "vgm",
		})

		expect(store.addModelType).toBe("video")
		expect(store.category).toBe("vgm")
	})

	it("should infer the edit type from category even when model_type disagrees", () => {
		const store = new ModelFormStore()

		// 列表接口里 vlm 模型的 model_type 可能是 1，按 category 归为生图。
		store.openEditModel({
			id: "image-model-1",
			model_id: "image-model",
			model_version: "image-model-v1",
			name: "Image Model",
			service_provider_config_id: "image-provider-1",
			model_type: 1,
			category: "vlm",
		})

		expect(store.addModelType).toBe("image")
		expect(store.category).toBe("vlm")
	})

	it("should keep the current type when editing a model without a category", () => {
		const store = new ModelFormStore()
		store.setAddModelType("image")

		store.openEditModel({
			id: "unknown-model-1",
			model_id: "unknown-model",
			name: "Unknown Model",
			service_provider_config_id: "provider-1",
			model_type: 3,
		})

		// 不按 model_type 猜成文本，保持原来的类型。
		expect(store.addModelType).toBe("image")
	})

	it("should query video providers and templates with the vgm category", async () => {
		const store = new AddModelStore()
		store.openAddModel("video")

		await store.loadOrgAiModelProviders(store.category)
		await store.loadOrgAiModelProviderTemplates(store.category)

		expect(getOrgAiModelProviderListMock).toHaveBeenCalledWith("vgm")
		expect(getNonOfficialProviderTemplatesMock).toHaveBeenCalledWith("vgm")
	})

	it("should build matched model config from suggestion metadata", () => {
		const model: LlmModelItem = {
			id: "qwen-max",
			name: "Qwen Max",
			provider: "aliyun",
			description: {
				zh_CN: "desc",
				en_US: "desc",
			},
			max_output_tokens: 8192,
			max_context_tokens: 128000,
			temperature: {
				type: "fixed",
				value: 0.7,
			},
			capabilities: {
				tool_call: true,
				vision: true,
				deep_thinking: false,
			},
		}

		expect(buildMatchedModelConfig(model)).toEqual({
			max_tokens: 128000,
			support_function: true,
			support_multi_modal: true,
			support_deep_think: false,
		})
	})

	it("should submit matched config when adding a model", async () => {
		const store = new AddModelStore()
		const matchedConfig = {
			max_tokens: 64000,
			support_function: true,
			support_multi_modal: false,
			support_deep_think: true,
		}

		store.setSelectedProviderId("provider-1")
		store.setProviderModelId("qwen-max")
		store.setModelName("Qwen Max")
		store.setModelConfig(matchedConfig)

		await store.submitSaveAiModel()

		expect(saveAiModelMock).toHaveBeenCalledWith({
			service_provider_config_id: "provider-1",
			model_version: "qwen-max",
			name: "Qwen Max",
			model_type: MODEL_TYPE_LLM,
			config: matchedConfig,
		})
	})

	it("should submit model_type 5 when adding a video model", async () => {
		const store = new AddModelStore()
		store.openAddModel("video")
		store.setSelectedProviderId("video-provider-1")
		store.setProviderModelId("video-model-v1")
		store.setModelName("Video Model")

		await store.submitSaveAiModel()

		expect(saveAiModelMock).toHaveBeenCalledWith({
			service_provider_config_id: "video-provider-1",
			model_version: "video-model-v1",
			name: "Video Model",
			model_type: MODEL_TYPE_VIDEO,
			config: {},
		})
	})

	it("should not overwrite config when updating a model", async () => {
		const store = new AddModelStore()
		const model = {
			id: "model-1",
			model_id: "qwen-max-id",
			model_version: "qwen-max-v1",
			name: "Qwen Max",
			service_provider_config_id: "provider-1",
			model_type: MODEL_TYPE_LLM,
		}
		store.openEditModel(model)
		store.setSelectedProviderId("provider-1")
		store.setProviderModelId("qwen-max-v2")
		store.setModelName("Qwen Max")
		store.setModelConfig({
			max_tokens: 64000,
			support_function: true,
			support_multi_modal: false,
			support_deep_think: true,
		})

		await store.submitUpdateAiModel()

		expect(saveAiModelMock).toHaveBeenCalledOnce()
		expect(saveAiModelMock.mock.calls[0][0]).toEqual({
			id: "model-1",
			service_provider_config_id: "provider-1",
			model_version: "qwen-max-v2",
			name: "Qwen Max",
			model_type: MODEL_TYPE_LLM,
		})
	})

	it("should run onSuccess after deleting a model", async () => {
		const store = new AddModelStore()
		const onSuccess = vi.fn()

		store.openDeleteModel("model-1")

		const isDeleted = await store.confirmDeleteModel({ onSuccess })

		expect(isDeleted).toBe(true)
		expect(deleteAiModelMock).toHaveBeenCalledWith("model-1")
		expect(getMyModelsMock).toHaveBeenCalledOnce()
		expect(onSuccess).toHaveBeenCalledOnce()
		expect(store.deletingModelId).toBeNull()
	})

	it("should not run onSuccess when deleting a model fails", async () => {
		const store = new AddModelStore()
		const onSuccess = vi.fn()

		deleteAiModelMock.mockRejectedValueOnce(new Error("delete failed"))
		store.openDeleteModel("model-1")

		const isDeleted = await store.confirmDeleteModel({ onSuccess })

		expect(isDeleted).toBe(false)
		expect(onSuccess).not.toHaveBeenCalled()
		expect(store.deletingModelId).toBeNull()
	})
})
