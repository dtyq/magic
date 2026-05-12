import type { MentionPanelSearchPlugin } from "../../registry-types"

export const mcpSearchPlugin: MentionPanelSearchPlugin = {
	id: "mcp",
	search: ({ store, normalizedQuery }) =>
		store.mcpStore.searchItems(normalizedQuery, store.matchesQuery),
}
