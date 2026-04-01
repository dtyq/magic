/**
 * 服务配置字段定义
 * 用于动态渲染不同服务类型的配置表单
 */

import { PlatformPackage } from "@/types/platformPackage"

export interface FieldConfig {
	name: string | string[] // 字段名称，支持嵌套路径
	label: string // 显示标签
	type: "input" | "password" | "textarea" | "select" // 输入类型
	required?: boolean // 是否必填
	placeholder?: string // 占位符
	description?: string // 字段描述
}

export interface ServiceTypeConfig {
	// 配置字段
	fields: FieldConfig[]
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

	// 语音识别专用字段
	hotWords: createFieldConfig("hot_words", "hotWords", "textarea", {
		required: false,
		placeholder: "hotWordsPlaceholder",
		description: "hotWordsDesc",
	}),

	replacementWords: createFieldConfig("replacement_words", "replacementWords", "textarea", {
		required: false,
		placeholder: "replacementWordsPlaceholder",
		description: "replacementWordsDesc",
	}),
} as const

/**
 * WebSearch、WebScrape、ImageSearch 服务配置
 * 所有 provider 使用相同的字段配置
 */
const WEB_SERVICE_FIELDS: FieldConfig[] = [
	COMMON_FIELDS.provider,
	COMMON_FIELDS.requestUrl,
	COMMON_FIELDS.apiKey,
]

export const webSearchConfig: Record<string, FieldConfig[]> = {
	magic: WEB_SERVICE_FIELDS,
	bing: WEB_SERVICE_FIELDS,
	cloudsway: WEB_SERVICE_FIELDS,
	google: WEB_SERVICE_FIELDS,
	baidu: WEB_SERVICE_FIELDS,
}

/**
 * 服务类型配置映射
 */
export const serviceTypeConfigs: Record<string, ServiceTypeConfig> = {
	// OCR 识别配置
	[PlatformPackage.PowerCode.OCR]: {
		fields: [COMMON_FIELDS.provider, COMMON_FIELDS.accessKey, COMMON_FIELDS.secretKey],
	},

	// 实时语音识别配置
	[PlatformPackage.PowerCode.REALTIME_SPEECH_RECOGNITION]: {
		fields: [
			COMMON_FIELDS.provider,
			COMMON_FIELDS.appKey,
			COMMON_FIELDS.accessKey,
			COMMON_FIELDS.hotWords,
			COMMON_FIELDS.replacementWords,
		],
	},

	// 音频文件识别配置
	[PlatformPackage.PowerCode.AUDIO_FILE_RECOGNITION]: {
		fields: [COMMON_FIELDS.provider, COMMON_FIELDS.appKey, COMMON_FIELDS.accessKey],
	},
}

/**
 * 根据服务类型和provider获取配置字段
 */
export function getServiceFields(code?: string, provider?: string): FieldConfig[] {
	if (!code) return []

	const list = [
		PlatformPackage.PowerCode.WEB_SEARCH,
		PlatformPackage.PowerCode.WEB_SCRAPE,
		PlatformPackage.PowerCode.IMAGE_SEARCH,
	]
	// WebSearch 特殊处理
	if (list.includes(code as PlatformPackage.PowerCode) && provider) {
		return webSearchConfig[provider.toLowerCase()] || []
	}

	const config = serviceTypeConfigs[code]
	return config?.fields || []
}
