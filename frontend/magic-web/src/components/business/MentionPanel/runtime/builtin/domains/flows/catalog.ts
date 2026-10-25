import { createFlowItems } from "../../default-items"
import { MentionPanelCatalogId } from "../../catalog-ids"
import type { MentionPanelCatalogPlugin } from "../../registry-types"

export const flowsCatalogPlugin: MentionPanelCatalogPlugin = {
	catalogId: MentionPanelCatalogId.FLOWS,
	resolveCatalog: ({ request }) => createFlowItems(request.options?.t),
	buildCatalogRequest: ({ catalogId, t }) => {
		if (!catalogId) return null

		return {
			kind: "catalog",
			catalogId,
			...(t ? { options: { t } } : {}),
		}
	},
}
