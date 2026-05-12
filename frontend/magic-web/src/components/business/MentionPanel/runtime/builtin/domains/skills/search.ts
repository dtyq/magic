import type { MentionPanelSearchPlugin } from "../../registry-types"

export const skillsSearchPlugin: MentionPanelSearchPlugin = {
	id: "skills",
	search: ({ store, normalizedQuery }) =>
		store.skillsStore.searchItems(normalizedQuery, store.matchesQuery),
}
