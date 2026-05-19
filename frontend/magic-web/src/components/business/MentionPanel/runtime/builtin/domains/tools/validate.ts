import { MentionItemType, type ToolMentionData } from "../../../../types"
import type { MentionPanelValidationPlugin } from "../../registry-types"

export const toolsValidationPlugin: MentionPanelValidationPlugin = {
	itemType: MentionItemType.TOOL,
	validate: ({ store, data }) => store.toolsStore.hasItem((data as ToolMentionData).id),
}
