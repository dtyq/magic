import type {
	ProviderFieldConfig,
	ProviderTemplate,
	ProviderTemplateOption,
	ServiceProvider,
} from "../types"
import {
	buildProviderFieldConfig,
	buildProviderFieldConfigsFromSchema,
	isAzureLikeProviderCode,
	normalizeProviderFieldKey,
} from "../providerFieldConfigs"

function resolveTranslatedProviderName(c: { translate?: { alias?: Record<string, string> } }) {
	const translatedAliasMap = c.translate?.alias
	if (!translatedAliasMap) return ""
	return (
		Object.values(translatedAliasMap).find(
			(value) => typeof value === "string" && value.trim(),
		) ?? ""
	)
}

function resolveServiceProviderDisplayName({
	config,
	providerTemplateNameMap,
}: {
	config: {
		alias?: string
		name: string
		provider_code: string
		id: string
		translate?: { alias?: Record<string, string> }
	}
	providerTemplateNameMap?: Map<string, string>
}) {
	const alias = config.alias?.trim()
	if (alias) return alias
	const providerTemplateName = providerTemplateNameMap?.get(config.provider_code)?.trim()
	if (providerTemplateName) return providerTemplateName
	const translatedProviderName = resolveTranslatedProviderName(config).trim()
	if (translatedProviderName) return translatedProviderName
	return config.name ?? config.id
}

export function syncServiceProviderWithTemplateName({
	provider,
	providerTemplateNameMap,
}: {
	provider: ServiceProvider
	providerTemplateNameMap?: Map<string, string>
}): ServiceProvider {
	const providerTemplateName = providerTemplateNameMap?.get(provider.providerTypeId)?.trim()
	if (!providerTemplateName) return provider
	if (provider.fields.alias?.trim()) return provider
	return {
		...provider,
		name: providerTemplateName,
		fields: {
			...provider.fields,
			alias: providerTemplateName,
		},
	}
}

/** Convert ProviderTemplate to template option with config-driven fields */
export function templateToProviderType(t: ProviderTemplate): ProviderTemplateOption {
	const schema = t.config_schema ?? {}
	const providerCode = t.provider_code ?? t.id
	const templateId = t.id ?? providerCode
	const schemaFields = buildProviderFieldConfigsFromSchema(schema, providerCode)
	const fields: ProviderFieldConfig[] = [...schemaFields]
	if (schemaFields.length === 0) {
		fields.push(
			buildProviderFieldConfig({
				key: "api_key",
				providerCode,
			}),
			buildProviderFieldConfig({
				key: "url",
				providerCode,
			}),
		)
	}
	const hasApiVersionField = fields.some(
		(field) => normalizeProviderFieldKey(field.key) === "api_version",
	)
	if (isAzureLikeProviderCode(providerCode) && !hasApiVersionField) {
		fields.push(
			buildProviderFieldConfig({
				key: "api_version",
				providerCode,
				required: false,
			}),
		)
	}
	if (!fields.some((field) => field.key === "alias")) {
		fields.unshift(
			buildProviderFieldConfig({
				key: "alias",
				providerCode,
				required: false,
			}),
		)
	}
	return {
		id: templateId,
		name: t.name ?? providerCode,
		icon: t.icon ?? "",
		providerCode,
		fields,
	}
}

/** Map backend ServiceProviderConfig to ServiceProvider */
export function configToServiceProvider(
	c: {
		alias?: string
		name: string
		provider_code: string
		id: string
		icon?: string
		config: Record<string, unknown>
		translate?: { alias?: Record<string, string> }
	},
	providerTemplateNameMap?: Map<string, string>,
): ServiceProvider {
	const config = c.config ?? {}
	const fields: Record<string, string> = {}
	for (const k of Object.keys(config)) {
		const v = config[k]
		const normalizedKey = normalizeProviderFieldKey(k)
		fields[normalizedKey] = typeof v === "string" ? v : String(v ?? "")
	}
	fields.alias =
		c.alias?.trim() ||
		providerTemplateNameMap?.get(c.provider_code)?.trim() ||
		resolveTranslatedProviderName(c).trim() ||
		c.name ||
		""
	return {
		id: c.id,
		name: resolveServiceProviderDisplayName({
			config: c,
			providerTemplateNameMap,
		}),
		icon: c.icon ?? "",
		providerTypeId: c.provider_code,
		fields,
	}
}
