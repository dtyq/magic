import { useCallback } from "react"
import { useMemoizedFn } from "ahooks"
import { debounce, throttle } from "lodash-es"
import MessageStore from "@/stores/chatNew/message"
import conversationStore from "@/stores/chatNew/conversation"
import MessageImagePreview from "@/services/chat/message/MessageImagePreview"
import MessageDropdownService from "@/services/chat/message/MessageDropdownService"
import GroupSeenPanelStore, {
	domClassName as GroupSeenPanelDomClassName,
} from "@/stores/chatNew/groupSeenPanel"
import { DomClassName } from "@/constants/dom"
import {
	ScrollState,
	findClosestMessageElement,
	getMessageId,
	parseFileInfo,
	isAtBottom as isAtBottomUtil,
} from "../utils"
import type { EventHandlers, ChatMessageListState, ScrollManager, MessageLoader } from "../types"

export function useEventHandlers(
	state: ChatMessageListState,
	wrapperRef: React.RefObject<HTMLDivElement>,
	chatListRef: React.RefObject<HTMLDivElement>,
	scrollManager: ScrollManager,
	messageLoader: MessageLoader,
	isContentChanging: React.MutableRefObject<boolean>,
): EventHandlers {
	const handleContainerClick = useCallback((e: React.MouseEvent) => {
		const target = e.target as HTMLElement
		// Find element with data-message-id from clicked element upwards
		const messageElement = findClosestMessageElement(target)
		const messageId = getMessageId(messageElement)

		// If it's an image click, and not an emoji
		if (target.tagName === "IMG" && target.classList.contains("magic-image")) {
			const fileInfo = target.getAttribute("data-file-info")
			if (fileInfo) {
				const fileInfoObj = parseFileInfo(fileInfo)
				if (fileInfoObj) {
					// If it's the same image, reset state first
					MessageImagePreview.setPreviewInfo({
						...fileInfoObj,
						messageId,
						conversationId: conversationStore.currentConversation?.id,
					})
				}
			}
		}

		if (messageElement && messageElement.classList.contains(GroupSeenPanelDomClassName)) {
			if (messageId) {
				GroupSeenPanelStore.openPanel(messageId, { x: e.clientX, y: e.clientY })
			}
		} else if (GroupSeenPanelStore.open) {
			GroupSeenPanelStore.closePanel()
		}
	}, [])

	const handleContainerContextMenu = useMemoizedFn((e: React.MouseEvent) => {
		e.preventDefault()
		const target = e.target as HTMLElement
		if (target.closest(`.${DomClassName.MESSAGE_ITEM}`)) {
			// Find element with data-message-id from clicked element upwards
			const messageElement = findClosestMessageElement(target)
			const messageId = getMessageId(messageElement)
			MessageDropdownService.setMenu(messageId ?? "", e.target)
			state.setDropdownPosition({ x: e.clientX, y: e.clientY })
			state.setOpenDropdown(true)
		}
	})

	// Handle wheel event
	const handleWheelEvent = debounce((e: WheelEvent) => {
		if (e.deltaY === 1) {
			return e.preventDefault()
		}

		// Only handle scroll permission flag for wheel events, avoid impact from message rendering
		if (wrapperRef.current) {
			const distance = isAtBottomUtil(wrapperRef.current)
			ScrollState.setCanScroll(distance)
		}
	}, 100)

	// Handle container scroll event
	const handleContainerScroll = throttle(() => {
		// Don't handle when list size is changing
		if (isContentChanging.current) return

		scrollManager.checkScrollPosition()
	}, 50)

	// Handle container resize
	const handleResize = useMemoizedFn(() => {
		if (!chatListRef.current || ScrollState.isScrolling) return

		if (!MessageStore.messages.length) return

		// If last message is empty, it's initial state, scroll to bottom
		if (!ScrollState.lastMessageId) {
			console.log("initial state, handleResize to bottom")
			ScrollState.setLastMessageId(MessageStore.lastMessage?.message_id ?? "")
			scrollManager.scrollToBottom(true)
			return
		}

		// New message, and not current message, try to scroll to bottom
		const lastMessage = MessageStore.lastMessage
		if (
			(lastMessage?.is_self && lastMessage?.message_id !== ScrollState.lastMessageId) ||
			state.isAtBottom
		) {
			console.log("handleResize send bottom")
			ScrollState.setLastMessageId(lastMessage?.message_id ?? "")
			scrollManager.scrollToBottom(true)
			return
		}

		// Update lastMessageId
		ScrollState.setLastMessageId(lastMessage?.message_id ?? "")

		// Other cases, scroll back to bottom
		if (
			ScrollState.canScroll &&
			wrapperRef.current &&
			MessageStore.getIsLastMessageStreaming()
		) {
			return wrapperRef.current.scrollTo({
				top: chatListRef.current.clientHeight,
				behavior: "smooth",
			})
		}

		// Data changed, and scroll bar stays at top, load one more page
		if (
			wrapperRef.current &&
			wrapperRef.current.scrollTop === 0 &&
			!MessageStore.hasMoreHistoryMessage
		) {
			messageLoader.loadMoreHistoryMessages()
			requestAnimationFrame(() => {
				if (wrapperRef.current) {
					wrapperRef.current.scrollTop = 200
				}
			})
		}
	})

	return {
		handleContainerClick,
		handleContainerContextMenu,
		handleWheelEvent,
		handleContainerScroll,
		handleResize,
	}
}
