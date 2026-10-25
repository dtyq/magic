import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import type { VideoGenerationConfig } from "@/components/CanvasDesign/public/magic-types"

/** Backend model_type: 0=文生图, 3=LLM, 5=文生视频 */
export const MODEL_TYPE_LLM = 3
export const MODEL_TYPE_IMAGE = 0
export const MODEL_TYPE_VIDEO = 5

export type ServiceProviderCategory = "llm" | "vlm" | "vgm"

/**
 * 「我的模型 / 企业模型」按 category 归类：llm=语言、vlm=生图、vgm=视频。
 * 列表接口返回的 model_type 不可靠（例如 vlm 模型会返回 1），不再用它判断模型属于哪一类。
 */
export const MODEL_CATEGORY_BY_TYPE = {
	[MODEL_TYPE_LLM]: "llm",
	[MODEL_TYPE_IMAGE]: "vlm",
	[MODEL_TYPE_VIDEO]: "vgm",
} as const satisfies Record<number, ServiceProviderCategory>

/** Response from GET /service-providers */
export interface ServiceProviderConfig {
	id: string
	name: string
	icon?: string
	provider_code: string
	category: ServiceProviderCategory
	config: Record<string, unknown>
	alias?: string
	translate?: { alias?: Record<string, string> }
	[key: string]: unknown
}

/** Model info under service provider (from /save-model or list) */
export interface ModelInfo {
	id: string
	model_id: string
	model_version: string
	name: string
	icon?: string
	service_provider_config_id: string
	model_type: number
	category?: string
	[key: string]: unknown
}

/** Template from GET /non-official/queries */
export interface ProviderTemplate {
	id: string
	name: string
	icon?: string
	provider_code: string
	category: ServiceProviderCategory
	config_schema?: Record<string, { required?: boolean; type?: string }>
	[key: string]: unknown
}

export interface AddOrgAiModelProviderParams {
	service_provider_id: string
	alias?: string
	config: Record<string, string>
	category?: ServiceProviderCategory
	status?: 0 | 1
}

export interface UpdateOrgAiModelProviderParams {
	id: string
	alias?: string
	config: Record<string, string>
	status?: 0 | 1
}

export interface SaveAiModelParams {
	service_provider_config_id: string
	model_version: string
	name?: string
	model_type: number
	id?: string
	config?: {
		max_tokens?: number | null
		support_function?: boolean
		support_multi_modal?: boolean
		support_deep_think?: boolean
		[key: string]: unknown
	}
}

export interface AiModelConnectivityTestParams {
	service_provider_config_id: string
	model_version: string
	support_multi_modal?: boolean
}

export interface AiModelConnectivityTestResult {
	status: boolean
	message: string | null
}

export interface UpdateAiModelStatusParams {
	model_id: string
	status: number
}

/** Item in the user's service-provider models list */
export interface ServiceProviderModel {
	id: string
	name: string
	model_id: string
	model_version?: string
	model_type: number
	category: string
	icon?: string
	description?: string
	service_provider_config_id: string
	service_provider_config: {
		id: string
		name: string
	}
	/** 视频生成能力配置（个人/服务商模型接口可能返回） */
	video_generation_config?: VideoGenerationConfig | null
	/** 生图尺寸与参考图上限等（个人/服务商模型接口可能返回） */
	image_size_config?: {
		max_reference_images?: number
		sizes: {
			label: string
			value: string
			scale?: string
		}[]
	}
}

/** Response from GET /service-provider/models/queries */
export interface ServiceProviderModelsResponse {
	list: ServiceProviderModel[]
	total: number
}

export const generateOrgAiModelProviderApi = (fetch: ServiceHttpClient) => ({
	getOrgAiModelProviderList(category: ServiceProviderCategory = "llm") {
		return fetch.get<ServiceProviderConfig[]>("/api/v1/organization/admin/service-providers", {
			params: { category },
		})
	},

	getNonOfficialProviderTemplates(category: ServiceProviderCategory = "llm") {
		return fetch.get<ProviderTemplate[]>("/api/v1/service-providers/templates/queries", {
			params: { category },
		})
	},

	addOrgAiModelProvider(data: AddOrgAiModelProviderParams) {
		return fetch.post<ServiceProviderConfig>(
			"/api/v1/organization/admin/service-providers",
			data,
		)
	},

	updateOrgAiModelProvider(data: UpdateOrgAiModelProviderParams) {
		return fetch.put<ServiceProviderConfig>(
			"/api/v1/organization/admin/service-providers",
			data,
		)
	},

	deleteOrgAiModelProvider(id: string) {
		return fetch.delete<null>(`/api/v1/organization/admin/service-providers/${id}`)
	},

	saveAiModel(data: SaveAiModelParams) {
		return fetch.post<ModelInfo>("/api/v1/organization/admin/service-providers/models", {
			...data,
			config: data.config ?? {},
		})
	},

	getOrgAiModelDetail(modelId: string) {
		return fetch.get<ModelInfo>(
			`/api/v1/organization/admin/service-providers/models/${modelId}`,
		)
	},

	deleteAiModel(modelId: string) {
		return fetch.delete<null>(`/api/v1/organization/admin/service-providers/models/${modelId}`)
	},

	testAiModelConnectivity(data: AiModelConnectivityTestParams) {
		return fetch.post<AiModelConnectivityTestResult>(
			"/api/v1/organization/admin/service-providers/connectivity-tests/config-based",
			data,
			{ enableErrorMessagePrompt: false },
		)
	},

	updateAiModelStatus(data: UpdateAiModelStatusParams) {
		return fetch.put<null>(
			`/api/v1/organization/admin/service-providers/models/${data.model_id}/status`,
			{ status: data.status },
		)
	},

	queryServiceProviderModels() {
		return fetch.post<ServiceProviderModelsResponse>("/api/v1/service-provider/models/queries")
	},
})
