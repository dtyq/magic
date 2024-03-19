import { useMemoizedFn } from "ahooks"
import MessageStore from "@/opensource/stores/chatNew/message"
import {
	ScrollState,
	findMessageElement,
	isScrollingUp,
	createScrollTimeout,
	isMessageInView,
} from "../utils"
import type {
	ScrollManager,
	ScrollBehavior,
	ScrollBlock,
	ChatMessageListState,
	MessageLoader,
} from "../types"

export function useScrollManager(
	state: ChatMessageListState,
	bottomRef: React.RefObject<HTMLDivElement>,
	wrapperRef: React.RefObject<HTMLDivElement>,
	messageLoader: MessageLoader,
	initialRenderRef: React.MutableRefObject<boolean>,
): ScrollManager {
	const scrollToMessage = useMemoizedFn(
		(messageId: string, block: ScrollBlock, behavior: ScrollBehavior = "smooth") => {
			if (wrapperRef.current) {
				const messageElement = findMessageElement(wrapperRef.current, messageId)
				if (messageElement) {
					ScrollState.setCanScroll(false)
					ScrollState.setScrolling(true)
					messageElement.scrollIntoView({ behavior, block })
					createScrollTimeout(() => {
						ScrollState.setScrolling(false)
						ScrollState.setCanScroll(true)
					}, 0)
				}
			}
		},
	)

	const scrollToBottom = useMemoizedFn((force?: boolean) => {
		// Not allowed to scroll
		if (!ScrollState.canScroll && !force) {
			return
		}

		if (bottomRef?.current) {
			ScrollState.setScrolling(true)
			bottomRef.current.scrollIntoView({ behavior: "smooth" })
		}

		createScrollTimeout(() => {
			ScrollState.setScrolling(false)
			state.setIsAtBottom(true)
			ScrollState.setCanScroll(true)
		}, 0)
	})

	// Check scroll position and handle
	const checkScrollPosition = useMemoizedFn(() => {
		if (!wrapperRef.current || !initialRenderRef.current || ScrollState.isScrolling) return

		// Don't handle in initial state
		if (ScrollState.lastScrollTop === 0) {
			ScrollState.setLastScrollTop(wrapperRef.current.scrollTop)
			return
		}

		const { scrollTop, clientHeight, scrollHeight } = wrapperRef.current
		const distance = Math.abs(scrollTop + clientHeight - scrollHeight)

		state.setIsAtBottom(distance < 100)

		const isScrollUp = isScrollingUp(scrollTop)

		if (isScrollUp && !state.isLoadingMore) {
			// Load more, check if fourth message enters view
			const messageId = MessageStore.messages[3]?.message_id

			if (isMessageInView(messageId, wrapperRef.current) || scrollTop < 150) {
				messageLoader.loadMoreHistoryMessages()
			}
		}
	})

	// Check if more messages need to be loaded to fill viewport
	const checkMessagesFillViewport = messageLoader.checkMessagesFillViewport

	return {
		scrollToMessage,
		scrollToBottom,
		checkScrollPosition,
		checkMessagesFillViewport,
	}
}
