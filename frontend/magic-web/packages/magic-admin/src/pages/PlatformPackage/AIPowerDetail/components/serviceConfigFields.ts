/**
 * 服务配置字段定义
 * 用于动态渲染不同服务类型的配置表单
 */

import { PlatformPackage } from "@admin/types/platformPackage"

export interface FieldConfig {
	name: string | string[] // 字段名称，支持嵌套路径
	label: string // 显示标签
	type: "input" | "password" | "textarea" | "select" // 输入类型
	required?: boolean // 是否必填
	placeholder?: string // 占位符（i18n key）
	placeholderParams?: Record<string, string> // 占位符插值参数，供文案里的 {{xxx}} 使用
	description?: string // 字段描述
}

/**
 * 字段配置工厂函数
 */
const createFieldConfig = (
	name: string | string[],
	label: string,
	type: FieldConfig["type"],
	options?: Partial<Omit<FieldConfig, "name" | "label" | "type">>,
): FieldConfig => ({
	name,
	label,
	type,
	required: true,
	...options,
})

/**
 * 公共字段配置常量
 */
const COMMON_FIELDS = {
	// Provider 选择字段
	provider: createFieldConfig("provider", "service", "select", {
		placeholder: "pleaseSelectService",
		description: "pleaseSelectService",
	}),

	// URL 相关字段
	requestUrl: createFieldConfig("request_url", "userInputUrl", "input", {
		placeholder: "userInputUrlPlaceholder",
		description: "userInputUrlPlaceholder",
	}),

	// 认证相关字段
	apiKey: createFieldConfig("api_key", "API Key", "password", {
		placeholder: "apiKeyPlaceholder",
		description: "apiKeyPlaceholder",
	}),

	ak: createFieldConfig("ak", "AK", "password", {
		placeholder: "akPlaceholder",
		description: "akPlaceholder",
	}),

	sk: createFieldConfig("sk", "SK", "password", {
		placeholder: "skPlaceholder",
		description: "skPlaceholder",
	}),

	accessKey: createFieldConfig("access_key", "Access Key", "password", {
		placeholder: "accessKeyPlaceholder",
		description: "accessKeyPlaceholder",
	}),

	secretKey: createFieldConfig("secret_key", "Secret Key", "password", {
		placeholder: "secretKeyPlaceholder",
		description: "secretKeyPlaceholder",
	}),

	appKey: createFieldConfig("app_key", "App Key", "password", {
		placeholder: "appKeyPlaceholder",
		description: "appKeyPlaceholder",
	}),

	timeout: createFieldConfig("timeout", "Timeout", "input", {
		required: false,
	}),

	concurrent: createFieldConfig("concurrent", "concurrent", "input", {
		required: false,
		placeholder: "concurrentPlaceholder",
		description: "concurrentDesc",
	}),

	// 语音识别专用字段
	hotWords: createFieldConfig("hot_words", "hotWords", "textarea", {
		required: false,
		placeholder: "hotWordsPlaceholder",
		description: "hotWordsDesc",
	}),
	// 替换词字段
	replacementWords: createFieldConfig("replacement_words", "replacementWords", "textarea", {
		required: false,
		placeholder: "replacementWordsPlaceholder",
		description: "replacementWordsDesc",
	}),
	// 模型名称字段
	modelName: createFieldConfig("model_name", "modelName", "input", {
		placeholder: "modelNamePlaceholder",
		description: "modelNameDesc",
	}),

	version: createFieldConfig("version", "version", "input"),
	region: createFieldConfig("region", "region", "input"),
	service: createFieldConfig("service", "serviceName", "input"),
	endpoint: createFieldConfig("endpoint", "endpoint", "input"),
	projectName: createFieldConfig("project_name", "projectName", "input"),
} as const

const PROVIDER_META_FIELD_KEYS = new Set(["provider", "provider_code", "name", "enable"])

const COMMON_FIELD_MAP: Partial<Record<string, FieldConfig>> = {
	request_url: COMMON_FIELDS.requestUrl,
	api_key: COMMON_FIELDS.apiKey,
	ak: COMMON_FIELDS.ak,
	sk: COMMON_FIELDS.sk,
	access_key: COMMON_FIELDS.accessKey,
	secret_key: COMMON_FIELDS.secretKey,
	app_key: COMMON_FIELDS.appKey,
	timeout: COMMON_FIELDS.timeout,
	concurrent: COMMON_FIELDS.concurrent,
	hot_words: COMMON_FIELDS.hotWords,
	replacement_words: COMMON_FIELDS.replacementWords,
	model_name: COMMON_FIELDS.modelName,
	version: COMMON_FIELDS.version,
	region: COMMON_FIELDS.region,
	service: COMMON_FIELDS.service,
	endpoint: COMMON_FIELDS.endpoint,
	project_name: COMMON_FIELDS.projectName,
}

