import { MentionPanelCatalogId } from "../../catalog-ids"
import type { MentionPanelCatalogPlugin } from "../../registry-types"

export const mcpCatalogPlugin: MentionPanelCatalogPlugin = {
	catalogId: MentionPanelCatalogId.MCP_EXTENSIONS,
	resolveCatalog: async ({ store }) => {
		await store.mcpStore.fetchItems()
		return store.mcpStore.getItems()
	},
}
