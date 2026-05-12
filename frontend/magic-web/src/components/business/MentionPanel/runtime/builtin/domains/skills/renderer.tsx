import { Badge } from "@/components/shadcn-ui/badge"
import SmartTooltip from "@/components/other/SmartTooltip"
import SkillIcon from "../../../../components/icons/SkillIcon"
import { MentionItemType } from "../../../../types"
import type { MentionItemRenderer } from "../../../../renderers/types"
import { getSkillMentionSourceLabel } from "../../../../utils/getValue"
import { getRendererIconSize, renderMentionAvatarIcon } from "../shared/render-utils"

export const skillsRenderer: MentionItemRenderer = {
	renderIcon: ({ item, platform }) =>
		renderMentionAvatarIcon({
			icon: item.icon,
			platform,
			fallback: <SkillIcon size={getRendererIconSize(platform)} />,
		}),
	renderTitleSuffix: ({ item, platform }) => {
		if (platform !== "desktop") return null

		if (
			item.type !== MentionItemType.SKILL ||
			!item.package_name ||
			item.package_name === item.name
		)
			return null

		return (
			<Badge
				variant="secondary"
				className="min-w-0 max-w-full shrink justify-start rounded-sm px-1 py-0 text-[10px]"
			>
				<SmartTooltip
					className="block min-w-0 max-w-full truncate text-left text-[10px] leading-3"
					elementType="span"
				>
					{item.package_name}
				</SmartTooltip>
			</Badge>
		)
	},
	getTypeDescription: ({ item, t }) =>
		getSkillMentionSourceLabel(item, t) || t.defaultItems.skills,
}
