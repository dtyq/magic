import {
	COMMON_PROVIDER_FIELDS,
	PASSWORD_FIELD_PATTERNS,
	PROVIDER_META_FIELDS,
	TEXTAREA_FIELD_PATTERNS,
} from "@magic-admin-v2/features/platform-system-capabilities/consts"
import {
	aiPowerCode,
	type ProviderConfig,
	type ProviderFieldConfig,
} from "@magic-admin-v2/features/platform-system-capabilities/types"

const webServiceFields = [
	COMMON_PROVIDER_FIELDS.provider,
	COMMON_PROVIDER_FIELDS.apiKey,
	COMMON_PROVIDER_FIELDS.requestUrl,
]

const webServiceCodes = new Set<string>([
	aiPowerCode.webSearch,
	aiPowerCode.webScrape,
	aiPowerCode.imageSearch,
])
const imageEditCodes = new Set<string>([aiPowerCode.imageEraser, aiPowerCode.imageExpand])

const imageEditFields: Record<string, ProviderFieldConfig[]> = {
	jimeng: [
		COMMON_PROVIDER_FIELDS.provider,
		COMMON_PROVIDER_FIELDS.ak,
		COMMON_PROVIDER_FIELDS.sk,
		COMMON_PROVIDER_FIELDS.timeout,
		COMMON_PROVIDER_FIELDS.concurrent,
	],
	official_proxy: [
		COMMON_PROVIDER_FIELDS.provider,
		COMMON_PROVIDER_FIELDS.apiKey,
		COMMON_PROVIDER_FIELDS.requestUrl,
		COMMON_PROVIDER_FIELDS.timeout,
		COMMON_PROVIDER_FIELDS.concurrent,
	],
	volcengine: [
		COMMON_PROVIDER_FIELDS.provider,
		COMMON_PROVIDER_FIELDS.accessKey,
		COMMON_PROVIDER_FIELDS.secretKey,
		COMMON_PROVIDER_FIELDS.timeout,
		COMMON_PROVIDER_FIELDS.concurrent,
	],
}

const commonFieldByName: Partial<Record<string, ProviderFieldConfig>> = {
	request_url: COMMON_PROVIDER_FIELDS.requestUrl,
	api_key: COMMON_PROVIDER_FIELDS.apiKey,
	ak: COMMON_PROVIDER_FIELDS.ak,
	sk: COMMON_PROVIDER_FIELDS.sk,
	access_key: COMMON_PROVIDER_FIELDS.accessKey,
	secret_key: COMMON_PROVIDER_FIELDS.secretKey,
	app_key: COMMON_PROVIDER_FIELDS.appKey,
	timeout: COMMON_PROVIDER_FIELDS.timeout,
	concurrent: COMMON_PROVIDER_FIELDS.concurrent,
	hot_words: COMMON_PROVIDER_FIELDS.hotWords,
	replacement_words: COMMON_PROVIDER_FIELDS.replacementWords,
	model_name: COMMON_PROVIDER_FIELDS.modelName,
}

const providerFieldsByCode: Record<string, ProviderFieldConfig[]> = {
	[aiPowerCode.ocr]: [
		COMMON_PROVIDER_FIELDS.provider,
		COMMON_PROVIDER_FIELDS.accessKey,
		COMMON_PROVIDER_FIELDS.secretKey,
	],
	[aiPowerCode.realtimeSpeechRecognition]: [
		COMMON_PROVIDER_FIELDS.provider,
		COMMON_PROVIDER_FIELDS.appKey,
		COMMON_PROVIDER_FIELDS.accessKey,
		COMMON_PROVIDER_FIELDS.hotWords,
		COMMON_PROVIDER_FIELDS.replacementWords,
	],
	[aiPowerCode.audioFileRecognition]: [
		COMMON_PROVIDER_FIELDS.provider,
		COMMON_PROVIDER_FIELDS.appKey,
		COMMON_PROVIDER_FIELDS.accessKey,
	],
	[aiPowerCode.weatherForecast]: [
		COMMON_PROVIDER_FIELDS.provider,
		COMMON_PROVIDER_FIELDS.apiKey,
		COMMON_PROVIDER_FIELDS.requestUrl,
	],
}

const providerLabel = (key: string) =>
	key
		.split("_")
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ")

function inferFieldType(key: string, value: unknown): ProviderFieldConfig["type"] {
	const normalizedKey = key.toLowerCase()

	if (
		normalizedKey === "ak" ||
		normalizedKey === "sk" ||
		PASSWORD_FIELD_PATTERNS.some((pattern) => normalizedKey.includes(pattern))
	) {
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

export function inferProviderFields(providerConfig?: ProviderConfig): ProviderFieldConfig[] {
	if (!providerConfig) return [COMMON_PROVIDER_FIELDS.provider]

	const fields = Object.entries(providerConfig)
		.filter(([key]) => !PROVIDER_META_FIELDS.has(key))
		.map(
			([key, value]) =>
				commonFieldByName[key] ??
				({
					name: key,
					label: providerLabel(key),
					type: inferFieldType(key, value),
					required: false,
				} satisfies ProviderFieldConfig),
		)

	return [COMMON_PROVIDER_FIELDS.provider, ...fields]
}

function getKnownProviderFields(code: string, provider: string) {
	const normalizedProvider = provider.toLowerCase()

	if (webServiceCodes.has(code)) {
		return webServiceFields
	}

	if (code === aiPowerCode.imageRemoveBackground) {
		return normalizedProvider === "official_model_service"
			? [
					COMMON_PROVIDER_FIELDS.provider,
					COMMON_PROVIDER_FIELDS.apiKey,
					COMMON_PROVIDER_FIELDS.requestUrl,
					COMMON_PROVIDER_FIELDS.modelName,
				]
			: [
					COMMON_PROVIDER_FIELDS.provider,
					COMMON_PROVIDER_FIELDS.apiKey,
					COMMON_PROVIDER_FIELDS.requestUrl,
				]
	}

	if (imageEditCodes.has(code)) {
		return imageEditFields[normalizedProvider] ?? []
	}

	return providerFieldsByCode[code] ?? []
}

export function getProviderFields(
	code: string,
	provider: string,
	providerConfig?: ProviderConfig,
): ProviderFieldConfig[] {
	const knownFields = getKnownProviderFields(code, provider)
	const inferredFields = inferProviderFields(providerConfig).filter(
		(field) => !knownFields.some((knownField) => knownField.name === field.name),
	)

	return [
		...(knownFields.length ? knownFields : [COMMON_PROVIDER_FIELDS.provider]),
		...inferredFields,
	]
}

export function getRequiredProviderFields(fields: ProviderFieldConfig[]) {
	return fields.filter((field) => field.required && field.name !== "provider")
}
