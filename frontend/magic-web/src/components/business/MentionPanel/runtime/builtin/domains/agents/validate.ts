import { MentionItemType, type AgentMentionData } from "../../../../types"
import type { MentionPanelValidationPlugin } from "../../registry-types"

export const agentsValidationPlugin: MentionPanelValidationPlugin = {
	itemType: MentionItemType.AGENT,
	validate: ({ store, data }) => store.agentsStore.hasItem((data as AgentMentionData).agent_id),
}
