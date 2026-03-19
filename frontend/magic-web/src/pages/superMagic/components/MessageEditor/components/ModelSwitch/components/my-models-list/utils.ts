import type { ServiceProviderModel } from "@/apis/modules/org-ai-model-provider"
import type { ProviderTemplateOption, ServiceProvider } from "../AddModel/types"

export interface MyModelProviderEntry {
	model: ServiceProviderModel
	provider: ServiceProvider | null
	providerAlias: string
	providerName: string
	providerTypeName: string
}

export interface MyModelGroup {
	representativeModel: ServiceProviderModel
	providerEntries: MyModelProviderEntry[]
}

export function buildMyModelGroups({
	models,
	providers,
	providerTemplates,
}: {
	models: ServiceProviderModel[]
	providers: ServiceProvider[]
	providerTemplates: ProviderTemplateOption[]
}): MyModelGroup[] {
	const providerById = new Map(providers.map((provider) => [provider.id, provider]))
	const providerTemplateNameMap = new Map(
		providerTemplates.map((providerTemplate) => [
			providerTemplate.providerCode,
			providerTemplate.name,
		]),
	)
	const groupByModelId = new Map<string, MyModelGroup>()

	for (const model of models) {
		const provider = providerById.get(model.service_provider_config_id) ?? null
		const providerAlias = provider?.fields.alias?.trim() ?? ""
		const providerName = provider?.name ?? ""
		const providerTypeName = provider
			? (providerTemplateNameMap.get(provider.providerTypeId) ?? "")
			: ""
		const providerEntry: MyModelProviderEntry = {
			model,
			provider,
			providerAlias,
			providerName,
			providerTypeName,
		}
		const currentGroup = groupByModelId.get(model.model_id)

		if (currentGroup) {
			currentGroup.providerEntries.push(providerEntry)
			continue
		}

		groupByModelId.set(model.model_id, {
			representativeModel: model,
			providerEntries: [providerEntry],
		})
	}

	return Array.from(groupByModelId.values())
}
