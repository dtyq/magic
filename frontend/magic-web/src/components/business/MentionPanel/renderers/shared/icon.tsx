import type { MentionItemRendererContext } from "../types"
import { MentionItemType } from "../../types"
import { MentionPanelItemType } from "../../runtime/builtin/panel-item-types"
import {
	renderMentionFileIcon,
	renderMentionFolderIcon,
	renderMentionMappedIcon,
} from "../../runtime/builtin/domains/shared/render-utils"

export function renderMentionItemIcon(context: MentionItemRendererContext) {
	const { item, platform } = context
	const { icon, type } = item

	if (
		type === MentionItemType.DIVIDER ||
		type === MentionPanelItemType.TABS ||
		type === MentionPanelItemType.HISTORIES
	) {
		return null
	}

	if (type === MentionItemType.TITLE) return icon

	if (
		(type === MentionItemType.PROJECT_FILE || type === MentionItemType.UPLOAD_FILE) &&
		typeof icon === "string"
	) {
		return renderMentionFileIcon(context)
	}

	if (icon === "file-folder") {
		return renderMentionFolderIcon(context)
	}

	if (typeof icon === "string") {
		return renderMentionMappedIcon(context)
	}

	if (platform === "desktop") {
		return (
			<div className="flex h-4 w-4 shrink-0 items-center justify-center text-xs">{icon}</div>
		)
	}

	return icon
}
