import { getMentionUniqueId } from "../../../tiptap-plugin/types"
import type { MentionItem } from "../../../types"

export function prependPinnedRootItems(
	items: MentionItem[],
	pinnedItems: MentionItem[],
): MentionItem[] {
	if (pinnedItems.length === 0) return items

	const pinnedKeys = new Set<string>()
	for (const item of pinnedItems) {
		if (item.id) pinnedKeys.add(item.id)
		const uniqueId = getMentionUniqueId({ type: item.type, data: item.data })
		if (uniqueId) pinnedKeys.add(uniqueId)
	}

	const rest = items.filter((item) => {
		if (pinnedKeys.has(item.id)) return false
		const uniqueId = getMentionUniqueId({ type: item.type, data: item.data })
		return !uniqueId || !pinnedKeys.has(uniqueId)
	})

	return [...pinnedItems, ...rest]
}
