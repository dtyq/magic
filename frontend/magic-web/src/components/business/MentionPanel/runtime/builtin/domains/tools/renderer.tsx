import ToolIcon from "../../../../components/icons/ToolIcon"
import type { MentionItemRenderer } from "../../../../renderers/types"
import { getRendererIconSize, renderMentionAvatarIcon } from "../shared/render-utils"

export const toolsRenderer: MentionItemRenderer = {
	renderIcon: ({ item, platform }) => {
		if (typeof item.icon === "string") {
			return renderMentionAvatarIcon({
				icon: item.icon,
				platform,
				fallback: <ToolIcon size={getRendererIconSize(platform)} />,
			})
		}

		return item.icon ?? <ToolIcon size={getRendererIconSize(platform)} />
	},
	getTypeDescription: ({ item, isSearch, t }) =>
		(isSearch && item.description) || t.defaultItems.tools,
}
