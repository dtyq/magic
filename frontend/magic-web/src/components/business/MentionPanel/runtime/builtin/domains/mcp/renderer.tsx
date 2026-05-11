import PlugIcon from "../../../../components/icons/PlugIcon"
import type { MentionItemRenderer } from "../../../../renderers/types"
import { getRendererIconSize, renderMentionAvatarIcon } from "../shared/render-utils"

export const mcpRenderer: MentionItemRenderer = {
	renderIcon: ({ item, platform }) =>
		renderMentionAvatarIcon({
			icon: item.icon,
			platform,
			fallback: <PlugIcon size={getRendererIconSize(platform)} />,
		}),
	getTypeDescription: ({ item, isSearch, t }) =>
		(isSearch && item.description) || t.defaultItems.mcpExtensions,
}
