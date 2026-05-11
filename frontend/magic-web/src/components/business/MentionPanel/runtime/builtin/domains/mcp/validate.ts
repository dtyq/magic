import { MentionItemType, type McpMentionData } from "../../../../types"
import type { MentionPanelValidationPlugin } from "../../registry-types"

export const mcpValidationPlugin: MentionPanelValidationPlugin = {
	itemType: MentionItemType.MCP,
	validate: ({ store, data }) => store.mcpStore.hasItem((data as McpMentionData).id),
}
