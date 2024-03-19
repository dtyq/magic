import type { ReactNode } from "react"

// Position and size interfaces
export interface Position {
	x: number
	y: number
}

export interface Size {
	width: number
	height: number
}

// Component state interface
export interface ChatMessageListState {
	isLoadingMore: boolean
	isAtBottom: boolean
	openDropdown: boolean
	isConversationSwitching: boolean
	marginSize: number
	size: Size
	dropdownPosition: Position
	setIsLoadingMore: (value: boolean) => void
	setIsAtBottom: (value: boolean) => void
	setOpenDropdown: (value: boolean) => void
	setIsConversationSwitching: (value: boolean) => void
	setDropdownPosition: (value: Position) => void
	setDropdownSize: (value: Size) => void
	adjustPosition: () => void
	reset: () => void
}

// Scroll related types
export type ScrollBehavior = "smooth" | "auto"
export type ScrollBlock = "center" | "start" | "end"

export interface ScrollManager {
	scrollToMessage: (messageId: string, block: ScrollBlock, behavior?: ScrollBehavior) => void
	scrollToBottom: (force?: boolean) => void
	checkScrollPosition: () => void
	checkMessagesFillViewport: () => Promise<void>
}

// Message loader types
export interface MessageLoader {
	loadMoreHistoryMessages: () => Promise<void>
	checkMessagesFillViewport: () => Promise<void>
}

// Event handler types
export type MouseEventHandler = (e: React.MouseEvent) => void
export type WheelEventHandler = (e: WheelEvent) => void
export type ScrollEventHandler = () => void
export type ResizeHandler = () => void

export interface EventHandlers {
	handleContainerClick: MouseEventHandler
	handleContainerContextMenu: MouseEventHandler
	handleWheelEvent: WheelEventHandler
	handleContainerScroll: ScrollEventHandler
	handleResize: ResizeHandler
}

// Hook return types
export interface UseChatMessageListReturn {
	state: ChatMessageListState
	scrollManager: ScrollManager
	messageLoader: MessageLoader
	eventHandlers: EventHandlers
	refs: {
		bottomRef: React.RefObject<HTMLDivElement>
		wrapperRef: React.RefObject<HTMLDivElement>
		chatListRef: React.RefObject<HTMLDivElement>
	}
}

// Message render types
export interface MessageRenderProps {
	message: any // Replace with actual message type
	conversationId: string
	topicId: string
}
