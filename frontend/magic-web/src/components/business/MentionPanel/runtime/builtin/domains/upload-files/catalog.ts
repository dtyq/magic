import { MentionPanelCatalogId } from "../../catalog-ids"
import type { MentionPanelCatalogPlugin } from "../../registry-types"

export const uploadFilesCatalogPlugin: MentionPanelCatalogPlugin = {
	catalogId: MentionPanelCatalogId.UPLOAD_FILES,
	resolveCatalog: ({ store }) => store.uploadFilesStore.getItems(),
}
