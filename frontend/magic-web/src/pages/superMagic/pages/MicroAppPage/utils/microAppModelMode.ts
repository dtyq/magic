import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"

/** 微应用统一使用 default 模型目录，不再读取微应用员工的模型配置。 */
export function resolveMicroAppModelSelectionMode(): TopicMode {
	return TopicMode.Default
}

/**
 * Preview/published chats can switch employees. Keep the employee catalog
 * when it has models; otherwise use default so the picker is not empty.
 */
export function resolveMicroAppRuntimeModelSelectionMode(
	topicMode: TopicMode,
	agentCode?: string | null,
): TopicMode {
	return superMagicModeService.resolveModelSelectionMode(topicMode, TopicMode.Default, agentCode)
}
