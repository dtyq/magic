import { useMemo } from "react"
import { computed } from "mobx"
import ConversationStore from "@/opensource/stores/chatNew/conversation"

function useChatUnreadCount() {
	return useMemo(() => {
		return computed(() => {
			return Object.values(ConversationStore.conversations).reduce((acc, item) => {
				if (item.unread_dots) {
					return acc + item.unread_dots
				}

				return acc
			}, 0)
		})
	}, []).get()
}

export default useChatUnreadCount
