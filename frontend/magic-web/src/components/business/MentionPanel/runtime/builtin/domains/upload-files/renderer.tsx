import type { MentionItemRenderer } from "../../../../renderers/types"
import { renderMentionFileIcon } from "../shared/render-utils"

export const uploadFilesRenderer: MentionItemRenderer = {
	renderIcon: renderMentionFileIcon,
	getTypeDescription: ({ item, isSearch, t }) =>
		(isSearch && item.description) || t.defaultItems.uploadFiles,
}
