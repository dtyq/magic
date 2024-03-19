import { useMemo } from "react"
import { computed } from "mobx"
import ConversationStore from "@/opensource/stores/chatNew/conversation"
import ConversationStoreSidebar from "@/opensource/stores/chatNew/conversationSidebar"
import { formatChatItemList } from "../utils"
import { ChatItemData } from "../components/ChatItem"
import Conversation from "@/opensource/models/chat/conversation"

interface UseChatListsReturn {
	chatList: ChatItemData[]
	chatUnreadCount: number
	topChatList: ChatItemData[]
	topChatUnreadCount: number
	aiList: ChatItemData[]
	aiUnreadCount: number
}

function useChatLists(lang: any): UseChatListsReturn {
	const { list: chatList, unreadCount: chatUnreadCount } = useMemo(() => {
		return computed(() => {
			const result = Object.values(ConversationStore.conversations).reduce((acc, item) => {
				if (item && !item.is_top) {
					acc.push(item)
				}
				return acc
			}, [] as Conversation[])

			const list = formatChatItemList(result, lang)
			const unreadCount = list.reduce((acc, item) => acc + item.unreadCount, 0)
			return {
				list,
				unreadCount,
			}
		})
	}, [lang]).get()

	const { list: topChatList, unreadCount: topChatUnreadCount } = useMemo(() => {
		return computed(() => {
			const result = ConversationStoreSidebar.conversationSiderbarGroups.top.reduce(
				(acc, item) => {
					if (ConversationStore.conversations[item]) {
						acc.push(ConversationStore.conversations[item])
					}
					return acc
				},
				[] as Conversation[],
			)
			const list = formatChatItemList(result, lang)
			const unreadCount = list.reduce((acc, item) => acc + item.unreadCount, 0)
			return {
				list,
				unreadCount,
			}
		})
	}, [lang]).get()

	const { list: aiList, unreadCount: aiUnreadCount } = useMemo(() => {
		return computed(() => {
			const result = ConversationStoreSidebar.conversationSiderbarGroups.ai.reduce(
				(acc, item) => {
					if (ConversationStore.conversations[item]) {
						acc.push(ConversationStore.conversations[item])
					}
					return acc
				},
				[] as Conversation[],
			)
			const list = formatChatItemList(result, lang)
			const unreadCount = list.reduce((acc, item) => acc + item.unreadCount, 0)
			return {
				list,
				unreadCount,
			}
		})
	}, [lang]).get()

	return {
		chatList,
		chatUnreadCount,
		topChatList,
		topChatUnreadCount,
		aiList,
		aiUnreadCount,
	}
}

export default useChatLists
