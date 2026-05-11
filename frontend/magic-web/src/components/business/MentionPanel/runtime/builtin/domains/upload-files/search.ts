import type { MentionPanelSearchPlugin } from "../../registry-types"

export const uploadFilesSearchPlugin: MentionPanelSearchPlugin = {
	id: "project-files-or-upload-files",
	search: ({ store, normalizedQuery }) => {
		if (store.currentSelectedProject) return []

		return store.uploadFilesStore.searchItems(normalizedQuery, store.matchesQuery)
	},
}
