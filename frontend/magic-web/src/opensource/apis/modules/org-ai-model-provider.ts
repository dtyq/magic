import type { HttpClient } from "@/opensource/apis/core/HttpClient"

import { genRequestUrl } from "@/opensource/utils/http"

/** Backend model_type: 0=文生图, 3=LLM */
export const MODEL_TYPE_LLM = 3
export const MODEL_TYPE_IMAGE = 0

/** Response from GET /service-providers */
export interface ServiceProviderConfig {
	id: string
	name: string
	icon?: string
	provider_code: string
	category: "llm" | "vlm"
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
	category: "llm" | "vlm"
	config_schema?: Record<string, { required?: boolean; type?: string }>
	[key: string]: unknown
}

export interface AddOrgAiModelProviderParams {
	service_provider_id: string
	alias?: string
	config: Record<string, string>
	category?: "llm" | "vlm"
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
}

/** Response from GET /service-provider/models/queries */
export interface ServiceProviderModelsResponse {
	list: ServiceProviderModel[]
	total: number
}

export const generateOrgAiModelProviderApi = (fetch: HttpClient) => ({
	getOrgAiModelProviderList(category: "llm" | "vlm" = "llm") {
		return fetch.get<ServiceProviderConfig[]>(
			genRequestUrl("/api/v1/organization/admin/service-providers", {}, { category }),
		)
	},

	getNonOfficialProviderTemplates(category: "llm" | "vlm" = "llm") {
		return fetch.get<ProviderTemplate[]>(
			genRequestUrl(
				"/api/v1/organization/admin/service-providers/templates/queries",
				{},
				{ category },
			),
		)
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
		return fetch.delete<null>(
			genRequestUrl(
				"/api/v1/organization/admin/service-providers/${serviceProviderConfigId}",
				{
					serviceProviderConfigId: id,
				},
			),
		)
	},

	saveAiModel(data: SaveAiModelParams) {
		return fetch.post<ModelInfo>("/api/v1/organization/admin/service-providers/models", {
			...data,
			config: data.config ?? {},
		})
	},

	getOrgAiModelDetail(modelId: string) {
		return fetch.get<ModelInfo>(
			genRequestUrl("/api/v1/organization/admin/service-providers/models/${modelId}", {
				modelId,
			}),
		)
	},

	deleteAiModel(modelId: string) {
		return fetch.delete<null>(
			genRequestUrl("/api/v1/organization/admin/service-providers/models/${modelId}", {
				modelId,
			}),
		)
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
			genRequestUrl("/api/v1/organization/admin/service-providers/models/${modelId}/status", {
				modelId: data.model_id,
			}),
			{ status: data.status },
		)
	},

	queryServiceProviderModels() {
		return fetch.post<ServiceProviderModelsResponse>("/api/v1/service-provider/models/queries")
	},
})
