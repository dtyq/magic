import { MentionPanelCatalogId } from "../../catalog-ids"
import type { MentionPanelCatalogPlugin } from "../../registry-types"

export const historyCatalogPlugin: MentionPanelCatalogPlugin = {
	catalogId: MentionPanelCatalogId.HISTORIES,
	resolveCatalog: ({ store }) => store.historyStore.getAllHistoryItems(),
}
