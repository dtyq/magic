import {
	aiPowerCode,
	type AiPowerCode,
	type ProviderConfig,
	type ProviderFieldConfig,
} from "@magic-admin-v2/features/platform-system-capabilities/types"

export const ALL_VALUE = "__all__"

export const SERVICE_CONFIG_CODES: AiPowerCode[] = [
	aiPowerCode.ocr,
	aiPowerCode.webSearch,
	aiPowerCode.webScrape,
	aiPowerCode.realtimeSpeechRecognition,
	aiPowerCode.audioFileRecognition,
	aiPowerCode.imageSearch,
	aiPowerCode.imageRemoveBackground,
	aiPowerCode.imageEraser,
	aiPowerCode.imageExpand,
	aiPowerCode.weatherForecast,
]

export const CONNECTIVITY_TEST_CODES: AiPowerCode[] = [
	aiPowerCode.webSearch,
	aiPowerCode.webScrape,
	aiPowerCode.imageSearch,
]

export const IMAGE_TOOL_CODES: AiPowerCode[] = [
	aiPowerCode.imageConvertHigh,
	aiPowerCode.imageExpand,
	aiPowerCode.imageEraser,
]

export const PROVIDER_META_FIELDS = new Set(["provider", "provider_code", "name", "enable"])

export const PASSWORD_FIELD_PATTERNS = ["key", "secret", "token", "password"]
export const TEXTAREA_FIELD_PATTERNS = ["prompt", "words", "description"]

export const COMMON_PROVIDER_FIELDS = {
	provider: {
		name: "provider",
		labelKey: "systemCapabilities.field.provider",
		type: "select",
		descriptionKey: "systemCapabilities.fieldDesc.provider",
		required: true,
	},
	requestUrl: {
		name: "request_url",
		labelKey: "systemCapabilities.field.requestUrl",
		type: "input",
		descriptionKey: "systemCapabilities.fieldDesc.requestUrl",
		required: true,
	},
	apiKey: {
		name: "api_key",
		labelKey: "systemCapabilities.field.apiKey",
		type: "password",
		descriptionKey: "systemCapabilities.fieldDesc.apiKey",
		required: true,
	},
	ak: {
		name: "ak",
		labelKey: "systemCapabilities.field.ak",
		type: "password",
		descriptionKey: "systemCapabilities.fieldDesc.ak",
		required: true,
	},
	sk: {
		name: "sk",
		labelKey: "systemCapabilities.field.sk",
		type: "password",
		descriptionKey: "systemCapabilities.fieldDesc.sk",
		required: true,
	},
	accessKey: {
		name: "access_key",
		labelKey: "systemCapabilities.field.accessKey",
		type: "password",
		descriptionKey: "systemCapabilities.fieldDesc.accessKey",
		required: true,
	},
	secretKey: {
		name: "secret_key",
		labelKey: "systemCapabilities.field.secretKey",
		type: "password",
		descriptionKey: "systemCapabilities.fieldDesc.secretKey",
		required: true,
	},
	appKey: {
		name: "app_key",
		labelKey: "systemCapabilities.field.appKey",
		type: "password",
		descriptionKey: "systemCapabilities.fieldDesc.appKey",
		required: true,
	},
	timeout: {
		name: "timeout",
		labelKey: "systemCapabilities.field.timeout",
		type: "input",
		inputMode: "numeric",
		required: false,
	},
	concurrent: {
		name: "concurrent",
		labelKey: "systemCapabilities.field.concurrent",
		type: "input",
		inputMode: "numeric",
		descriptionKey: "systemCapabilities.fieldDesc.concurrent",
		required: false,
	},
	hotWords: {
		name: "hot_words",
		labelKey: "systemCapabilities.field.hotWords",
		type: "textarea",
		descriptionKey: "systemCapabilities.fieldDesc.hotWords",
		required: false,
	},
	replacementWords: {
		name: "replacement_words",
		labelKey: "systemCapabilities.field.replacementWords",
		type: "textarea",
		descriptionKey: "systemCapabilities.fieldDesc.replacementWords",
		required: false,
	},
	modelName: {
		name: "model_name",
		labelKey: "systemCapabilities.field.modelName",
		type: "input",
		descriptionKey: "systemCapabilities.fieldDesc.modelName",
		required: true,
	},
} satisfies Record<string, ProviderFieldConfig>

