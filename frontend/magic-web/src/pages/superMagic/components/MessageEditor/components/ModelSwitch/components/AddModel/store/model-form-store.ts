import { makeAutoObservable } from "mobx"
import {
	MODEL_TYPE_LLM,
	MODEL_TYPE_IMAGE,
	MODEL_TYPE_VIDEO,
	type ServiceProviderCategory,
	type SaveAiModelParams,
} from "@/apis/modules/org-ai-model-provider"
import type { ModelInfo } from "../types"

export type AddModelType = "text" | "image" | "video"

const CATEGORY_MAP: Record<AddModelType, ServiceProviderCategory> = {
	text: "llm",
	image: "vlm",
	video: "vgm",
}

const MODEL_TYPE_MAP: Record<AddModelType, number> = {
	text: MODEL_TYPE_LLM,
	image: MODEL_TYPE_IMAGE,
	video: MODEL_TYPE_VIDEO,
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

	get category(): ServiceProviderCategory {
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
		this.addModelType = this.inferAddModelType(model)
		this.selectedProviderId = model.service_provider_config_id
		this.providerModelId = model.model_version || model.model_id
		this.modelName = model.name ?? ""
	}

	/** Apply fetched model detail to form (used after API fetch) */
	applyEditModelDetail(detail: ModelInfo) {
		this.editingModel = detail
		this.addModelType = this.inferAddModelType(detail)
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

	/**
	 * 编辑时按 category 推断模型类型（llm=文本、vlm=生图、vgm=视频），与模型列表的归类一致；
	 * model_type 不可靠（例如 vlm 模型可能返回 1），不参与判断。
	 * 缺少或无法识别 category 的模型不在列表中显示，这里也不猜测类型，保持表单当前类型。
	 */
	private inferAddModelType(model: Pick<ModelInfo, "category">): AddModelType {
		if (model.category === "llm") return "text"
		if (model.category === "vlm") return "image"
		if (model.category === "vgm") return "video"
		return this.addModelType
	}
}
