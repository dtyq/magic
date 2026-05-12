import type { MentionPanelSearchPlugin } from "../../registry-types"

export const toolsSearchPlugin: MentionPanelSearchPlugin = {
	id: "tools",
	search: ({ store, normalizedQuery }) =>
		store.toolsStore.searchItems(normalizedQuery, store.matchesQuery),
}
