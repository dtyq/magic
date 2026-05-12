import { MentionPanelCatalogId } from "../../catalog-ids"
import type { MentionPanelCatalogPlugin } from "../../registry-types"

export const tabsCatalogPlugin: MentionPanelCatalogPlugin = {
	catalogId: MentionPanelCatalogId.TABS,
	resolveCatalog: ({ store }) => store.tabsStore.getCurrentTabs(),
}
