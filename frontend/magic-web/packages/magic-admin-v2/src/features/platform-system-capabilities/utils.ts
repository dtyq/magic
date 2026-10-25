import type { ApiError } from "@magic-admin-v2/api/types"
import {
	DEFAULT_PROVIDER_LIST_MAP,
	DEPRECATED_PROVIDER_MAP,
} from "@magic-admin-v2/features/platform-system-capabilities/consts"
import {
	aiPowerStatus,
	type AiPowerDetail,
	type ProviderConfig,
} from "@magic-admin-v2/features/platform-system-capabilities/types"

export const emptyProvider: ProviderConfig = {
	provider: "",
	name: "",
	enable: false,
}

export function normalizeProviderCode(provider?: unknown) {
	return typeof provider === "string" ? provider.trim() : ""
}

export function normalizeProviderConfig(
	value: unknown,
	fallbackProvider?: ProviderConfig,
): ProviderConfig | null {
	if (!value || typeof value !== "object") return null

	const provider = value as Partial<ProviderConfig>
	const providerCode =
		normalizeProviderCode(provider.provider) ||
		normalizeProviderCode(provider.provider_code) ||
		normalizeProviderCode(provider.name) ||
		normalizeProviderCode(fallbackProvider?.provider)

	if (!providerCode) return null

	const fallbackProviderCode = normalizeProviderCode(fallbackProvider?.provider)
	const matchesFallbackProvider =
		Boolean(fallbackProviderCode) &&
		fallbackProviderCode.toLowerCase() === providerCode.toLowerCase()

	return {
		...(matchesFallbackProvider ? fallbackProvider : {}),
		...provider,
		provider: providerCode,
		name: provider.name || (matchesFallbackProvider ? fallbackProvider?.name : "") || providerCode,
		enable:
			provider.enable ?? (matchesFallbackProvider ? fallbackProvider?.enable : undefined) ?? false,
	}
}

export function getAvailableProviderList(code: string, apiProviders?: unknown) {
	const defaults = DEFAULT_PROVIDER_LIST_MAP[code] ?? []
	const fallback = defaults.length === 1 ? defaults[0] : undefined
	const rawProviders = Array.isArray(apiProviders)
		? apiProviders
		: apiProviders
			? [apiProviders]
			: []
	const providerMap = new Map<string, ProviderConfig>()

	for (const rawProvider of rawProviders) {
		const provider = normalizeProviderConfig(rawProvider, fallback)
		if (provider) providerMap.set(provider.provider.toLowerCase(), provider)
	}

	for (const defaultProvider of defaults) {
		const key = defaultProvider.provider.toLowerCase()
		if (!providerMap.has(key)) providerMap.set(key, { ...defaultProvider })
	}

	const deprecated = DEPRECATED_PROVIDER_MAP[code as keyof typeof DEPRECATED_PROVIDER_MAP]
	return Array.from(providerMap.values()).filter(
		(provider) => !deprecated?.has(provider.provider.toLowerCase()),
	)
}

export function hasProvidersConfig(detail?: AiPowerDetail | null) {
	return Boolean(
		detail?.config && Object.prototype.hasOwnProperty.call(detail.config, "providers"),
	)
}

export function isProviderConfigCapability(code: string, detail?: AiPowerDetail | null) {
	return hasProvidersConfig(detail) || Boolean(DEFAULT_PROVIDER_LIST_MAP[code]?.length)
}

export function getProviderLabel(provider: ProviderConfig) {
	return provider.name || provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1)
}

export function createCapabilityFormValues(
	detail: AiPowerDetail | null,
	providers: ProviderConfig[],
	fallbackStatus = false,
) {
	const activeProvider =
		providers.find((provider) => provider.provider && provider.enable) ??
		providers.find((provider) => provider.provider) ??
		emptyProvider

	return {
		status: detail ? detail.status === aiPowerStatus.enabled : fallbackStatus,
		selectedProvider: activeProvider.provider,
		model_id: detail?.config?.model_id ? String(detail.config.model_id) : "",
		prompt: typeof detail?.config?.prompt === "string" ? detail.config.prompt : "",
		provider: activeProvider,
	}
}

export function getApiErrorMessage(error: unknown, fallback: string) {
	if (typeof error === "object" && error !== null && "message" in error) {
		const message = (error as Pick<ApiError, "message">).message
		return typeof message === "string" && message.trim().length > 0 ? message : fallback
	}

	return fallback
}

const PRIVATE_CAPABILITY_BRAND_PATTERN = /超级麦吉|Super\s+Magic/gi

export function getCapabilityDisplayText(value: unknown) {
	if (typeof value !== "string") return ""

	return value
		.replace(/\s*[（(]\s*(?:超级麦吉|Super\s+Magic)\s*[）)]/gi, "")
		.replace(PRIVATE_CAPABILITY_BRAND_PATTERN, "")
		.replace(/\s{2,}/g, " ")
		.replace(/\s+([，。！？、：:；;）)])/g, "$1")
		.replace(/([（(])\s+/g, "$1")
		.replace(/^[\s，、：:；;|·•\-—–]+|[\s，、：:；;|·•\-—–]+$/g, "")
		.trim()
}
