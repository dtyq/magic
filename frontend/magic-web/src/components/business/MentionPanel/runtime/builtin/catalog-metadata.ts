import type { I18nTexts } from "../../i18n/types"
import type { MentionPanelCatalogHeaderMeta } from "../../types"
import { MentionPanelCatalogId } from "./catalog-ids"
import type { MentionPanelCatalogId as MentionPanelCatalogIdValue } from "./catalog-ids"

function getCatalogHint(
	catalogId: MentionPanelCatalogIdValue | undefined,
	t: I18nTexts,
): string | null {
	if (catalogId === MentionPanelCatalogId.MCP_EXTENSIONS) return t.mcpHint
	if (catalogId === MentionPanelCatalogId.SKILLS) return t.skillHint

	return null
}

export function getCatalogHeaderMeta(
	catalogId: MentionPanelCatalogIdValue | undefined,
	t: I18nTexts,
): MentionPanelCatalogHeaderMeta {
	if (catalogId === MentionPanelCatalogId.MCP_EXTENSIONS) {
		return {
			hint: getCatalogHint(catalogId, t),
			icon: "mcp",
		}
	}

	if (catalogId === MentionPanelCatalogId.SKILLS) {
		return {
			hint: getCatalogHint(catalogId, t),
			icon: "skills",
		}
	}

	return {
		hint: getCatalogHint(catalogId, t),
		icon: null,
	}
}