const PASSWORD_FIELD_PATTERNS = ["key", "secret", "token", "password"]
const TEXTAREA_FIELD_PATTERNS = ["prompt", "words", "description"]

const toFieldLabel = (key: string) => {
	return key
		.split("_")
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ")
}

const inferFieldType = (key: string, value: unknown): FieldConfig["type"] => {
	const normalizedKey = key.toLowerCase()

	if (normalizedKey === "ak" || normalizedKey === "sk") {
		return "password"
	}

	if (PASSWORD_FIELD_PATTERNS.some((pattern) => normalizedKey.includes(pattern))) {
		return "password"
	}

	if (
		TEXTAREA_FIELD_PATTERNS.some((pattern) => normalizedKey.includes(pattern)) ||
		(typeof value === "string" && value.includes("\n"))
	) {
		return "textarea"
	}

	return "input"
}

//
const inferProviderFields = (providerConfig?: PlatformPackage.ProviderConfig): FieldConfig[] => {
	if (!providerConfig) return [COMMON_FIELDS.provider]

	const providerFields = Object.entries(providerConfig)
		.filter(([key]) => !PROVIDER_META_FIELD_KEYS.has(key))
		.map(([key, value]) => {
			const commonField = COMMON_FIELD_MAP[key]

			if (commonField) {
				return commonField
			}

			return createFieldConfig(key, toFieldLabel(key), inferFieldType(key, value), {
				required: false,
			})
		})

	return [COMMON_FIELDS.provider, ...providerFields]
}

/**
 * WebSearch、WebScrape、ImageSearch 服务配置
 * 所有 provider 使用相同的字段配置
 */
const WEB_SERVICE_FIELDS: FieldConfig[] = [
	COMMON_FIELDS.provider,
	COMMON_FIELDS.apiKey,
	COMMON_FIELDS.requestUrl,
]

// 服务商配置类型映射
export const webSearchConfig: Record<string, FieldConfig[]> = {
	magic: WEB_SERVICE_FIELDS,
	bing: WEB_SERVICE_FIELDS,
	cloudsway: WEB_SERVICE_FIELDS,
	google: WEB_SERVICE_FIELDS,
	baidu: WEB_SERVICE_FIELDS,
	doubao: WEB_SERVICE_FIELDS,
}

// 去背景配置
export const imageRemoveBackgroundConfig: Record<string, FieldConfig[]> = {
	official_proxy: [COMMON_FIELDS.provider, COMMON_FIELDS.apiKey, COMMON_FIELDS.requestUrl],
	official_model_service: [
		COMMON_FIELDS.provider,
		COMMON_FIELDS.apiKey,
		COMMON_FIELDS.requestUrl,
		COMMON_FIELDS.modelName,
	],
}

// 擦图/扩图配置
export const imageEditConfig: Record<string, FieldConfig[]> = {
	jimeng: [
		COMMON_FIELDS.provider,
		COMMON_FIELDS.ak,
		COMMON_FIELDS.sk,
		COMMON_FIELDS.timeout,
		COMMON_FIELDS.concurrent,
	],
	official_proxy: [
		COMMON_FIELDS.provider,
		COMMON_FIELDS.apiKey,
		COMMON_FIELDS.requestUrl,
		COMMON_FIELDS.timeout,
		COMMON_FIELDS.concurrent,
	],
	volcengine: [
		COMMON_FIELDS.provider,
		COMMON_FIELDS.accessKey,
		COMMON_FIELDS.secretKey,
		COMMON_FIELDS.timeout,
		COMMON_FIELDS.concurrent,
	],
}

/**
 * 火山方舟素材服务的可选字段：这些字段在后端都有内置默认值（version/region/service/endpoint
 * 由素材客户端兜底，project_name 由领域服务兜底），留空即按默认值生效，因此不做必填校验，
 * 管理员只需要填 AK/SK。
 *
 * 每个字段的占位符里显式写出「留空时实际生效的默认值」，否则用户看到空输入框无从判断不填会发生
 * 什么。这里的默认值必须与后端兜底值保持一致：
 * - version/region/service/endpoint → VolcengineArkAssetsClient 的 DEFAULT_* 常量
 * - project_name → VolcengineArkAssetProvider / AssetDomainService 的 DEFAULT_PROJECT_NAME
 */
