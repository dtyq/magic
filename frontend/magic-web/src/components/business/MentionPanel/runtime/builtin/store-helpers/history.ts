import type { MentionItem } from "../../../types"
import {
	getMentionDescription,
	getMentionDisplayName,
	getMentionIcon,
	getMentionUniqueId,
} from "../../../tiptap-plugin/types"
import type { MentionListItem } from "../../../tiptap-plugin/types"

export function mergeSmartRecommendations(
	tabsItems: MentionItem[],
	historyItems: MentionItem[],
): MentionItem[] {
	const itemsMap = new Map<string, MentionItem>()

	tabsItems.forEach((item) => {
		const uniqueId = getMentionUniqueId({ type: item.type, data: item.data })
		if (!itemsMap.has(uniqueId)) itemsMap.set(uniqueId, item)
	})

	historyItems.forEach((item) => {
		const uniqueId = getMentionUniqueId({ type: item.type, data: item.data })
		if (!itemsMap.has(uniqueId)) itemsMap.set(uniqueId, item)
	})

	return Array.from(itemsMap.values())
}

export function convertMentionListItemToMentionItem(
	mentionListItem: MentionListItem,
): MentionItem | null {
	if (!mentionListItem?.attrs) return null

	const attrs = mentionListItem.attrs
	const id = getMentionUniqueId(attrs)
	const name = getMentionDisplayName(attrs)
	const icon = getMentionIcon(attrs)
	const description = getMentionDescription(attrs)

	return {
		id,
		name,
		icon,
		description,
		type: attrs.type,
		data: attrs.data,
		hasChildren: false,
		isFolder: false,
	}
}
