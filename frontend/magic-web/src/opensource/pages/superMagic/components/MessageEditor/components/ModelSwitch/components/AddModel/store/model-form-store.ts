import { makeAutoObservable } from "mobx"
import {
	MODEL_TYPE_LLM,
	MODEL_TYPE_IMAGE,
	type SaveAiModelParams,
} from "@/opensource/apis/modules/org-ai-model-provider"
import type { ModelInfo } from "../types"

export type AddModelType = "text" | "image"

const CATEGORY_MAP: Record<AddModelType, "llm" | "vlm"> = {
	text: "llm",
	image: "vlm",
}

const MODEL_TYPE_MAP: Record<AddModelType, number> = {
	text: MODEL_TYPE_LLM,
	image: MODEL_TYPE_IMAGE,
}

export class ModelFormStore {
	addModelType: AddModelType = "text"

	selectedProviderId = ""
	providerModelId = ""
	modelName = ""
	modelConfig: NonNullable<SaveAiModelParams["config"]> = {}

	editingModel: ModelInfo | null = null

	constructor() {
		makeAutoObservable(this)
	}

	get category(): "llm" | "vlm" {
		return CATEGORY_MAP[this.addModelType]
	}

	get modelType(): number {
		return MODEL_TYPE_MAP[this.addModelType]
	}

	get isFormValid(): boolean {
		return (
			this.selectedProviderId !== "" &&
			this.providerModelId.trim() !== "" &&
			this.addModelType !== undefined
		)
	}

	setAddModelType(type: AddModelType) {
		if (this.addModelType !== type) {
			this.addModelType = type
			this.selectedProviderId = ""
		} else {
			this.addModelType = type
		}
	}

	setSelectedProviderId(id: string) {
		this.selectedProviderId = id
	}

	setProviderModelId(value: string) {
		this.providerModelId = value
	}

	setModelName(value: string) {
		this.modelName = value
	}

	setModelConfig(value: NonNullable<SaveAiModelParams["config"]>) {
		this.modelConfig = { ...value }
	}

	clearModelConfig() {
		this.modelConfig = {}
	}

	openEditModel(model: ModelInfo) {
		this.editingModel = model
		this.addModelType = this.inferAddModelType(model.model_type)
		this.selectedProviderId = model.service_provider_config_id
		this.providerModelId = model.model_version || model.model_id
		this.modelName = model.name ?? ""
	}

	/** Apply fetched model detail to form (used after API fetch) */
	applyEditModelDetail(detail: ModelInfo) {
		this.editingModel = detail
		this.addModelType = this.inferAddModelType(detail.model_type)
		this.selectedProviderId = detail.service_provider_config_id
		this.providerModelId = detail.model_version || detail.model_id
		this.modelName = detail.name ?? ""
		const config = (detail as ModelInfo & { config?: SaveAiModelParams["config"] }).config
		if (config) this.modelConfig = { ...config }
	}

	closeEditModel() {
		this.editingModel = null
		this.resetForm()
	}

	resetForm() {
		this.selectedProviderId = ""
		this.providerModelId = ""
		this.modelName = ""
		this.modelConfig = {}
	}

	private inferAddModelType(modelType: number): AddModelType {
		if (modelType === MODEL_TYPE_IMAGE) return "image"
		return "text"
	}
}
