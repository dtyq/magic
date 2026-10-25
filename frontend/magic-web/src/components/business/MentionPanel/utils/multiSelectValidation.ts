import type { MentionItem } from "../types"
import { MentionItemType } from "../types"

export async function prepareMentionItemForPending(
	item: MentionItem,
): Promise<{ canSelect: boolean; mcpValidated: boolean }> {
	// MCP entries in this panel are already-added connectors. Mentioning one
	// is a one-shot insertion and must never open the add/authorization flow.
	if (item.type === MentionItemType.MCP) return { canSelect: true, mcpValidated: true }

	return { canSelect: true, mcpValidated: false }
}
