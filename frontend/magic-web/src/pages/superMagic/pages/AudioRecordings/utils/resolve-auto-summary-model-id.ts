import { isAutoModel } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/utils"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"

/** Fetches summary-mode model list and returns the auto model_id from API */
export async function resolveAutoSummaryModelId(): Promise<string | undefined> {
	await superMagicModeService.fetchModeList()
	const models = superMagicModeService.getModelListByMode(TopicMode.RecordSummary)
	const autoModel = models.find(isAutoModel)
	return autoModel?.model_id
}
