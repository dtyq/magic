import type { MentionPanelSearchPlugin } from "../../registry-types"

export const agentsSearchPlugin: MentionPanelSearchPlugin = {
	id: "agents",
	search: ({ store, normalizedQuery }) =>
		store.agentsStore.searchItems(normalizedQuery, store.matchesQuery),
}
