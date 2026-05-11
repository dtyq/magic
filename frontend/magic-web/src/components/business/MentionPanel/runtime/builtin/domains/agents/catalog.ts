import { MentionPanelCatalogId } from "../../catalog-ids"
import type { MentionPanelCatalogPlugin } from "../../registry-types"

export const agentsCatalogPlugin: MentionPanelCatalogPlugin = {
	catalogId: MentionPanelCatalogId.AGENTS,
	resolveCatalog: ({ store }) => store.agentsStore.getItems(),
}
