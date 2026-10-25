import BotIcon from "../../../../components/icons/BotIcon"
import type { AgentMentionData } from "../../../../types"
import type { MentionItemRenderer } from "../../../../renderers/types"
import { getRendererIconSize, renderMentionAvatarIcon } from "../shared/render-utils"

export const agentsRenderer: MentionItemRenderer = {
	renderIcon: ({ item, platform }) =>
		renderMentionAvatarIcon({
			icon: item.icon,
			platform,
			fallback: <BotIcon size={getRendererIconSize(platform)} />,
		}),
	getTypeDescription: ({ item, isSearch, t }) => {
		if (isSearch && item.description) return item.description

		return (item.data as AgentMentionData | undefined)?.agent_source === "digital_employee"
			? t.defaultItems.digitalEmployees
			: t.defaultItems.agents
	},
}
