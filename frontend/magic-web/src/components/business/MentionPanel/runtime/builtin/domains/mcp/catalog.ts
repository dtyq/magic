import { MentionPanelCatalogId } from "../../catalog-ids"
import type { MentionPanelCatalogPlugin } from "../../registry-types"

export const mcpCatalogPlugin: MentionPanelCatalogPlugin = {
	catalogId: MentionPanelCatalogId.MCP_EXTENSIONS,
	resolveCatalog: ({ store }) => store.mcpStore.getItems(),
}
