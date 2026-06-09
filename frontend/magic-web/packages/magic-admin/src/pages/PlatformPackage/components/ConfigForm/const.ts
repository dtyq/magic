import { AiModel } from "@admin/const/aiModel"

/* Service Account 专属字段 */
export const serviceAccountFields = [
	"project_id",
	"private_key_id",
	"private_key",
	"client_email",
	"client_id",
	"location",
	"api_key",
	"url",
]

type ProviderGroupConfig = {
	/** 排除使用 API Key 的服务商（默认全部开启） */
	excludeApiKey: AiModel.ServiceProvider[]
	/** 排除使用 API 地址的服务商（默认全部开启） */
	excludeApiAgent: AiModel.ServiceProvider[]
	/** 需要 API Version 的服务商 */
	apiVersion: AiModel.ServiceProvider[]
	/** 需要 Access Key 的服务商 */
	accessKey: AiModel.ServiceProvider[]
	/** 需要 Secret Key 的服务商 */
	secretKey: AiModel.ServiceProvider[]
	/** 需要 Region 的服务商 */
	region: AiModel.ServiceProvider[]
}

/** 服务商配置映射 - 采用排除策略，默认开启 API Key 和 API 地址 */
export const providersByCategory: Record<AiModel.ServiceProviderCategory, ProviderGroupConfig> = {
	[AiModel.ServiceProviderCategory.LLM]: {
		/** 排除使用 Access Key/Secret Key 的服务商 */
		excludeApiKey: [AiModel.ServiceProvider.AWSBedrock],
		excludeApiAgent: [AiModel.ServiceProvider.AWSBedrock],
		apiVersion: [AiModel.ServiceProvider.MicrosoftAzure, AiModel.ServiceProvider.Anthropic],
		accessKey: [AiModel.ServiceProvider.AWSBedrock],
		secretKey: [AiModel.ServiceProvider.AWSBedrock],
		region: [AiModel.ServiceProvider.AWSBedrock],
	},
	[AiModel.ServiceProviderCategory.VLM]: {
		/** 排除使用 Access Key/Secret Key 的服务商 */
		excludeApiKey: [AiModel.ServiceProvider.MiracleVision, AiModel.ServiceProvider.Volcengine],
		excludeApiAgent: [
			AiModel.ServiceProvider.MiracleVision,
			AiModel.ServiceProvider.Volcengine,
		],
		apiVersion: [AiModel.ServiceProvider.MicrosoftAzure],
		accessKey: [AiModel.ServiceProvider.MiracleVision, AiModel.ServiceProvider.Volcengine],
		secretKey: [AiModel.ServiceProvider.MiracleVision, AiModel.ServiceProvider.Volcengine],
		region: [],
	},
	[AiModel.ServiceProviderCategory.VGM]: {
		/** VGM 类别下全部使用 API Key 和 API 地址 */
		excludeApiKey: [],
		excludeApiAgent: [],
		apiVersion: [],
		accessKey: [],
		secretKey: [],
		region: [],
	},
}
