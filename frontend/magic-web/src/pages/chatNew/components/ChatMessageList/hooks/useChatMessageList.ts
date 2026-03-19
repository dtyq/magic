import { useRef, useEffect } from "react"
import { useLocalObservable } from "mobx-react-lite"
import { autorun } from "mobx"
import { debounce } from "lodash-es"
import MessageStore from "@/stores/chatNew/message"
import { ScrollState, adjustDropdownPosition, clearScrollTimeout } from "../utils"
import { useMessageLoader } from "./useMessageLoader"
import { useScrollManager } from "./useScrollManager"
import { useEventHandlers } from "./useEventHandlers"
import type { UseChatMessageListReturn, Position, Size } from "../types"

export function useChatMessageList(): UseChatMessageListReturn {
	// Refs
	const bottomRef = useRef<HTMLDivElement | null>(null)
	const wrapperRef = useRef<HTMLDivElement | null>(null)
	const chatListRef = useRef<HTMLDivElement | null>(null)
	const resizeObserverRef = useRef<ResizeObserver | null>(null)
	const initialRenderRef = useRef(true)
	const isContentChanging = useRef(false)
	const checkMessagesFillViewportTimerRef = useRef<NodeJS.Timeout | null>(null)

	// State management
	const state = useLocalObservable(() => ({
		isLoadingMore: false,
		isAtBottom: true,
		openDropdown: false,
		isConversationSwitching: false,
		marginSize: 4,
		size: { width: 92, height: 240 },
		dropdownPosition: { x: 0, y: 0 },
		setIsLoadingMore: (value: boolean) => {
			state.isLoadingMore = value
		},
		setIsAtBottom: (value: boolean) => {
			state.isAtBottom = value
		},
		setOpenDropdown: (value: boolean) => {
			state.openDropdown = value
		},
		setIsConversationSwitching: (value: boolean) => {
			state.isConversationSwitching = value
		},
		setDropdownPosition: (value: Position) => {
			state.dropdownPosition = value
			state.adjustPosition()
		},
		setDropdownSize: (value: Size) => {
			state.size = value
		},
		adjustPosition: () => {
			const adjustedPosition = adjustDropdownPosition(
				state.dropdownPosition,
				state.size,
				state.marginSize,
			)
			state.dropdownPosition = adjustedPosition
		},
		reset() {
			state.isLoadingMore = false
			state.isAtBottom = true
			state.openDropdown = false
			state.isConversationSwitching = false
			state.dropdownPosition = { x: 0, y: 0 }
		},
	}))

	// Initialize hooks
	const messageLoader = useMessageLoader(state, wrapperRef, chatListRef)
	const scrollManager = useScrollManager(
		state,
		bottomRef,
		wrapperRef,
		messageLoader,
		initialRenderRef,
	)
	const eventHandlers = useEventHandlers(
		state,
		wrapperRef,
		chatListRef,
		scrollManager,
		messageLoader,
		isContentChanging,
	)

	// Switch conversation or topic
	useEffect(() => {
		if (wrapperRef.current) {
			wrapperRef.current.removeEventListener("scroll", eventHandlers.handleContainerScroll)
			wrapperRef.current.removeEventListener("wheel", eventHandlers.handleWheelEvent)
		}

		// Immediately set switching state to prevent message mixing
		state.setIsConversationSwitching(true)
		state.reset()
		ScrollState.reset()
		initialRenderRef.current = false

		// Immediately scroll to bottom, no delay
		setTimeout(() => {
			scrollManager.scrollToBottom(true)
		}, 0)

		// Reduce delay time, quickly restore normal state
		setTimeout(() => {
			if (wrapperRef.current) {
				wrapperRef.current.addEventListener("scroll", eventHandlers.handleContainerScroll)
				wrapperRef.current.addEventListener("wheel", eventHandlers.handleWheelEvent)
			}
			initialRenderRef.current = true
			state.setIsConversationSwitching(false)

			// After conversation switch, check if messages fill viewport
			clearScrollTimeout(checkMessagesFillViewportTimerRef.current)
			scrollManager.checkMessagesFillViewport()
		}, 100) // Reduce delay from 1000ms to 100ms
	}, [MessageStore.conversationId, MessageStore.topicId])

	useEffect(() => {
		// Create ResizeObserver instance to monitor message list height changes
		resizeObserverRef.current = new ResizeObserver(
			debounce((entries) => {
				const chatList = entries[0]
				if (!chatList) return
				// List size changed
				isContentChanging.current = true
				eventHandlers.handleResize()
				// Reset
				setTimeout(() => {
					isContentChanging.current = false
				}, 0)
			}, 100),
		)

		// Start observing
		if (chatListRef.current) {
			resizeObserverRef.current.observe(chatListRef.current)
		}

		// Message focus
		const focusDisposer = autorun(() => {
			if (MessageStore.focusMessageId) {
				scrollManager.scrollToMessage(MessageStore.focusMessageId, "center")
			}
		})

		function handleClick(e: MouseEvent) {
			const target = e.target as HTMLElement
			if (target.classList.contains("message-item-menu")) {
				return
			}
			state.setOpenDropdown(false)
		}

		document.addEventListener("click", handleClick)

		return () => {
			focusDisposer()
			document.removeEventListener("click", handleClick)
			state.reset()
			resizeObserverRef.current?.disconnect()
			resizeObserverRef.current = null
			if (wrapperRef.current) {
				wrapperRef.current.removeEventListener(
					"scroll",
					eventHandlers.handleContainerScroll,
				)
			}
			clearScrollTimeout(checkMessagesFillViewportTimerRef.current)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return {
		state,
		scrollManager,
		messageLoader,
		eventHandlers,
		refs: {
			bottomRef,
			wrapperRef,
			chatListRef,
		},
	}
}
