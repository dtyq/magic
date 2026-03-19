/** Backend response from GET /service-providers */
export interface ServiceProviderConfig {
	id: string
	name: string
	icon?: string
	provider_code: string
	category: "llm" | "vlm"
	config: Record<string, unknown>
	alias?: string
	[key: string]: unknown
}

/** Model info from /save-model or service provider models list */
export interface ModelInfo {
	id: string
	model_id: string
	model_version?: string
	description?: string
	name: string
	icon?: string
	service_provider_config_id: string
	model_type: number
	category?: string
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

/** Saved AI model for My Models list (alias for ModelInfo) */
export interface SavedAiModel extends ModelInfo {}

export interface ProviderTemplateOption {
	id: string
	name: string
	icon: string
	providerCode: string
	fields: ProviderFieldConfig[]
}

export interface ProviderFieldConfig {
	key: string
	label: string
	labelKey?: string
	required: boolean
	placeholder?: string
	description?: string
	inputType?: "text" | "password" | "textarea"
	validator?: "url" | "email"
}

export interface AddModelFormValues {
	providerId: string
	providerModelId: string
	modelName: string
}

export interface AddProviderFormValues {
	providerTypeId: string
	alias: string
	fields: Record<string, string>
}

export interface ServiceProvider {
	id: string
	name: string
	icon: string
	providerTypeId: string
	fields: Record<string, string>
}