const webServiceProviders: ProviderConfig[] = [
	{ provider: "magic", name: "Magic API", request_url: "", api_key: "", enable: false },
	{ provider: "bing", name: "Bing", request_url: "", api_key: "", enable: false },
	{ provider: "cloudsway", name: "Cloudsway", request_url: "", api_key: "", enable: false },
	{ provider: "baidu", name: "Baidu", request_url: "", api_key: "", enable: false },
	{
		provider: "deepseek",
		name: "DeepSeek",
		request_url: "https://api.deepseek.com/v1/tools/search",
		api_key: "",
		enable: false,
	},
	{ provider: "doubao", name: "Doubao", request_url: "", api_key: "", enable: false },
]

const imageEditProviders: ProviderConfig[] = [
	{
		provider: "jimeng",
		name: "即梦",
		ak: "",
		sk: "",
		timeout: 300,
		concurrent: 1,
		enable: false,
	},
	{
		provider: "official_proxy",
		name: "官方代理服务",
		request_url: "",
		api_key: "",
		timeout: 300,
		concurrent: 1,
		enable: false,
	},
	{
		provider: "volcengine",
		name: "火山引擎",
		access_key: "",
		secret_key: "",
		timeout: 300,
		concurrent: 1,
		enable: false,
	},
]

export const DEFAULT_PROVIDER_LIST_MAP: Record<string, ProviderConfig[]> = {
	[aiPowerCode.webSearch]: webServiceProviders,
	[aiPowerCode.webScrape]: webServiceProviders
		.filter((item) => ["magic", "bing", "cloudsway", "deepseek"].includes(item.provider))
		.map((item) =>
			item.provider === "deepseek"
				? { ...item, request_url: "https://api.deepseek.com/v1/tools/fetch" }
				: item,
		),
	[aiPowerCode.imageSearch]: [
		{ provider: "bing", name: "Bing", request_url: "", api_key: "", enable: false },
		{ provider: "cloudsway", name: "Cloudsway", request_url: "", api_key: "", enable: false },
		{ provider: "google", name: "Google", request_url: "", api_key: "", enable: false },
		{ provider: "doubao", name: "Doubao", request_url: "", api_key: "", enable: false },
	],
	[aiPowerCode.ocr]: [
		{
			provider: "Volcengine",
			name: "Volcengine",
			access_key: "",
			secret_key: "",
			enable: true,
		},
	],
	[aiPowerCode.realtimeSpeechRecognition]: [
		{
			provider: "Volcengine",
			name: "Volcengine",
			app_key: "",
			access_key: "",
			hot_words: "",
			replacement_words: "",
			enable: true,
		},
	],
	[aiPowerCode.audioFileRecognition]: [
		{ provider: "Volcengine", name: "Volcengine", app_key: "", access_key: "", enable: true },
	],
	[aiPowerCode.imageRemoveBackground]: [
		{
			provider: "official_proxy",
			name: "官方代理",
			request_url: "",
			api_key: "",
			enable: false,
		},
		{
			provider: "official_model_service",
			name: "官方服务",
			request_url: "",
			api_key: "",
			model_name: "",
			enable: true,
		},
	],
	[aiPowerCode.imageEraser]: imageEditProviders,
	[aiPowerCode.imageExpand]: imageEditProviders,
	[aiPowerCode.weatherForecast]: [
		{ provider: "aidata", name: "AiData", request_url: "", api_key: "", enable: true },
	],
}

export const DEPRECATED_PROVIDER_MAP: Partial<Record<AiPowerCode, ReadonlySet<string>>> = {
	[aiPowerCode.webSearch]: new Set(["magic", "bing"]),
	[aiPowerCode.imageSearch]: new Set(["doubao"]),
}
