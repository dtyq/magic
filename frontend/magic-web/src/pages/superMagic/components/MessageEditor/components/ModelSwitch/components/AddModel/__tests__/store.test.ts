import { beforeEach, describe, expect, it, vi } from "vitest"
import { MODEL_TYPE_LLM } from "@/opensource/apis/modules/org-ai-model-provider"
import type { LlmModelItem } from "@/opensource/apis/modules/superMagic"
import { AddModelStore, buildMatchedModelConfig } from "../store"

const { saveAiModelMock, deleteAiModelMock, getMyModelsMock } = vi.hoisted(() => ({
	saveAiModelMock: vi.fn(),
	deleteAiModelMock: vi.fn(),
	getMyModelsMock: vi.fn(),
}))

vi.mock("@/opensource/apis", () => ({
	OrgAiModelProviderApi: {
		saveAiModel: saveAiModelMock,
		deleteAiModel: deleteAiModelMock,
	},
}))

vi.mock("@/opensource/services/superMagic/SuperMagicCustomModelService", () => ({
	default: {
		getMyModels: getMyModelsMock,
	},
}))

describe("AddModelStore", () => {
	beforeEach(() => {
		saveAiModelMock.mockReset()
		deleteAiModelMock.mockReset()
		getMyModelsMock.mockReset()
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
