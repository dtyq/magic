import type { MentionPanelSearchPlugin } from "../../registry-types"

export const workspaceFilesSearchPlugin: MentionPanelSearchPlugin = {
	id: "project-files-or-upload-files",
	search: ({ store, normalizedQuery }) => {
		if (store.currentSelectedProject) {
			return store.workspaceFilesStore.searchItems(normalizedQuery, store.matchesQuery)
		}

		return []
	},
}
