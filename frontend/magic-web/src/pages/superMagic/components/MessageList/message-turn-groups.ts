import type { SuperMagicMessageItem } from "./type"
import { getMessageNodeKey } from "./helpers"

export interface MessageTurnGroupItem {
	node: SuperMagicMessageItem
	index: number
}

export interface MessageTurnGroup {
	key: string
	stickyItem: MessageTurnGroupItem | null
	items: Array<MessageTurnGroupItem>
}

/** User turn starts a sticky group; assistant lines attach to the latest user turn */
export function isUserRoleMessage(node?: SuperMagicMessageItem): boolean {
	return node?.role !== "assistant"
}

export function buildMessageKeysAndTurnGroups(messages: Array<SuperMagicMessageItem>): {
	messageKeys: Array<string>
	messageTurnGroups: Array<MessageTurnGroup>
} {
	const groups: Array<MessageTurnGroup> = []
	const messageKeys: Array<string> = []
	let leadingGroup: MessageTurnGroup | null = null
	let currentTurnGroup: MessageTurnGroup | null = null

	messages.forEach((node, index) => {
		const item: MessageTurnGroupItem = { node, index }
		const nodeKey = getMessageNodeKey(node) || `${node?.role || "message"}-${index}`
		const stableNodeKey = getMessageNodeKey(node)

		if (stableNodeKey) messageKeys.push(stableNodeKey)

		if (isUserRoleMessage(node)) {
			currentTurnGroup = {
				key: `turn-${nodeKey}`,
				stickyItem: item,
				items: [item],
			}
			groups.push(currentTurnGroup)
			return
		}

		if (currentTurnGroup) {
			currentTurnGroup.items.push(item)
			return
		}

		if (!leadingGroup) {
			leadingGroup = {
				key: "leading-messages",
				stickyItem: null,
				items: [],
			}
			groups.push(leadingGroup)
		}
		leadingGroup.items.push(item)
	})

	return { messageKeys, messageTurnGroups: groups }
}
