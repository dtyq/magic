import { MentionPanelCatalogId } from "../../catalog-ids"
import type { MentionPanelCatalogPlugin } from "../../registry-types"

export const toolsCatalogPlugin: MentionPanelCatalogPlugin = {
	catalogId: MentionPanelCatalogId.TOOLS,
	resolveCatalog: ({ store, request }) => store.toolsStore.getItems(request.id ?? ""),
	buildCatalogRequest: ({ catalogId, itemId }) => {
		if (!catalogId || !itemId) return null

		return {
			kind: "catalog",
			catalogId,
			id: itemId,
		}
	},
}
