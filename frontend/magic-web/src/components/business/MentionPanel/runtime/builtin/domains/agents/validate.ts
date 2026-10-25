import { MentionItemType, type AgentMentionData } from "../../../../types"
import type { MentionPanelValidationPlugin } from "../../registry-types"

export const agentsValidationPlugin: MentionPanelValidationPlugin = {
	itemType: MentionItemType.AGENT,
	validate: ({ store, data }) => {
		const agentId = (data as AgentMentionData).agent_id
		return store.agentsStore.hasItem(agentId) || store.digitalEmployeesStore.hasItem(agentId)
	},
}
