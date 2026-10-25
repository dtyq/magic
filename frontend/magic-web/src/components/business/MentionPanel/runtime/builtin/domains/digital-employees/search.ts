import type { MentionPanelSearchPlugin } from "../../registry-types"

export const digitalEmployeesSearchPlugin: MentionPanelSearchPlugin = {
	id: "digital-employees",
	search: ({ store, normalizedQuery }) =>
		store.digitalEmployeesStore.searchItems(normalizedQuery, store.matchesQuery),
}
