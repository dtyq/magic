import { OrgAiModelProviderApi } from "@/apis"
import {
	MODEL_TYPE_IMAGE,
	MODEL_TYPE_LLM,
	ServiceProviderModel,
} from "@/apis/modules/org-ai-model-provider"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/types"
import { ModelStatusEnum } from "@/pages/superMagic/components/MessageEditor/types"
import { logger as Logger } from "@/utils/log"

const logger = Logger.createLogger("SuperMagicCustomModelService")

interface LoadMyModelsOptions {
	force?: boolean
}

interface FindMyModelOptions extends LoadMyModelsOptions {
	modelId: string
	modelType: typeof MODEL_TYPE_LLM | typeof MODEL_TYPE_IMAGE
}

export function serviceProviderModelToModelItem(model: ServiceProviderModel): ModelItem {
	return {
		id: model.id,
		group_id: "",
		model_id: model.model_id,
		model_name: model.name,
		provider_model_id: model.model_version || model.model_id,
		model_description: typeof model.description === "string" ? model.description : "",
		model_icon: model.icon ?? "",
		model_status: ModelStatusEnum.Normal,
		sort: 0,
	}
}

class SuperMagicCustomModelService {
	private cachedModels: ServiceProviderModel[] | null = null

	private loadPromise: Promise<ServiceProviderModel[]> | null = null

	async getMyModels({ force = false }: LoadMyModelsOptions = {}): Promise<
		ServiceProviderModel[]
	> {
		if (force) {
			this.cachedModels = null
			this.loadPromise = null
		}

		if (this.cachedModels) return this.cachedModels
		if (this.loadPromise) return this.loadPromise

		this.loadPromise = OrgAiModelProviderApi.queryServiceProviderModels()
			.then((res) => {
				const models = res?.list ?? []
				this.cachedModels = models
				return models
			})
			.catch((error) => {
				logger.warn("Failed to load custom models", { error })
				return []
			})
			.finally(() => {
				this.loadPromise = null
			})

		return this.loadPromise
	}

	async getMyModelsByType(
		modelType: typeof MODEL_TYPE_LLM | typeof MODEL_TYPE_IMAGE,
		options?: LoadMyModelsOptions,
	): Promise<ServiceProviderModel[]> {
		const models = await this.getMyModels(options)
		return models.filter((model) => model.model_type === modelType)
	}

	async findMyModelById({
		modelId,
		modelType,
		force = false,
	}: FindMyModelOptions): Promise<ServiceProviderModel | null> {
		if (!modelId) return null

		const models = await this.getMyModelsByType(modelType, { force })
		return models.find((model) => model.model_id === modelId) ?? null
	}

	toModelItem(model: ServiceProviderModel): ModelItem {
		return serviceProviderModelToModelItem(model)
	}

	clearCache() {
		this.cachedModels = null
		this.loadPromise = null
	}
}

const superMagicCustomModelService = new SuperMagicCustomModelService()

export default superMagicCustomModelService
