import { useRef } from "react"
import { useMemoizedFn } from "ahooks"
import MessageStore from "@/stores/chatNew/message"
import MessageService from "@/services/chat/message/MessageService"
import conversationStore from "@/stores/chatNew/conversation"
import { ScrollState, clearScrollTimeout } from "../utils"
import type { MessageLoader, ChatMessageListState } from "../types"

export function useMessageLoader(
	state: ChatMessageListState,
	wrapperRef: React.RefObject<HTMLDivElement>,
	chatListRef: React.RefObject<HTMLDivElement>,
): MessageLoader {
	const checkMessagesFillViewportTimerRef = useRef<NodeJS.Timeout | null>(null)

	// Load more history messages
	const loadMoreHistoryMessages = useMemoizedFn(async () => {
		if (state.isLoadingMore || !MessageStore.hasMoreHistoryMessage) return

		try {
			state.setIsLoadingMore(true)
			ScrollState.setCanScroll(false)

			// Request history messages
			await MessageService.getHistoryMessages(
				conversationStore.currentConversation?.id ?? "",
				conversationStore.currentConversation?.current_topic_id ?? "",
			)
		} catch (error) {
			// Restore style when error occurs
			if (chatListRef.current) {
				chatListRef.current.style.transform = ""
				chatListRef.current.style.position = ""
			}
		} finally {
			state.setIsLoadingMore(false)
		}
	})

	// Check if more messages need to be loaded to fill viewport
	const checkMessagesFillViewport = useMemoizedFn(async () => {
		if (
			!wrapperRef.current ||
			!chatListRef.current ||
			state.isLoadingMore ||
			!MessageStore.hasMoreHistoryMessage
		) {
			return
		}

		const wrapperHeight = wrapperRef.current.clientHeight
		const listHeight = chatListRef.current.clientHeight

		// If content height is less than container height, and we have enough messages to load
		// Load more history messages until viewport is filled or no more messages
		if (listHeight < wrapperHeight && MessageStore.messages.length > 0) {
			console.log(
				"Container not filled, trying to load more history messages",
				listHeight,
				wrapperHeight,
			)

			try {
				await loadMoreHistoryMessages()

				// Recursively check until filled or no more messages
				clearScrollTimeout(checkMessagesFillViewportTimerRef.current)

				checkMessagesFillViewportTimerRef.current = setTimeout(() => {
					checkMessagesFillViewport()
				}, 300)
			} catch (error) {
				console.error("Failed to load more messages", error)
			}
		}
	})

	return {
		loadMoreHistoryMessages,
		checkMessagesFillViewport,
	}
}
