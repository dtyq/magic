import type { MentionItemRenderer } from "../../../../renderers/types"
import { renderMentionItemIcon } from "../../../../renderers/shared/icon"

export const historyRenderer: MentionItemRenderer = {
	renderIcon: renderMentionItemIcon,
}