const VOLCENGINE_ARK_ASSETS_OPTIONAL_FIELDS: FieldConfig[] = [
	createFieldConfig("version", "version", "input", {
		required: false,
		placeholder: "useDefaultPlaceholder",
		placeholderParams: { value: "2024-01-01" },
	}),
	createFieldConfig("region", "region", "input", {
		required: false,
		placeholder: "useDefaultPlaceholder",
		placeholderParams: { value: "cn-beijing" },
	}),
	createFieldConfig("service", "serviceName", "input", {
		required: false,
		placeholder: "useDefaultPlaceholder",
		placeholderParams: { value: "ark" },
	}),
	createFieldConfig("endpoint", "endpoint", "input", {
		required: false,
		placeholder: "useDefaultPlaceholder",
		placeholderParams: { value: "https://open.volcengineapi.com" },
	}),
	createFieldConfig("project_name", "projectName", "input", {
		required: false,
		placeholder: "useDefaultPlaceholder",
		placeholderParams: { value: "default" },
	}),
]

/**
 * 服务类型配置映射
 */
export const serviceTypeConfigs: Record<string, FieldConfig[]> = {
	// OCR 识别配置
	[PlatformPackage.PowerCode.OCR]: [
		COMMON_FIELDS.provider,
		COMMON_FIELDS.accessKey,
		COMMON_FIELDS.secretKey,
	],

	// 实时语音识别配置
	[PlatformPackage.PowerCode.REALTIME_SPEECH_RECOGNITION]: [
		COMMON_FIELDS.provider,
		COMMON_FIELDS.appKey,
		COMMON_FIELDS.accessKey,
		COMMON_FIELDS.hotWords,
		COMMON_FIELDS.replacementWords,
	],

	// 音频文件识别配置
	[PlatformPackage.PowerCode.AUDIO_FILE_RECOGNITION]: [
		COMMON_FIELDS.provider,
		COMMON_FIELDS.appKey,
		COMMON_FIELDS.accessKey,
	],

	// 天气查询配置
	[PlatformPackage.PowerCode.WEATHER_FORECAST]: [
		COMMON_FIELDS.provider,
		COMMON_FIELDS.apiKey,
		COMMON_FIELDS.requestUrl,
	],

	// 火山方舟素材服务配置
	[PlatformPackage.PowerCode.VOLCENGINE_ARK_ASSETS]: [
		COMMON_FIELDS.provider,
		COMMON_FIELDS.accessKey,
		COMMON_FIELDS.secretKey,
		...VOLCENGINE_ARK_ASSETS_OPTIONAL_FIELDS,
	],
}

/**
 * 根据服务类型和provider获取配置字段
 */
export function getServiceFields(
	code?: string,
	provider?: string,
	providerConfig?: PlatformPackage.ProviderConfig,
): FieldConfig[] {
	if (!code && !providerConfig) return []
	if (!code) return inferProviderFields(providerConfig)

	const list = [
		PlatformPackage.PowerCode.WEB_SEARCH,
		PlatformPackage.PowerCode.WEB_SCRAPE,
		PlatformPackage.PowerCode.IMAGE_SEARCH,
	]
	// WebSearch 特殊处理
	if (list.includes(code as PlatformPackage.PowerCode) && provider) {
		return webSearchConfig[provider.toLowerCase()] || inferProviderFields(providerConfig)
	}

	if (code === PlatformPackage.PowerCode.IMAGE_REMOVE_BACKGROUND && provider) {
		return (
			imageRemoveBackgroundConfig[provider.toLowerCase()] ||
			inferProviderFields(providerConfig)
		)
	}

	if (
		[PlatformPackage.PowerCode.IMAGE_ERASER, PlatformPackage.PowerCode.IMAGE_EXPAND].includes(
			code as PlatformPackage.PowerCode,
		) &&
		provider
	) {
		return imageEditConfig[provider.toLowerCase()] || inferProviderFields(providerConfig)
	}

	const config = serviceTypeConfigs[code]
	return config || inferProviderFields(providerConfig)
}
