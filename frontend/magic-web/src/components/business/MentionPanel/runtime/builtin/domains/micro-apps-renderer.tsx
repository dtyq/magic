import MicroAppIcon from "../../../components/icons/MicroAppIcon"
import type { MentionItemRenderer } from "../../../renderers/types"
import { getRendererIconSize } from "./shared/render-utils"

export const microAppsRenderer: MentionItemRenderer = {
	renderIcon: ({ item, platform }) => {
		const size = getRendererIconSize(platform)
		if (typeof item.icon === "string" && item.icon.trim() && item.icon !== "ts-attachment") {
			return (
				<img
					src={item.icon}
					alt=""
					className="rounded object-cover"
					style={{ width: size, height: size }}
				/>
			)
		}
		return <MicroAppIcon size={size} />
	},
}
