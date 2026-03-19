import type { ProviderFieldConfig } from "./types"

interface BuildFieldConfigParams {
	key: string
	providerCode?: string
	required?: boolean
}

export type ProviderFieldValidationError = "required" | "invalid_url" | "invalid_email" | null

const FIELD_KEY_ALIAS_MAP: Record<string, string> = {
	api_address: "url",
	api_url: "url",
	apikey: "api_key",
}

const PROVIDER_URL_PLACEHOLDER_MAP: Record<string, string> = {
	microsoft: "https://docs-test-001.openai.azure.com",
	microsoftazure: "https://docs-test-001.openai.azure.com",
	azure: "https://docs-test-001.openai.azure.com",
	openrouter: "https://openrouter.ai/api/v1",
	deepseek: "https://api.deepseek.com",
	alibabacloud: "https://dashscope.aliyuncs.com/compatible-mode/v1",
	dashscope: "https://dashscope.aliyuncs.com/compatible-mode/v1",
	volcengine: "https://ark.cn-beijing.volces.com/api/v3",
	gemini: "https://generativelanguage.googleapis.com",
	google: "https://generativelanguage.googleapis.com",
	custom: "https://api.example.com/v1",
}

const PROVIDER_API_KEY_PLACEHOLDER_MAP: Record<string, string> = {
	microsoft: "Azure API Key",
	microsoftazure: "Azure API Key",
	azure: "Azure API Key",
	google: "Google API Key",
	gemini: "Google API Key",
	openrouter: "OpenRouter API Key",
	alibabacloud: "Aliyun (Bailian) API Key",
	dashscope: "Aliyun (Bailian) API Key",
	volcengine: "Volcengine API Key",
	deepseek: "DeepSeek API Key",
	custom: "Custom Provider API Key",
}

const REQUIRED_FIELD_KEYS = new Set(["api_key", "url"])

function normalizeKey(rawKey: string): string {
	const snakeCaseKey = rawKey.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()
	return FIELD_KEY_ALIAS_MAP[snakeCaseKey] ?? snakeCaseKey
}

function normalizeProviderCode(providerCode?: string): string {
	if (!providerCode) return ""
	return providerCode.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
}

function getFieldStorageKey(rawKey: string, canonicalKey: string): string {
	const normalizedRawKey = rawKey.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()
	const aliasKey = FIELD_KEY_ALIAS_MAP[normalizedRawKey]
	if (aliasKey) return canonicalKey

	// Keep known backend keys in canonical snake_case.
	if (REQUIRED_FIELD_KEYS.has(canonicalKey)) return canonicalKey
	if (canonicalKey === "api_version") return canonicalKey

	return rawKey
}

export function normalizeProviderFieldKey(rawKey: string): string {
	return normalizeKey(rawKey)
}

export function isAzureLikeProviderCode(providerCode?: string): boolean {
	const normalizedProviderCode = normalizeProviderCode(providerCode)
	return normalizedProviderCode.includes("azure") || normalizedProviderCode.includes("microsoft")
}

function toTitleCase(rawKey: string): string {
	return rawKey
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.replace(/\b\w/g, (m) => m.toUpperCase())
}

function resolveRequired(canonicalKey: string, required?: boolean): boolean {
	if (typeof required === "boolean") return required
	return REQUIRED_FIELD_KEYS.has(canonicalKey)
}

export function buildProviderFieldConfig({
	key,
	providerCode,
	required,
}: BuildFieldConfigParams): ProviderFieldConfig {
	const canonicalKey = normalizeKey(key)
	const fieldKey = getFieldStorageKey(key, canonicalKey)
	const normalizedProviderCode = normalizeProviderCode(providerCode)
	const isRequired = resolveRequired(canonicalKey, required)

	if (canonicalKey === "alias") {
		return {
			key: fieldKey,
			label: "Provider Alias",
			labelKey: "providerAlias",
			required: isRequired,
			placeholder: "Enter Provider Alias",
			inputType: "text",
		}
	}

	if (canonicalKey === "api_key") {
		const defaultApiKeyPlaceholder =
			PROVIDER_API_KEY_PLACEHOLDER_MAP[normalizedProviderCode] ?? "API Key"
		return {
			key: fieldKey,
			label: "API Key",
			labelKey: "apiKey",
			required: isRequired,
			placeholder: defaultApiKeyPlaceholder,
			inputType: "password",
		}
	}

	if (canonicalKey === "api_version") {
		return {
			key: fieldKey,
			label: "Azure API Version",
			labelKey: "azureApiVersion",
			required: isRequired,
			placeholder: "20XX-XX-XX",
			inputType: "text",
		}
	}

	if (canonicalKey === "url") {
		const isAzure = isAzureLikeProviderCode(providerCode)
		const defaultUrl = PROVIDER_URL_PLACEHOLDER_MAP[normalizedProviderCode]
		return {
			key: fieldKey,
			label: isAzure ? "Azure API Address" : "API Url",
			labelKey: isAzure ? "azureApiAddress" : "apiUrl",
			required: isRequired,
			placeholder: defaultUrl ?? "https://api.example.com/v1",
			inputType: "text",
			validator: "url",
		}
	}

	return {
		key: fieldKey,
		label: toTitleCase(canonicalKey),
		required: isRequired,
		placeholder: toTitleCase(canonicalKey),
		inputType: "text",
	}
}

export function buildProviderFieldConfigsFromSchema(
	schema: Record<string, { required?: boolean }>,
	providerCode?: string,
): ProviderFieldConfig[] {
	const fieldConfigs = Object.keys(schema).map((key) =>
		buildProviderFieldConfig({
			key,
			providerCode,
			required: schema[key]?.required,
		}),
	)
	return fieldConfigs
}

export function validateProviderFieldValue(
	field: ProviderFieldConfig,
	value: string | undefined,
): ProviderFieldValidationError {
	const trimmedValue = value?.trim() ?? ""

	if (field.required && !trimmedValue) return "required"
	if (!trimmedValue) return null

	if (field.validator === "url") {
		const isValidUrl = /^https?:\/\/[^ ]+$/i.test(trimmedValue)
		if (!isValidUrl) return "invalid_url"
	}

	if (field.validator === "email") {
		const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)
		if (!isValidEmail) return "invalid_email"
	}

	return null
}
