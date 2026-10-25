import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import {
	isAutoModel,
	isModelDisabled,
} from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/utils"

/** Disabled or deleted models are rejected by the gateway, so never offer them. */
export function filterNotesModels(models: ModelItem[]): ModelItem[] {
	return models.filter((model) => model.model_id && !isModelDisabled(model))
}

/**
 * Picks the model for a notes request: the saved choice if still available,
 * otherwise the first concrete model. "Auto" is a routing alias, not a gateway model,
 * so it is only used when nothing else exists.
 */
export function resolveNotesModelId(models: ModelItem[], preferredId?: string): string | undefined {
	const available = filterNotesModels(models)
	const preferred = available.find((model) => model.model_id === preferredId)
	if (preferred) return preferred.model_id
	return (available.find((model) => !isAutoModel(model)) ?? available[0])?.model_id
}
