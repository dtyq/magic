import type { ServiceProviderModel } from "@/apis/modules/org-ai-model-provider"
import type { ServiceProvider } from "../AddModel/types"

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

export function buildMyModelGroups({ models }: { models: ServiceProviderModel[] }): MyModelGroup[] {
	const groupByModelId = new Map<string, MyModelGroup>()

	for (const model of models) {
		const provider = buildProviderFromModel(model)
		const providerAlias = provider?.fields.alias?.trim() ?? ""
		const providerName = provider?.name ?? ""
		const providerTypeName = ""
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

function buildProviderFromModel(model: ServiceProviderModel): ServiceProvider | null {
	const providerConfig = model.service_provider_config
	if (!providerConfig?.id) return null

	const providerName = providerConfig.name?.trim() ?? ""

	return {
		id: providerConfig.id,
		name: providerName,
		icon: "",
		providerTypeId: "",
		fields: {
			alias: "",
		},
	}
}
