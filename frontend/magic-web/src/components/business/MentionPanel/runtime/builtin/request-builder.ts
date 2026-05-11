import { PanelState } from "../../types"
import type { MentionStoreRequestBuildOptions } from "../../types"
import type { I18nTexts } from "../../i18n/types"
import type { MentionStoreRequest } from "../../dispatch"
import { mentionPanelCatalogPluginMap } from "./registry"

export function buildMentionStoreRequest(
	options: MentionStoreRequestBuildOptions<string>,
): MentionStoreRequest | null {
	const { state, catalogId, itemId, query, scopeFolderId, t } = options

	switch (state) {
		case PanelState.DEFAULT:
			return {
				kind: "default",
				options: {
					t: t as I18nTexts,
				},
			}
		case PanelState.SEARCH:
			if (!query?.trim()) return null
			return {
				kind: "search",
				query,
				...(scopeFolderId?.trim() ? { scopeFolderId: scopeFolderId.trim() } : {}),
			}
		case PanelState.FOLDER:
			if (!itemId) return null
			return {
				kind: "children",
				id: itemId,
			}
		case PanelState.CATALOG:
			if (!catalogId) return null
			const catalogPlugin = mentionPanelCatalogPluginMap.get(catalogId)
			const pluginRequest = catalogPlugin?.buildCatalogRequest?.(options)
			if (pluginRequest !== undefined) return pluginRequest

			return {
				kind: "catalog",
				catalogId,
			}
		default:
			return null
	}
}
