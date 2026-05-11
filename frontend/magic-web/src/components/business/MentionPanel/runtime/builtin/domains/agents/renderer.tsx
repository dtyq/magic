import BotIcon from "../../../../components/icons/BotIcon"
import type { MentionItemRenderer } from "../../../../renderers/types"
import { getRendererIconSize, renderMentionAvatarIcon } from "../shared/render-utils"

export const agentsRenderer: MentionItemRenderer = {
	renderIcon: ({ item, platform }) =>
		renderMentionAvatarIcon({
			icon: item.icon,
			platform,
			fallback: <BotIcon size={getRendererIconSize(platform)} />,
		}),
	getTypeDescription: ({ item, isSearch, t }) =>
		(isSearch && item.description) || t.defaultItems.agents,
}
