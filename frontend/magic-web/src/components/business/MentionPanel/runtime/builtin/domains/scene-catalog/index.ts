import { MentionPanelCatalogId } from "../../catalog-ids"
import type { MentionPanelCatalogPlugin, MentionPanelSearchPlugin } from "../../registry-types"

export {
	MentionPanelSceneCatalogStore,
	SCENE_CATALOG_ITEM_TAG,
	getSceneCatalogName,
	isSceneCatalogItem,
} from "./store"

export const sceneCatalogCatalogPlugin: MentionPanelCatalogPlugin = {
	catalogId: MentionPanelCatalogId.SCENE_CATALOG,
	resolveCatalog: ({ store }) => store.sceneCatalogStore.getItems(),
}

export const sceneCatalogSearchPlugin: MentionPanelSearchPlugin = {
	id: "scene-catalog",
	search: ({ store, normalizedQuery }) =>
		store.sceneCatalogStore.searchItems(normalizedQuery, store.matchesQuery),
}
