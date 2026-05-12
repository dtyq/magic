import { MentionPanelCatalogId } from "../../catalog-ids"
import type { MentionPanelCatalogPlugin } from "../../registry-types"

export const skillsCatalogPlugin: MentionPanelCatalogPlugin = {
	catalogId: MentionPanelCatalogId.SKILLS,
	resolveCatalog: async ({ store, request }) => {
		if (request.options?.refresh) return store.skillsStore.refreshItems()

		return store.skillsStore.getItems()
	},
	buildCatalogRequest: ({ catalogId }) => {
		if (!catalogId) return null

		return {
			kind: "catalog",
			catalogId,
			options: {
				refresh: true,
			},
		}
	},
}
